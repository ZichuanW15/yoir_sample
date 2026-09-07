import {
  AvailabilitySlot,
  CounsellorProfile,
  Order,
  Service,
  Session,
  StubPaymentConfirmation,
} from '@/src/api/types';

export const sessionFixture: Session = {
  accessToken: 'test-access-token',
  expiresAt: '2026-08-28T07:00:00.000Z',
  user: {
    id: 'user-1',
    name: 'Alex Morgan',
    email: 'alex@example.com',
    role: 'job_seeker',
  },
};

export const serviceFixture: Service = {
  id: 'service-1',
  title: 'Interview confidence coaching',
  description: 'Practical interview preparation and feedback.',
  priceMinor: 9500,
  currency: 'AUD',
  modalities: ['online'],
  active: true,
  averageRating: 4.9,
  reviewCount: 28,
  counsellor: {
    id: 'counsellor-1',
    displayName: 'Maya Chen',
    introduction: 'Career counsellor specialising in interview preparation.',
    verificationStatus: 'verified',
    overallRating: 4.9,
    reviewCount: 46,
  },
};

export const slotFixture: AvailabilitySlot = {
  id: 'slot-1',
  serviceId: serviceFixture.id,
  startsAt: '2026-09-01T00:00:00.000Z',
  endsAt: '2026-09-01T01:00:00.000Z',
  status: 'open',
};

export const orderFixture: Order = {
  id: 'order-1',
  serviceId: serviceFixture.id,
  slotId: slotFixture.id,
  amountMinor: serviceFixture.priceMinor,
  currency: 'AUD',
  status: 'awaiting_payment',
  paymentStatus: 'not_started',
};

export const confirmationFixture: StubPaymentConfirmation = {
  paymentId: 'stub-payment-1',
  paymentStatus: 'paid',
  booking: {
    id: 'booking-1',
    orderId: orderFixture.id,
    serviceId: serviceFixture.id,
    serviceTitle: serviceFixture.title,
    startsAt: slotFixture.startsAt,
    endsAt: slotFixture.endsAt,
    timezone: 'Australia/Sydney',
    modality: 'online',
    status: 'confirmed',
    paymentStatus: 'paid',
  },
};

export const counsellorSessionFixture: Session = {
  accessToken: 'counsellor-access-token',
  expiresAt: '2026-08-28T07:00:00.000Z',
  user: {
    id: 'counsellor-1',
    name: 'Maya Chen',
    email: 'maya@example.com',
    role: 'counsellor',
  },
};

export const counsellorProfileFixture: CounsellorProfile = {
  id: 'counsellor-1',
  displayName: 'Maya Chen',
  photoUrl: null,
  linkedinUrl: 'https://www.linkedin.com/in/maya-chen',
  introduction: 'Career counsellor specialising in interview preparation.',
  background: 'Ten years in graduate recruitment.',
  experience: 'Coached over 400 candidates.',
  baseLocation: { state: 'VIC', cityOrRegion: 'Melbourne' },
  defaultModality: 'online',
  verificationStatus: 'verified',
  overallRating: 4.9,
  reviewCount: 46,
};
