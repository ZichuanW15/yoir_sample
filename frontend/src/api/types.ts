export type Role = 'job_seeker' | 'counsellor' | 'platform_owner';
export type Modality = 'online' | 'in_person';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface User { id: string; name: string; email: string; role: Role }
export interface Session { accessToken: string; expiresAt: string; user: User }
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
  currency: 'AUD';
  modalities: Modality[];
  location?: Location;
  active: boolean;
  averageRating: number | null;
  reviewCount: number;
}

export interface ApiErrorBody { code: string; message: string; fieldErrors?: Record<string, string>; requestId: string }
export interface RegisterRequest { name: string; email: string; password: string; passwordConfirmation: string; role: 'job_seeker' | 'counsellor' }
export interface AvailabilitySlot { id: string; serviceId: string; startsAt: string; endsAt: string; status: 'open' | 'held' | 'booked' }
export interface Order { id: string; serviceId: string; slotId: string; amountMinor: number; currency: 'AUD'; status: 'awaiting_payment' | 'confirmed' | 'cancelled'; paymentStatus: 'not_started' | 'paid' | 'failed' }
export interface Booking { id: string; orderId: string; serviceId: string; serviceTitle: string; startsAt: string; endsAt: string; timezone: string; modality: Modality; status: 'confirmed'; paymentStatus: 'paid' }
export interface StubPaymentConfirmation { paymentId: string; paymentStatus: 'paid'; booking: Booking }

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
  baseLocation: Location | null;
  defaultModality: Modality;
  verificationStatus: VerificationStatus;
  overallRating: number | null;
  reviewCount: number;
}

export type CounsellorProfileUpdate = Pick<
  CounsellorProfile,
  'photoUrl' | 'linkedinUrl' | 'introduction' | 'background' | 'experience' | 'baseLocation' | 'defaultModality'
>;

/** US-34/35/37/38 — what a counsellor sends when publishing a service. */
export interface ServiceDraft {
  title: string;
  description: string;
  priceMinor: number;
  currency: 'AUD';
  modalities: Modality[];
  location: Location | null;
}

/** What a counsellor sends when editing a service they already publish. Same shape as creation. */
export type ServiceUpdate = ServiceDraft;

/** US-39 — one bookable window on a counsellor's weekly calendar. */
export interface SlotDraft { serviceId: string; startsAt: string; endsAt: string }
