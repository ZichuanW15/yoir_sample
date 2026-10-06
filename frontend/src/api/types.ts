export type Role = 'job_seeker' | 'counsellor' | 'platform_owner';
export type Modality = 'online' | 'in_person';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  /**
   * False until the address is confirmed. Browsing and signing in stay open; what
   * is gated is booking a session and publishing a service, so the app prompts
   * rather than blocking the way in.
   */
  emailVerified: boolean;
}
export interface Session {
  accessToken: string;
  expiresAt: string;
  user: User;
  /** Exchanged for a new session so the app need not ask for a password again. */
  refreshToken?: string | null;
  /** When the sliding window closes if the session is never used again. */
  refreshExpiresAt?: string | null;
}
export interface Location { state: string; cityOrRegion: string }

export interface CounsellorSummary {
  id: string;
  displayName: string;
  introduction?: string;
  verificationStatus: VerificationStatus;
  overallRating: number | null;
  reviewCount: number;
}

export interface Service {
  id: string;
  counsellor: CounsellorSummary;
  title: string;
  description: string;
  priceMinor: number;
  /** How long the session runs; it decides which start times can be offered. */
  durationMinutes: number;
  currency: 'AUD';
  modalities: Modality[];
  location?: Location;
  active: boolean;
  averageRating: number | null;
  reviewCount: number;
  /**
   * Present only on a counsellor's own listing, never on the public one: a room URL
   * is an access credential, so the marketplace must not carry it.
   */
  meetingUrl?: string | null;
}

export interface ApiErrorBody { code: string; message: string; fieldErrors?: Record<string, string>; requestId: string }
export interface RegisterRequest { name: string; email: string; password: string; passwordConfirmation: string; role: 'job_seeker' | 'counsellor' }
/**
 * A stretch of the counsellor's own time. It names no service: availability belongs
 * to the person, and every service they offer can be booked inside it.
 */
export interface AvailabilityWindow {
  id: string;
  startsAt: string;
  endsAt: string;
  /** How the counsellor can deliver during this window; it never widens a service. */
  modalities: Modality[];
  /** True once a session is booked inside it, so shortening it may be refused. */
  hasBookings?: boolean;
}

/**
 * One time at which a particular service can be booked — derived from the
 * counsellor's windows, that service's duration and what is already taken, not a
 * stored row. Two services sharing an hour each get their own answer.
 */
export interface BookableStart { startsAt: string; endsAt: string }

export type PaymentProvider = 'stripe' | 'stub';
export type OrderStatus = 'awaiting_payment' | 'confirmed' | 'cancelled' | 'refunded_slot_taken';
export type BookingStatus = 'confirmed' | 'completed' | 'paid_out' | 'cancelled' | 'refunded';
export type PaymentStatus = 'not_started' | 'paid' | 'failed' | 'refunded' | 'partially_refunded';

/**
 * The commission and GST split, frozen by the backend when the order was created.
 * A job seeker only ever pays `totalMinor`; the rest is between the platform and
 * the counsellor, and is shown on the counsellor's side of the app.
 */
export interface BookingAmounts {
  totalMinor: number;
  sessionGstMinor: number;
  platformFeeMinor: number;
  platformFeeGstMinor: number;
  counsellorPayoutMinor: number;
}

export interface Order {
  id: string;
  serviceId: string;
  windowId: string;
  startsAt: string;
  endsAt: string;
  amountMinor: number;
  currency: 'AUD';
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /** When the slot hold lapses. The checkout timer counts down to this, not to a local guess. */
  holdExpiresAt?: string | null;
  amounts?: BookingAmounts | null;
  paymentProvider?: PaymentProvider;
  paymentIntentClientSecret?: string | null;
}

export interface Booking {
  id: string;
  orderId: string;
  serviceId: string;
  serviceTitle: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  modality: Modality;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  amountMinor?: number;
  refundedMinor?: number;
  cancelledByRole?: Role | null;
  /** Where an online session happens; null for one being held in person. */
  meetingUrl?: string | null;
  /** The other person, from this caller's side of the booking. */
  counterpartyName?: string;
  counterpartyRole?: Role | null;
  /** Where an in-person session happens, as the service advertises it. */
  meetingArea?: string;
}

export interface StubPaymentConfirmation { paymentId: string; paymentStatus: 'paid'; booking: Booking }

/** What PaymentSheet needs to collect one payment. Authorises nothing else. */
export interface PaymentIntent { paymentIntentId: string; clientSecret: string; status: string }

/** Order state plus the booking, once the Stripe webhook has confirmed it. */
export interface OrderStatusResponse { order: Order; booking: Booking | null }

/**
 * Public payment settings, read from the backend rather than bundled, so rotating a
 * Stripe key or moving between test and live needs no new app build.
 */
export interface PaymentConfig {
  provider: PaymentProvider;
  publishableKey: string | null;
  merchantDisplayName: string;
  merchantCountryCode: 'AU';
  currency: 'AUD';
  slotHoldMinutes: number;
  cancellationFullRefundHours: number;
  cancellationLateRefundPercent: number;
}

export interface CancelBookingResult { booking: Booking; refundedMinor: number; currency: 'AUD' }

/** US-47 — a single-use Stripe-hosted onboarding link; it expires within minutes. */
export interface StripeOnboarding { url: string; accountId: string }

