import { ApiError } from '@/src/api/errors';
import {
  demoCompletePayment,
  demoCreateOrder,
  demoCreateService,
  demoCreateSlot,
  demoDeleteService,
  demoDeleteSlot,
  demoGetCounsellorProfile,
  demoListOwnServices,
  demoListOwnSlots,
  demoListServices,
  demoListSlots,
  demoLogin,
  demoRegister,
  demoUpdateCounsellorProfile,
  demoUpdateService,
  demoUpdateSlot,
  resetDemoState,
} from '@/src/api/demo';
import {
  AvailabilitySlot,
  CounsellorProfileUpdate,
  RegisterRequest,
  ServiceDraft,
} from '@/src/api/types';

const DEMO_DELAY_MS = 300;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

type Outcome<T> = { ok: true; value: T } | { ok: false; error: unknown };

/** Every demo call awaits a 300ms pause, so drive the fake clock before reading the result. */
async function settle<T>(pending: Promise<T>): Promise<T> {
  const tracked: Promise<Outcome<T>> = pending.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await jest.advanceTimersByTimeAsync(DEMO_DELAY_MS);
  const outcome = await tracked;
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}

/** Settles a call that is expected to fail and hands back the ApiError it threw. */
async function rejection(pending: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(pending);
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('Expected the demo call to reject, but it resolved.');
}

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const shift = (at: string, ms: number) => new Date(Date.parse(at) + ms).toISOString();

const registration = (over: Partial<RegisterRequest> = {}): RegisterRequest => ({
  name: 'Rae Patel',
  email: 'rae@example.com',
  password: 'correct-password',
  passwordConfirmation: 'correct-password',
  role: 'job_seeker',
  ...over,
});

const profileUpdate = (over: Partial<CounsellorProfileUpdate> = {}): CounsellorProfileUpdate => ({
  photoUrl: null,
  linkedinUrl: 'https://www.linkedin.com/in/updated',
  introduction: 'Updated introduction.',
  background: 'Updated background.',
  experience: 'Updated experience.',
  baseLocation: { state: 'VIC', cityOrRegion: 'Geelong' },
  defaultModality: 'in_person',
  ...over,
});

const serviceDraft = (over: Partial<ServiceDraft> = {}): ServiceDraft => ({
  title: 'Mock interview intensive',
  description: 'Two mock interviews with written feedback.',
  priceMinor: 11000,
  currency: 'AUD',
  modalities: ['online'],
  location: null,
  ...over,
});

/** Drives a real order and payment so a slot reaches the 'booked' state the guards care about. */
async function bookFirstSlot(serviceId: string): Promise<AvailabilitySlot> {
  const slots = await settle(demoListSlots(serviceId));
  // demoListSlots hands back the store's own objects, so snapshot before the booking mutates it.
  const target = { ...slots[0] };
  const order = await settle(demoCreateOrder(serviceId, target.id));
  await settle(demoCompletePayment(order));
  return target;
}

