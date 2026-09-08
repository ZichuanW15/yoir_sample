import { apiError } from './errors';
import {
  AvailabilitySlot,
  Booking,
  CounsellorProfile,
  CounsellorProfileUpdate,
  Order,
  RegisterRequest,
  Role,
  Service,
  ServiceDraft,
  Session,
  SlotDraft,
  StubPaymentConfirmation,
  User,
} from './types';

/**
 * A local, in-memory stand-in for the Yoir API.
 *
 * It backs two things: `EXPO_PUBLIC_USE_DEMO_API=true` (no backend at all), and
 * the counsellor operations that are published in the interface contract but not
 * yet served by the deployed backend. See `previewFallback` in `client.ts`.
 */

interface DemoCounsellor extends CounsellorProfile {
  email: string;
}

const seedCounsellors: DemoCounsellor[] = [
  {
    id: 'counsellor_maya', linkedinUrl: 'https://www.linkedin.com/in/maya-chen', email: 'maya@yoir.test', displayName: 'Maya Chen', photoUrl: null,
    introduction: 'Career counsellor specialising in early-career transitions and interview preparation.',
    background: 'Ten years in graduate recruitment across technology and professional services.',
    experience: 'Coached over 400 candidates through behavioural and technical interview rounds.',
    baseLocation: { state: 'VIC', cityOrRegion: 'Melbourne' }, defaultModality: 'online',
    verificationStatus: 'verified', overallRating: 4.9, reviewCount: 46,
  },
  {
    id: 'counsellor_jordan', linkedinUrl: 'https://www.linkedin.com/in/jordan-lee', email: 'jordan@yoir.test', displayName: 'Jordan Lee', photoUrl: null,
    introduction: 'Recruitment and career-development specialist with experience across technology and consulting.',
    background: 'Former in-house recruiter, now an independent application and resume reviewer.',
    experience: 'Reviews around 30 applications a month for graduate and mid-career roles.',
    baseLocation: { state: 'VIC', cityOrRegion: 'Melbourne' }, defaultModality: 'in_person',
    verificationStatus: 'verified', overallRating: 4.8, reviewCount: 32,
  },
  {
    id: 'counsellor_priya', linkedinUrl: 'https://www.linkedin.com/in/priya-nair', email: 'priya@yoir.test', displayName: 'Priya Nair', photoUrl: null,
    introduction: 'Helps mid-career professionals plan and execute a deliberate change of direction.',
    background: 'Organisational psychologist working with career changers since 2016.',
    experience: 'Runs structured transition programs for people moving between industries.',
    baseLocation: { state: 'NSW', cityOrRegion: 'Sydney' }, defaultModality: 'online',
    verificationStatus: 'verified', overallRating: 4.8, reviewCount: 34,
  },
  {
    id: 'counsellor_tom', linkedinUrl: 'https://www.linkedin.com/in/tom-alvarez', email: 'tom@yoir.test', displayName: 'Tom Alvarez', photoUrl: null,
    introduction: 'Works with recent graduates on their first structured job search.',
    background: 'University careers adviser turned independent counsellor.',
    experience: 'Supports graduates through applications, assessment centres and offers.',
    baseLocation: { state: 'NSW', cityOrRegion: 'Sydney' }, defaultModality: 'in_person',
    verificationStatus: 'verified', overallRating: 4.6, reviewCount: 12,
  },
  {
    id: 'counsellor_hannah', linkedinUrl: 'https://www.linkedin.com/in/hannah-okafor', email: 'hannah@yoir.test', displayName: 'Hannah Okafor', photoUrl: null,
    introduction: 'Coaches senior individual contributors preparing for their first leadership role.',
    background: 'Fifteen years leading teams in health and public-sector organisations.',
    experience: 'Prepares candidates for panel interviews and executive selection processes.',
    baseLocation: { state: 'QLD', cityOrRegion: 'Brisbane' }, defaultModality: 'online',
    verificationStatus: 'verified', overallRating: 5, reviewCount: 9,
  },
  {
    id: 'counsellor_wei', linkedinUrl: 'https://www.linkedin.com/in/wei-zhang', email: 'wei@yoir.test', displayName: 'Wei Zhang', photoUrl: null,
    introduction: 'Focuses on professional presence, networking and online profiles.',
    background: 'Communications specialist working with international professionals in Australia.',
    experience: 'Rewrites profiles and builds outreach plans that actually get replies.',
    baseLocation: { state: 'WA', cityOrRegion: 'Perth' }, defaultModality: 'online',
    verificationStatus: 'pending', overallRating: 4.4, reviewCount: 23,
  },
];