export interface PayoutStatus {
  stripeAccountId: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  /** True until Stripe reports payoutsEnabled; the app prompts to finish setup. */
  onboardingRequired: boolean;
  abn: string | null;
  gstRegistered: boolean;
}

export interface TaxDetailsUpdate { abn: string | null; gstRegistered: boolean; legalName?: string | null }

/** The job seeker's receipt, issued in the counsellor's name under the agent model. */
export interface Receipt {
  receiptNumber: string;
  issuedAt: string;
  isTaxInvoice: boolean;
  supplierName: string;
  supplierAbn: string | null;
  buyerName: string;
  description: string;
  sessionStartsAt: string;
  totalMinor: number;
  gstMinor: number;
  currency: string;
  text: string;
}

/**
 * An in-app notification. Contract for GET /me/notifications, which the backend
 * does not serve yet; `href` is an app route to open when it is tapped.
 */
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string | null;
}

/** The job seeker's own profile. `photoUrl` is an inline data URI. */
export interface JobSeekerProfile {
  name: string;
  email: string;
  photoUrl: string | null;
  headline: string;
  careerGoals: string;
}

export type JobSeekerProfileUpdate = Omit<JobSeekerProfile, 'email'>;

/** US-30 — the professional profile a counsellor maintains. */
export interface CounsellorProfile {
  id: string;
  displayName: string;
  photoUrl: string | null;
  /** US-31 — submitted for Platform Owner review; required before a profile can be saved. */
  linkedinUrl: string;
  introduction: string;
  background: string;
  experience: string;
  /** US-30 — shown to Job Seekers before they book. */
  qualifications: string[];
  expertise: string[];
  languages: string[];
  baseLocation: Location | null;
  defaultModality: Modality;
  verificationStatus: VerificationStatus;
  overallRating: number | null;
  reviewCount: number;
}

export type CounsellorProfileUpdate = Pick<
  CounsellorProfile,
  | 'photoUrl' | 'linkedinUrl' | 'introduction' | 'background' | 'experience'
  | 'qualifications' | 'expertise' | 'languages' | 'baseLocation' | 'defaultModality'
>;

/** US-05 — first-login onboarding progress: profile setup (US-30) and verification
 * submission (US-31). `complete` is both, so the app has one flag to route on. */
export interface OnboardingState {
  profileComplete: boolean;
  verificationSubmitted: boolean;
  complete: boolean;
}

/** US-34/35/37/38 — what a counsellor sends when publishing a service. */
export interface ServiceDraft {
  title: string;
  description: string;
  priceMinor: number;
  durationMinutes: number;
  currency: 'AUD';
  modalities: Modality[];
  location: Location | null;
  /**
   * A standing room of the counsellor's own, such as a personal Zoom link. Left
   * empty, every booking is given a freshly named room generated for it.
   */
  meetingUrl?: string | null;
}

/** What a counsellor sends when editing a service they already publish. Same shape as creation. */
export type ServiceUpdate = ServiceDraft;

/** US-39 — one stretch of availability a counsellor is about to declare. */
export interface WindowDraft { startsAt: string; endsAt: string; modalities: Modality[] }


// --- administration (US-32, US-48, US-58) ---------------------------------

export interface VerificationSubmission {
  id: string;
  counsellorId: string;
  counsellorName: string;
  email: string;
  linkedInUrl: string;
  introduction: string;
  background: string;
  experience: string;
  status: VerificationStatus;
  submittedAt: string;
  decidedAt?: string | null;
  decisionReason?: string | null;
}

export interface PaymentOversight {
  paymentId: string;
  orderId: string;
  bookingId?: string | null;
  jobSeekerName: string;
  counsellorName: string;
  serviceTitle: string;
  amountMinor: number;
  platformFeeMinor: number;
  counsellorPayoutMinor: number;
  refundedMinor: number;
  currency: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  createdAt: string;
}

export interface AdminBooking {
  id: string;
  serviceTitle: string;
  jobSeekerName: string;
  counsellorName: string;
  startsAt: string;
  timezone: string;
  modality: Modality;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  amountMinor: number;
  refundedMinor: number;
}

export interface AdminCounsellor {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  verificationStatus: VerificationStatus;
  submittedAt?: string | null;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  serviceCount: number;
  bookingCount: number;
  grossMinor: number;
  payoutMinor: number;
  joinedAt: string;
}

/** US-71 — a Job Seeker as the Platform Owner sees them. */
export interface AdminJobSeeker {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  bookingCount: number;
  joinedAt: string;
}

/**
 * Totals summed from the breakdown frozen on each order when it was paid, never
 * recalculated from the current fee settings — which is what stops this dashboard
 * disagreeing with receipts already issued.
 */
export interface PlatformMoney {
  grossMinor: number;
  platformFeeMinor: number;
  platformFeeGstMinor: number;
  sessionGstMinor: number;
  counsellorPayoutMinor: number;
  refundedMinor: number;
  currency: string;
}

export interface PlatformStats {
  jobSeekers: number;
  counsellors: number;
  counsellorsPendingVerification: number;
  /** Verified but unable to be paid, so nothing they publish can be booked. */
  counsellorsAwaitingPayouts: number;
  servicesActive: number;
  bookingsByStatus: Record<string, number>;
  ordersAwaitingPayment: number;
  money: PlatformMoney;
}