describe('local demo store: counsellor operations and booking integrity', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-28T00:00:00.000Z'));
    resetDemoState();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('registration and login', () => {
    test('refuses to register an email a seeded counsellor already holds', async () => {
      const error = await rejection(
        demoRegister(registration({ name: 'Not Maya', email: '  MAYA@Yoir.test  ', role: 'counsellor' })),
      );

      expect(error.status).toBe(409);
      expect(error.body).toEqual({
        code: 'EMAIL_ALREADY_REGISTERED',
        message: 'An account already exists for this email address.',
        fieldErrors: { email: 'Use a different email address, or log in instead.' },
        requestId: 'local',
      });
    });

    test('refuses to register an email registered earlier in the session', async () => {
      await settle(demoRegister(registration({ email: 'taylor@example.com' })));

      const error = await rejection(
        demoRegister(registration({ name: 'Taylor Again', email: 'taylor@example.com', role: 'counsellor' })),
      );

      expect(error.status).toBe(409);
      expect(error.body.code).toBe('EMAIL_ALREADY_REGISTERED');
      expect(Object.keys(error.body.fieldErrors ?? {})).toEqual(['email']);
    });

    test('logs a seeded counsellor in as a counsellor', async () => {
      const session = await settle(demoLogin('maya@yoir.test', 'correct-password'));

      expect(session).toMatchObject({
        accessToken: 'demo-access-token',
        user: {
          id: 'counsellor_maya',
          name: 'Maya Chen',
          email: 'maya@yoir.test',
          role: 'counsellor',
        },
      });
      expect(Date.parse(session.expiresAt)).toBe(Date.now() + HOUR);
    });

    test('falls back to a job-seeker session for an email the store has never seen', async () => {
      const session = await settle(demoLogin('stranger@example.com', 'correct-password'));

      expect(session.user).toEqual({
        id: 'demo-user',
        name: 'Demo Job Seeker',
        email: 'stranger@example.com',
        role: 'job_seeker',
      });
    });

    test('remembers a registered job seeker on the next login', async () => {
      await settle(demoRegister(registration({ name: 'Alex Morgan', email: 'Alex@Example.com' })));

      const session = await settle(demoLogin('alex@example.com', 'correct-password'));

      expect(session.user).toMatchObject({ name: 'Alex Morgan', role: 'job_seeker' });
    });

    test('registering as a counsellor creates the account a later login points at', async () => {
      const registered = await settle(demoRegister(registration({ role: 'counsellor' })));

      const session = await settle(demoLogin('rae@example.com', 'correct-password'));
      expect(session.user).toMatchObject({ name: 'Rae Patel', role: 'counsellor' });
      expect(session.user.id).toMatch(/^demo-counsellor-\d+$/);

      const profile = await settle(demoGetCounsellorProfile(session.user.id));
      expect(profile).toMatchObject({
        id: session.user.id,
        displayName: 'Rae Patel',
        verificationStatus: 'pending',
        overallRating: null,
        reviewCount: 0,
      });
      expect(await settle(demoListOwnServices(session.user.id))).toEqual([]);

      // Current behaviour: the registration response reports a placeholder id rather than
      // the counsellor account id the session and profile actually use.
      expect(registered.id).toBe('demo-new-user');
      expect(registered.id).not.toBe(session.user.id);
    });
  });

  describe('counsellor profiles', () => {
    test('returns a seeded profile without the account email', async () => {
      const profile = await settle(demoGetCounsellorProfile('counsellor_maya'));

      expect(profile).toEqual({
        id: 'counsellor_maya',
        displayName: 'Maya Chen',
        photoUrl: null,
        linkedinUrl: 'https://www.linkedin.com/in/maya-chen',
        introduction: expect.stringContaining('early-career transitions'),
        background: expect.any(String),
        experience: expect.any(String),
        baseLocation: { state: 'VIC', cityOrRegion: 'Melbourne' },
        defaultModality: 'online',
        verificationStatus: 'verified',
        overallRating: 4.9,
        reviewCount: 46,
      });
      expect(profile).not.toHaveProperty('email');
    });

    test('rejects an unknown counsellor when no display name is supplied', async () => {
      const error = await rejection(demoGetCounsellorProfile('counsellor_ghost'));

      expect(error.status).toBe(404);
      expect(error.body).toMatchObject({
        code: 'NOT_FOUND',
        message: 'This counsellor profile is unavailable.',
        requestId: 'local',
      });
      expect(error.body.fieldErrors).toBeUndefined();
    });

    test('creates one empty pending profile when a display name is supplied', async () => {
      const created = await settle(demoGetCounsellorProfile('counsellor_new', 'Sam Rivera'));

      expect(created).toEqual({
        id: 'counsellor_new',
        displayName: 'Sam Rivera',
        photoUrl: null,
        // A counsellor the store has never seen must supply their own LinkedIn URL.
        linkedinUrl: '',
        introduction: '',
        background: '',
        experience: '',
        baseLocation: null,
        defaultModality: 'online',
        verificationStatus: 'pending',
        overallRating: null,
        reviewCount: 0,
      });

      // A second read, with or without the display name, serves that same stored profile.
      expect(await settle(demoGetCounsellorProfile('counsellor_new'))).toEqual(created);

      const updated = await settle(
        demoUpdateCounsellorProfile('counsellor_new', profileUpdate({ introduction: 'New to Yoir.' })),
      );
      const reread = await settle(demoGetCounsellorProfile('counsellor_new', 'Sam Rivera'));
      expect(reread).toEqual(updated);
      expect(reread.introduction).toBe('New to Yoir.');
    });

    test('merges a profile update and serves it on the next read', async () => {
      const updated = await settle(
        demoUpdateCounsellorProfile(
          'counsellor_maya',
          profileUpdate({ introduction: 'Interview coaching for career changers.' }),
        ),
      );

      expect(updated).toMatchObject({
        id: 'counsellor_maya',
        displayName: 'Maya Chen',
        verificationStatus: 'verified',
        overallRating: 4.9,
        reviewCount: 46,
        introduction: 'Interview coaching for career changers.',
        background: 'Updated background.',
        experience: 'Updated experience.',
        baseLocation: { state: 'VIC', cityOrRegion: 'Geelong' },
        defaultModality: 'in_person',
      });

      expect(await settle(demoGetCounsellorProfile('counsellor_maya'))).toEqual(updated);
    });

    test('rejects a profile update for a counsellor that does not exist', async () => {
      const error = await rejection(demoUpdateCounsellorProfile('counsellor_ghost', profileUpdate()));

      expect(error.status).toBe(404);
      expect(error.body.code).toBe('NOT_FOUND');
    });
  });

  describe('counsellor services', () => {
    test('lists only the calling counsellor own services', async () => {
      const mine = await settle(demoListOwnServices('counsellor_maya'));

      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({
        id: 'svc_interview',
        title: 'Interview confidence coaching',
        counsellor: { id: 'counsellor_maya', displayName: 'Maya Chen', verificationStatus: 'verified' },
      });

      expect(await settle(demoListOwnServices('counsellor_ghost'))).toEqual([]);
    });

    test('publishes a new service into the own list and the marketplace', async () => {
      const created = await settle(demoCreateService('counsellor_maya', serviceDraft()));

      expect(created).toMatchObject({
        title: 'Mock interview intensive',
        description: 'Two mock interviews with written feedback.',
        priceMinor: 11000,
        currency: 'AUD',
        modalities: ['online'],
        active: true,
        averageRating: null,
        reviewCount: 0,
        counsellor: { id: 'counsellor_maya', displayName: 'Maya Chen' },
      });
      expect(created.id).toMatch(/^demo-service-\d+$/);
      // The draft carried no location, so the published service omits the field entirely.
      expect(created).not.toHaveProperty('location');

      const mine = await settle(demoListOwnServices('counsellor_maya'));
      expect(mine.map((item) => item.id)).toEqual(['svc_interview', created.id]);

      const marketplace = await settle(demoListServices());
      expect(marketplace).toHaveLength(7);
      expect(marketplace.map((item) => item.id)).toContain(created.id);
    });

    test('keeps the location when the draft supplies one', async () => {
      const created = await settle(
        demoCreateService(
          'counsellor_jordan',
          serviceDraft({
            title: 'On-site application clinic',
            modalities: ['online', 'in_person'],
            location: { state: 'VIC', cityOrRegion: 'Melbourne' },
          }),
        ),
      );

      expect(created.location).toEqual({ state: 'VIC', cityOrRegion: 'Melbourne' });
      expect(await settle(demoListOwnServices('counsellor_jordan'))).toHaveLength(2);
    });

    test('falls back to a placeholder summary for a service with no counsellor profile', async () => {
      const created = await settle(
        demoCreateService('counsellor_ghost', serviceDraft({ title: 'Orphan service' })),
      );

      expect(created.counsellor).toEqual({
        id: 'counsellor_ghost',
        displayName: 'Yoir counsellor',
        introduction: undefined,
        verificationStatus: 'pending',
        overallRating: null,
        reviewCount: 0,
      });
    });

    test('reflects a profile edit in the marketplace summary for that counsellor', async () => {
      await settle(
        demoUpdateCounsellorProfile(
          'counsellor_maya',
          profileUpdate({ introduction: 'Now coaching panel interviews.' }),
        ),
      );

      expect(await settle(demoListServices('maya'))).toEqual([
        expect.objectContaining({
          id: 'svc_interview',
          counsellor: expect.objectContaining({ introduction: 'Now coaching panel interviews.' }),
        }),
      ]);
    });

    test('updates a service in place and serves the change on the next read', async () => {
      const updated = await settle(
        demoUpdateService('svc_interview', serviceDraft({ title: 'Interview mastery intensive', priceMinor: 13000 })),
      );

      expect(updated).toMatchObject({ id: 'svc_interview', title: 'Interview mastery intensive', priceMinor: 13000 });
      expect(await settle(demoListOwnServices('counsellor_maya'))).toEqual([updated]);
    });

    test('drops the location when an edit removes in-person delivery', async () => {
      const created = await settle(
        demoCreateService('counsellor_jordan', serviceDraft({
          modalities: ['online', 'in_person'],
          location: { state: 'VIC', cityOrRegion: 'Melbourne' },
        })),
      );

      const updated = await settle(
        demoUpdateService(created.id, serviceDraft({ modalities: ['online'], location: null })),
      );

      expect(updated.modalities).toEqual(['online']);
      expect(updated).not.toHaveProperty('location');
    });

    test('rejects an update to a service that does not exist', async () => {
      const error = await rejection(demoUpdateService('svc-missing', serviceDraft()));

      expect(error.status).toBe(404);
      expect(error.body).toMatchObject({ code: 'NOT_FOUND', message: 'This service no longer exists.' });
    });

    test('deleting a service is a soft delete: it disappears from the counsellor and the marketplace', async () => {
      expect(await settle(demoDeleteService('svc_interview'))).toBeUndefined();

      expect(await settle(demoListOwnServices('counsellor_maya'))).toEqual([]);
      expect(await settle(demoListServices())).not.toContainEqual(expect.objectContaining({ id: 'svc_interview' }));
    });

    test('rejects deleting a service that does not exist', async () => {
      const error = await rejection(demoDeleteService('svc-missing'));

      expect(error.status).toBe(404);
      expect(error.body).toMatchObject({ code: 'NOT_FOUND', message: 'This service no longer exists.' });
    });
  });

  describe('availability slots', () => {
    test('lists only slots on services the counsellor owns, in start order', async () => {
      const mine = await settle(demoListOwnSlots('counsellor_maya'));

      expect(mine).toHaveLength(3);
      expect(mine.every((slot) => slot.serviceId === 'svc_interview')).toBe(true);
      expect(mine.map((slot) => slot.startsAt)).toEqual([...mine.map((slot) => slot.startsAt)].sort());

      expect(await settle(demoListOwnSlots('counsellor_ghost'))).toEqual([]);
    });

    test('rejects a window whose start is not before its end', async () => {
      const [first] = await settle(demoListOwnSlots('counsellor_maya'));

      const reversed = await rejection(
        demoCreateSlot({ serviceId: 'svc_interview', startsAt: first.endsAt, endsAt: first.startsAt }),
      );
      expect(reversed.status).toBe(400);
      expect(reversed.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        message: 'The start time must be before the end time.',
        fieldErrors: { endsAt: 'Choose an end time after the start time.' },
      });

      const zeroLength = await rejection(
        demoCreateSlot({ serviceId: 'svc_interview', startsAt: first.startsAt, endsAt: first.startsAt }),
      );
      expect(zeroLength.status).toBe(400);
      expect(zeroLength.body.code).toBe('VALIDATION_ERROR');

      expect(await settle(demoListOwnSlots('counsellor_maya'))).toHaveLength(3);
    });

    test('rejects a window overlapping a slot already offered on that service', async () => {
      const [first] = await settle(demoListOwnSlots('counsellor_maya'));

      const error = await rejection(
        demoCreateSlot({
          serviceId: first.serviceId,
          startsAt: shift(first.startsAt, 30 * MINUTE),
          endsAt: shift(first.endsAt, 30 * MINUTE),
        }),
      );

      expect(error.status).toBe(409);
      expect(error.body).toMatchObject({
        code: 'SLOT_OVERLAP',
        message: 'This window overlaps an availability slot you already offer.',
      });

      // The clash is scoped to one service: the same window on another service is fine.
      const second = await settle(demoCreateService('counsellor_maya', serviceDraft({ title: 'Second offering' })));
      const twin = await settle(
        demoCreateSlot({ serviceId: second.id, startsAt: first.startsAt, endsAt: first.endsAt }),
      );
      expect(twin).toMatchObject({ serviceId: second.id, startsAt: first.startsAt, status: 'open' });
      expect(await settle(demoListOwnSlots('counsellor_maya'))).toHaveLength(4);
    });

    test('opens a window that clears the existing slots', async () => {
      const draft = { serviceId: 'svc_interview', startsAt: iso(30 * DAY), endsAt: iso(30 * DAY + HOUR) };

      const created = await settle(demoCreateSlot(draft));
      expect(created).toEqual({ id: expect.stringMatching(/^demo-slot-\d+$/), ...draft, status: 'open' });

      const mine = await settle(demoListOwnSlots('counsellor_maya'));
      expect(mine).toHaveLength(4);
      expect(mine[3]).toMatchObject({ id: created.id, ...draft, status: 'open' });
      expect((await settle(demoListSlots('svc_interview'))).map((slot) => slot.id)).toContain(created.id);
    });

    test('rejects an update to a slot that does not exist', async () => {
      const error = await rejection(
        demoUpdateSlot('demo-slot-missing', {
          serviceId: 'svc_interview',
          startsAt: iso(30 * DAY),
          endsAt: iso(30 * DAY + HOUR),
        }),
      );

      expect(error.status).toBe(404);
      expect(error.body).toMatchObject({
        code: 'NOT_FOUND',
        message: 'This availability slot no longer exists.',
      });
    });

    test('moves an open slot without treating its own window as a clash', async () => {
      const [first] = await settle(demoListOwnSlots('counsellor_maya'));
      const moved = {
        serviceId: first.serviceId,
        startsAt: shift(first.startsAt, 15 * MINUTE),
        endsAt: shift(first.endsAt, 15 * MINUTE),
      };

      const updated = await settle(demoUpdateSlot(first.id, moved));
      expect(updated).toEqual({ id: first.id, ...moved, status: 'open' });

      const mine = await settle(demoListOwnSlots('counsellor_maya'));
      expect(mine).toHaveLength(3);
      expect(mine[0]).toMatchObject({ id: first.id, ...moved, status: 'open' });
    });

    test('rejects an edit that collides with another slot on the same service', async () => {
      const [first, second] = await settle(demoListOwnSlots('counsellor_maya'));
      const original = { ...first };

      const error = await rejection(
        demoUpdateSlot(first.id, {
          serviceId: first.serviceId,
          startsAt: second.startsAt,
          endsAt: second.endsAt,
        }),
      );
      expect(error.status).toBe(409);
      expect(error.body.code).toBe('SLOT_OVERLAP');

      const invalid = await rejection(
        demoUpdateSlot(first.id, {
          serviceId: first.serviceId,
          startsAt: first.endsAt,
          endsAt: first.startsAt,
        }),
      );
      expect(invalid.status).toBe(400);
      expect(invalid.body.code).toBe('VALIDATION_ERROR');

      const mine = await settle(demoListOwnSlots('counsellor_maya'));
      expect(mine[0]).toEqual(original);
    });

    test('refuses to change or remove a booked slot', async () => {
      const booked = await bookFirstSlot('svc_interview');
      expect(booked.status).toBe('open');

      const update = await rejection(
        demoUpdateSlot(booked.id, {
          serviceId: 'svc_interview',
          startsAt: iso(30 * DAY),
          endsAt: iso(30 * DAY + HOUR),
        }),
      );
      expect(update.status).toBe(409);
      expect(update.body).toMatchObject({
        code: 'INVALID_STATE_TRANSITION',
        message: 'A booked slot cannot be changed.',
      });

      const removal = await rejection(demoDeleteSlot(booked.id));
      expect(removal.status).toBe(409);
      expect(removal.body).toMatchObject({
        code: 'INVALID_STATE_TRANSITION',
        message: 'A booked slot cannot be removed.',
      });

      const mine = await settle(demoListOwnSlots('counsellor_maya'));
      expect(mine.find((slot) => slot.id === booked.id)).toEqual({ ...booked, status: 'booked' });
    });

    test('rejects deleting a slot that does not exist', async () => {
      const error = await rejection(demoDeleteSlot('demo-slot-missing'));

      expect(error.status).toBe(404);
      expect(error.body).toMatchObject({
        code: 'NOT_FOUND',
        message: 'This availability slot no longer exists.',
      });
    });

    test('removes an open slot from the calendar and the marketplace', async () => {
      const before = await settle(demoListOwnSlots('counsellor_maya'));

      expect(await settle(demoDeleteSlot(before[1].id))).toBeUndefined();

      const after = await settle(demoListOwnSlots('counsellor_maya'));
      expect(after.map((slot) => slot.id)).toEqual([before[0].id, before[2].id]);
      expect((await settle(demoListSlots('svc_interview'))).map((slot) => slot.id)).not.toContain(before[1].id);
    });
  });

  describe('booking integrity', () => {
    test('holds the slot on order and refuses a second order for it', async () => {
      const offered = await settle(demoListSlots('svc_interview'));
      const target = { ...offered[0] };
      expect(target.status).toBe('open');

      const order = await settle(demoCreateOrder('svc_interview', target.id));
      expect(order).toMatchObject({
        serviceId: 'svc_interview',
        slotId: target.id,
        amountMinor: 9500,
        currency: 'AUD',
        status: 'awaiting_payment',
        paymentStatus: 'not_started',
      });

      const stillOffered = await settle(demoListSlots('svc_interview'));
      expect(stillOffered).toHaveLength(2);
      expect(stillOffered.map((slot) => slot.id)).not.toContain(target.id);

      const error = await rejection(demoCreateOrder('svc_interview', target.id));
      expect(error.status).toBe(409);
      expect(error.body).toMatchObject({
        code: 'SLOT_UNAVAILABLE',
        message: 'The selected slot is no longer available.',
        fieldErrors: { slotId: 'Choose another available slot.' },
      });
    });

    test('books the held slot on payment and returns a booking for that window', async () => {
      const offered = await settle(demoListSlots('svc_interview'));
      const target = { ...offered[0] };
      const order = await settle(demoCreateOrder('svc_interview', target.id));

      const confirmation = await settle(demoCompletePayment(order));

      expect(confirmation).toMatchObject({
        paymentStatus: 'paid',
        booking: {
          orderId: order.id,
          serviceId: 'svc_interview',
          serviceTitle: 'Interview confidence coaching',
          startsAt: target.startsAt,
          endsAt: target.endsAt,
          timezone: 'Australia/Sydney',
          modality: 'online',
          status: 'confirmed',
          paymentStatus: 'paid',
        },
      });
      expect(confirmation.paymentId).toMatch(/^stub-\d+$/);

      const calendar = await settle(demoListOwnSlots('counsellor_maya'));
      expect(calendar.find((slot) => slot.id === target.id)).toMatchObject({ status: 'booked' });
      expect((await settle(demoListSlots('svc_interview'))).map((slot) => slot.id)).not.toContain(target.id);
    });

    test('books a one-hour window from now when the order names no known slot', async () => {
      const order = await settle(demoCreateOrder('svc_interview', 'demo-slot-missing'));
      expect(order.slotId).toBe('demo-slot-missing');

      const confirmation = await settle(demoCompletePayment(order));
      expect(Date.parse(confirmation.booking.startsAt)).toBe(Date.now());
      expect(Date.parse(confirmation.booking.endsAt) - Date.parse(confirmation.booking.startsAt)).toBe(HOUR);

      // Nothing was held, so every seeded slot is still on offer.
      expect(await settle(demoListSlots('svc_interview'))).toHaveLength(3);
    });

    test('current behaviour: an order may claim a slot that belongs to another service', async () => {
      const foreign = { ...(await settle(demoListSlots('svc_resume')))[0] };

      const order = await settle(demoCreateOrder('svc_interview', foreign.id));
      expect(order).toMatchObject({ serviceId: 'svc_interview', slotId: foreign.id, amountMinor: 9500 });

      // The other counsellor's window is held even though it was never offered for this service.
      expect((await settle(demoListSlots('svc_resume'))).map((slot) => slot.id)).not.toContain(foreign.id);

      const confirmation = await settle(demoCompletePayment(order));
      expect(confirmation.booking).toMatchObject({
        serviceId: 'svc_interview',
        serviceTitle: 'Interview confidence coaching',
        startsAt: foreign.startsAt,
        endsAt: foreign.endsAt,
      });
      expect(await settle(demoListOwnSlots('counsellor_jordan'))).toContainEqual({ ...foreign, status: 'booked' });
    });
  });

  describe('resetDemoState', () => {
    test('restores the seeded catalogue after counsellor and booking mutations', async () => {
      await settle(demoRegister(registration({ role: 'counsellor' })));
      await settle(demoCreateService('counsellor_maya', serviceDraft()));
      await settle(demoUpdateCounsellorProfile('counsellor_maya', profileUpdate({ introduction: 'Temporary edit.' })));
      const mutated = await settle(demoListOwnSlots('counsellor_maya'));
      await settle(demoDeleteSlot(mutated[1].id));
      await bookFirstSlot('svc_resume');

      resetDemoState();

      expect(await settle(demoListServices())).toHaveLength(6);
      expect(await settle(demoListOwnServices('counsellor_maya'))).toHaveLength(1);

      const profile = await settle(demoGetCounsellorProfile('counsellor_maya'));
      expect(profile.introduction).toContain('early-career transitions');
      expect(profile.baseLocation).toEqual({ state: 'VIC', cityOrRegion: 'Melbourne' });
      expect(profile.defaultModality).toBe('online');

      expect(await settle(demoListOwnSlots('counsellor_maya'))).toHaveLength(3);
      const resumeSlots = await settle(demoListSlots('svc_resume'));
      expect(resumeSlots).toHaveLength(3);
      expect(resumeSlots.every((slot) => slot.status === 'open')).toBe(true);

      // The counsellor registered before the reset is gone with it.
      const session = await settle(demoLogin('rae@example.com', 'correct-password'));
      expect(session.user).toMatchObject({ id: 'demo-user', role: 'job_seeker' });
    });
  });
});