interface SeedService extends Omit<Service, 'counsellor'> { counsellorId: string }

const seedServices: SeedService[] = [
  { id: 'svc_interview', counsellorId: 'counsellor_maya', title: 'Interview confidence coaching', description: 'A focused one-to-one session covering behavioural questions, confident delivery and practical feedback for your next interview.', priceMinor: 9500, currency: 'AUD', modalities: ['online'], active: true, averageRating: 4.9, reviewCount: 28 },
  { id: 'svc_resume', counsellorId: 'counsellor_jordan', title: 'Resume and cover letter review', description: 'Detailed, actionable feedback to make your application clearer, more relevant and easier for recruiters to scan.', priceMinor: 7000, currency: 'AUD', modalities: ['online', 'in_person'], location: { state: 'VIC', cityOrRegion: 'Melbourne' }, active: true, averageRating: 4.7, reviewCount: 19 },
  { id: 'svc_pivot', counsellorId: 'counsellor_priya', title: 'Career change strategy session', description: 'Map the move you are considering against your experience, then leave with a sequenced plan for the next three months.', priceMinor: 12000, currency: 'AUD', modalities: ['online'], active: true, averageRating: 4.8, reviewCount: 34 },
  { id: 'svc_graduate', counsellorId: 'counsellor_tom', title: 'Graduate job-search kickstart', description: 'For final-year students and recent graduates: where to apply, how to apply, and how to keep the search moving.', priceMinor: 5500, currency: 'AUD', modalities: ['online', 'in_person'], location: { state: 'NSW', cityOrRegion: 'Sydney' }, active: true, averageRating: 4.6, reviewCount: 12 },
  { id: 'svc_leadership', counsellorId: 'counsellor_hannah', title: 'Leadership step-up coaching', description: 'Prepare for your first people-leadership role: the selection process, the story you tell, and the first ninety days.', priceMinor: 16500, currency: 'AUD', modalities: ['online'], active: true, averageRating: 5, reviewCount: 9 },
  { id: 'svc_profile', counsellorId: 'counsellor_wei', title: 'LinkedIn profile and networking clinic', description: 'Rewrite your professional profile and build a short, realistic outreach plan you can keep up with.', priceMinor: 6500, currency: 'AUD', modalities: ['online'], active: true, averageRating: 4.4, reviewCount: 23 },
];

interface DemoState {
  counsellors: DemoCounsellor[];
  services: SeedService[];
  slots: AvailabilitySlot[];
  accounts: Record<string, { id: string; name: string; role: Role }>;
  orders: Order[];
  bookings: Booking[];
  sequence: number;
}

function seedSlots(): AvailabilitySlot[] {
  return seedServices.flatMap((service, serviceIndex) =>
    [0, 1, 3].map((offset, index) => {
      const startsAt = new Date(Date.now() + (offset + 1) * 86_400_000);
      startsAt.setHours([9, 14, 11][index], 0, 0, 0);
      return {
        id: `demo-slot-${serviceIndex}-${index}`,
        serviceId: service.id,
        startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 3_600_000).toISOString(),
        status: 'open' as const,
      };
    }),
  );
}

function initialState(): DemoState {
  return {
    counsellors: seedCounsellors.map((item) => ({ ...item })),
    services: seedServices.map((item) => ({ ...item })),
    slots: seedSlots(),
    accounts: {},
    orders: [],
    bookings: [],
    sequence: 0,
  };
}

let state = initialState();

/** Tests and the Expo dev reload use this to get a clean local dataset. */
export function resetDemoState(): void {
  state = initialState();
}

const pause = () => new Promise((resolve) => setTimeout(resolve, 300));
const nextId = (prefix: string) => `${prefix}-${(state.sequence += 1)}`;
const counsellorOf = (id: string) => state.counsellors.find((item) => item.id === id);

function toService(service: SeedService): Service {
  const owner = counsellorOf(service.counsellorId);
  const { counsellorId: _ownerId, ...rest } = service;
  return {
    ...rest,
    counsellor: {
      id: owner?.id ?? service.counsellorId,
      displayName: owner?.displayName ?? 'Yoir counsellor',
      introduction: owner?.introduction,
      verificationStatus: owner?.verificationStatus ?? 'pending',
      overallRating: owner?.overallRating ?? null,
      reviewCount: owner?.reviewCount ?? 0,
    },
  };
}

const findService = (id: string) => state.services.find((item) => item.id === id);

