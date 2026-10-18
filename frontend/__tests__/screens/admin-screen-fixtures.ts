/** Deterministic component fixtures only; persistence and role enforcement are API evidence. */
import { AdminBooking, AdminCounsellor, AdminJobSeeker, PaymentOversight, PlatformStats, Session, VerificationSubmission } from '@/src/api/types';

export const ownerSession: Session = {
  accessToken: 'owner-access-token', expiresAt: '2030-01-01T00:00:00Z',
  user: { id: 'owner-1', name: 'Platform Owner', email: 'owner@example.com', role: 'platform_owner', emailVerified: true },
};
export const payment: PaymentOversight = {
  paymentId: 'payment-qa-1', orderId: 'order-qa-1', bookingId: 'booking-qa-1',
  jobSeekerName: 'Alex Morgan', counsellorName: 'Maya Chen', serviceTitle: 'Admin QA coaching',
  amountMinor: 9525, platformFeeMinor: 1429, counsellorPayoutMinor: 8096, refundedMinor: 1250,
  currency: 'AUD', paymentStatus: 'partially_refunded', orderStatus: 'confirmed', createdAt: '2026-10-10T01:00:00Z',
};
export const adminBooking: AdminBooking = {
  id: 'booking-qa-1', serviceTitle: payment.serviceTitle, jobSeekerName: payment.jobSeekerName, counsellorName: payment.counsellorName,
  startsAt: '2026-10-18T00:30:00Z', timezone: 'Australia/Melbourne', modality: 'online', status: 'confirmed',
  paymentStatus: 'paid', amountMinor: 9525, refundedMinor: 1250,
};
export const submission: VerificationSubmission = {
  id: 'submission-qa-1', counsellorId: 'professional-qa-1', counsellorName: 'Maya Chen', email: 'maya@example.com',
  linkedInUrl: 'https://www.linkedin.com/in/maya-qa', introduction: 'Practical career coaching.',
  background: 'Recruitment and training.', experience: 'Ten years of coaching.', status: 'pending', submittedAt: '2026-10-10T02:00:00Z',
};
export const adminProfessional: AdminCounsellor = {
  id: 'professional-qa-1', name: 'Maya Chen', email: 'maya@example.com', emailVerified: true, verificationStatus: 'verified',
  payoutsEnabled: false, chargesEnabled: false, serviceCount: 2, bookingCount: 3, grossMinor: 9525, payoutMinor: 8096,
  joinedAt: '2026-10-01T00:00:00Z',
};
export const adminSeeker: AdminJobSeeker = {
  id: 'seeker-qa-1', name: 'Alex Morgan', email: 'alex@example.com', emailVerified: false,
  bookingCount: 1, joinedAt: '2026-10-02T00:00:00Z',
};
export const platformStats: PlatformStats = {
  jobSeekers: 3, counsellors: 2, counsellorsPendingVerification: 1, counsellorsAwaitingPayouts: 1, servicesActive: 4,
  bookingsByStatus: { confirmed: 2, completed: 1 }, ordersAwaitingPayment: 1,
  money: { grossMinor: 10025, platformFeeMinor: 1429, platformFeeGstMinor: 130, sessionGstMinor: 866,
    counsellorPayoutMinor: 8096, refundedMinor: 1250, currency: 'AUD' },
};