function requireService(id: string): SeedService {
  const service = findService(id);
  if (!service) throw new Error('Service not found.');
  return service;
}

// --- accounts and sessions ------------------------------------------------

/**
 * `roleHint` is the role chosen on the entry screen. A known account always wins,
 * but an email the store has never seen resolves to the role the visitor picked —
 * otherwise choosing "I am a Career Counsellor" and signing in with your own
 * address would drop you into the Job Seeker app.
 */
export async function demoLogin(email: string, password: string, roleHint?: Role): Promise<Session> {
  await pause();
  if (!email || !password) throw new Error('Enter your email and password.');
  const key = email.trim().toLowerCase();
  const counsellor = state.counsellors.find((item) => item.email === key);
  const registered = state.accounts[key];
  const demoCounsellor = state.counsellors[0];
  const user: User = counsellor
    ? { id: counsellor.id, name: counsellor.displayName, email, role: 'counsellor' }
    : registered
      ? { id: registered.id, name: registered.name, email, role: registered.role }
      : roleHint === 'counsellor'
        ? { id: demoCounsellor.id, name: demoCounsellor.displayName, email, role: 'counsellor' }
        : { id: 'demo-user', name: 'Demo Job Seeker', email, role: 'job_seeker' };
  return { accessToken: 'demo-access-token', expiresAt: new Date(Date.now() + 3600000).toISOString(), user };
}

export async function demoRegister(input: RegisterRequest): Promise<User> {
  await pause();
  const key = input.email.trim().toLowerCase();
  if (state.accounts[key] || state.counsellors.some((item) => item.email === key)) {
    throw apiError(409, 'EMAIL_ALREADY_REGISTERED', 'An account already exists for this email address.', {
      email: 'Use a different email address, or log in instead.',
    });
  }
  const id = input.role === 'counsellor' ? nextId('demo-counsellor') : 'demo-new-user';
  state.accounts[key] = { id, name: input.name, role: input.role };
  if (input.role === 'counsellor') {
    state.counsellors.push({
      id, email: key, displayName: input.name, photoUrl: null, linkedinUrl: '', introduction: '', background: '', experience: '',
      baseLocation: null, defaultModality: 'online', verificationStatus: 'pending', overallRating: null, reviewCount: 0,
    });
  }
  return { id: 'demo-new-user', name: input.name, email: input.email, role: input.role };
}

export async function demoLogout(): Promise<void> {
  await pause();
}

// --- marketplace ----------------------------------------------------------

export async function demoListServices(query = ''): Promise<Service[]> {
  await pause();
  const term = query.trim().toLowerCase();
  const active = state.services.filter((item) => item.active).map(toService);
  return term
    ? active.filter((item) => `${item.title} ${item.counsellor.displayName}`.toLowerCase().includes(term))
    : active;
}

export async function demoGetService(id: string): Promise<Service> {
  await pause();
  return toService(requireService(id));
}

export async function demoListSlots(serviceId: string): Promise<AvailabilitySlot[]> {
  await pause();
  return state.slots
    .filter((slot) => slot.serviceId === serviceId && slot.status === 'open')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * `displayName` is supplied when a counsellor opens their own profile: a counsellor
 * the local store has never seen starts from an empty profile rather than a 404.
 */
export async function demoGetCounsellorProfile(counsellorId: string, displayName?: string): Promise<CounsellorProfile> {
  await pause();
  let counsellor = counsellorOf(counsellorId);
  if (!counsellor && displayName) {
    counsellor = {
      id: counsellorId, email: '', displayName, photoUrl: null, linkedinUrl: '', introduction: '', background: '', experience: '',
      baseLocation: null, defaultModality: 'online', verificationStatus: 'pending', overallRating: null, reviewCount: 0,
    };
    state.counsellors.push(counsellor);
  }
  if (!counsellor) throw apiError(404, 'NOT_FOUND', 'This counsellor profile is unavailable.');
  const { email: _email, ...profile } = counsellor;
  return profile;
}

// --- booking and payment --------------------------------------------------

export async function demoCreateOrder(serviceId: string, slotId: string): Promise<Order> {
  await pause();
  const service = requireService(serviceId);
  const slot = state.slots.find((item) => item.id === slotId);
  if (slot && slot.status !== 'open') {
    throw apiError(409, 'SLOT_UNAVAILABLE', 'The selected slot is no longer available.', {
      slotId: 'Choose another available slot.',
    });
  }
  if (slot) slot.status = 'held';
  const order: Order = {
    id: nextId('demo-order'), serviceId, slotId, amountMinor: service.priceMinor,
    currency: 'AUD', status: 'awaiting_payment', paymentStatus: 'not_started',
  };
  state.orders.push(order);
  return order;
}

export async function demoCompletePayment(order: Order): Promise<StubPaymentConfirmation> {
  await pause();
  const service = requireService(order.serviceId);
  const slot = state.slots.find((item) => item.id === order.slotId);
  if (slot) slot.status = 'booked';
  const stored = state.orders.find((item) => item.id === order.id);
  if (stored) { stored.status = 'confirmed'; stored.paymentStatus = 'paid'; }
  const booking: Booking = {
    id: nextId('demo-booking'), orderId: order.id, serviceId: service.id, serviceTitle: service.title,
    startsAt: slot?.startsAt ?? new Date().toISOString(),
    endsAt: slot?.endsAt ?? new Date(Date.now() + 3_600_000).toISOString(),
    timezone: 'Australia/Sydney', modality: service.modalities[0], status: 'confirmed', paymentStatus: 'paid',
  };
  state.bookings.push(booking);
  return { paymentId: nextId('stub'), paymentStatus: 'paid', booking };
}

// --- counsellor workspace -------------------------------------------------

export async function demoUpdateCounsellorProfile(counsellorId: string, update: CounsellorProfileUpdate): Promise<CounsellorProfile> {
  await pause();
  const counsellor = counsellorOf(counsellorId);
  if (!counsellor) throw apiError(404, 'NOT_FOUND', 'This counsellor profile is unavailable.');
  Object.assign(counsellor, update);
  const { email: _email, ...profile } = counsellor;
  return profile;
}

export async function demoListOwnServices(counsellorId: string): Promise<Service[]> {
  await pause();
  return state.services.filter((item) => item.counsellorId === counsellorId).map(toService);
}

export async function demoCreateService(counsellorId: string, draft: ServiceDraft): Promise<Service> {
  await pause();
  const created: SeedService = {
    id: nextId('demo-service'), counsellorId, title: draft.title, description: draft.description,
    priceMinor: draft.priceMinor, currency: draft.currency, modalities: draft.modalities,
    ...(draft.location ? { location: draft.location } : {}),
    active: true, averageRating: null, reviewCount: 0,
  };
  state.services.push(created);
  return toService(created);
}

export async function demoListOwnSlots(counsellorId: string): Promise<AvailabilitySlot[]> {
  await pause();
  const owned = new Set(state.services.filter((item) => item.counsellorId === counsellorId).map((item) => item.id));
  return state.slots.filter((slot) => owned.has(slot.serviceId)).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function assertNoOverlap(draft: SlotDraft, ignoreId?: string): void {
  if (draft.startsAt >= draft.endsAt) {
    throw apiError(400, 'VALIDATION_ERROR', 'The start time must be before the end time.', {
      endsAt: 'Choose an end time after the start time.',
    });
  }
  const clash = state.slots.some(
    (slot) => slot.id !== ignoreId && slot.serviceId === draft.serviceId && slot.status !== 'booked'
      && draft.startsAt < slot.endsAt && slot.startsAt < draft.endsAt,
  );
  if (clash) {
    throw apiError(409, 'SLOT_OVERLAP', 'This window overlaps an availability slot you already offer.');
  }
}

export async function demoCreateSlot(draft: SlotDraft): Promise<AvailabilitySlot> {
  await pause();
  assertNoOverlap(draft);
  const slot: AvailabilitySlot = { id: nextId('demo-slot'), ...draft, status: 'open' };
  state.slots.push(slot);
  return slot;
}

export async function demoUpdateSlot(slotId: string, draft: SlotDraft): Promise<AvailabilitySlot> {
  await pause();
  const slot = state.slots.find((item) => item.id === slotId);
  if (!slot) throw apiError(404, 'NOT_FOUND', 'This availability slot no longer exists.');
  if (slot.status === 'booked') {
    throw apiError(409, 'INVALID_STATE_TRANSITION', 'A booked slot cannot be changed.');
  }
  assertNoOverlap(draft, slotId);
  Object.assign(slot, draft);
  return slot;
}

export async function demoDeleteSlot(slotId: string): Promise<void> {
  await pause();
  const index = state.slots.findIndex((item) => item.id === slotId);
  if (index < 0) throw apiError(404, 'NOT_FOUND', 'This availability slot no longer exists.');
  if (state.slots[index].status === 'booked') {
    throw apiError(409, 'INVALID_STATE_TRANSITION', 'A booked slot cannot be removed.');
  }
  state.slots.splice(index, 1);
}
