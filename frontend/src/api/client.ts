import { adoptSession, currentSession, platformClient, refreshOnce } from './authBridge';
import { ApiError } from './errors';
import {
  AdminBooking, AdminCounsellor, AdminJobSeeker,
  ApiErrorBody, AvailabilityWindow, BookableStart, CancelBookingResult, Booking, CounsellorProfile, CounsellorProfileUpdate,
  OnboardingState,
  Order, OrderStatusResponse, PaymentConfig, PaymentIntent, PaymentOversight, PayoutStatus,
  PlatformStats, Receipt, RegisterRequest,
  Role, Service, ServiceDraft, ServiceUpdate, Session, StripeOnboarding,
  StubPaymentConfirmation, TaxDetailsUpdate, User, VerificationSubmission, WindowDraft,
  JobSeekerProfile, JobSeekerProfileUpdate, AppNotification, PrivacySettings, ProfileVisibility, Review, ReviewDraft,
} from './types';

export { ApiError };

const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');

function send(path: string, init?: RequestInit, accessToken?: string): Promise<Response> {
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
}

/**
 * Exchange the stored refresh token for a new session, at most once at a time.
 *
 * Returns the new access token, or null when there is nothing to refresh with and
 * the person genuinely has to sign in again — in which case the local session is
 * dropped so the app stops showing signed-in screens it cannot serve.
 */
async function refreshAccessToken(): Promise<string | null> {
  const session = currentSession();
  if (!session?.refreshToken) return null;

  const renewed = await refreshOnce(async () => {
    const response = await send('/auth/sessions/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: session.refreshToken, client: platformClient }),
    });
    if (!response.ok) {
      // The token is spent, revoked or expired. Nothing to recover.
      adoptSession(null);
      return null;
    }
    const next = (await response.json()) as Session;
    adoptSession(next);
    return next;
  });
  return renewed?.accessToken ?? null;
}

async function request<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  let response = await send(path, init, accessToken);

  // An access token lives an hour; a session lives far longer. A 401 on a call that
  // carried a token normally means only that the short one lapsed, so it is renewed
  // and the original request retried — once. A second 401 is a real rejection.
  if (response.status === 401 && accessToken && !path.startsWith('/auth/')) {
    const renewed = await refreshAccessToken();
    if (renewed) response = await send(path, init, renewed);
  }

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = { code: 'NETWORK_RESPONSE_ERROR', message: 'The service returned an unexpected response.', requestId: 'unknown' };
    }
    throw new ApiError(response.status, body);
  }
  // Whether there is a body to parse is not something the status code can be
  // trusted for: 204 says so, but the generic "accepted" replies answer 202 with an
  // empty body too, and calling json() on one throws "Unexpected end of JSON input"
  // where the caller expected a resolved promise. The Content-Type is what actually
  // reports whether a body was sent.
  if (response.status === 204 || response.status === 205) return undefined as T;
  if (!(response.headers?.get('content-type') ?? '').includes('json')) return undefined as T;
  return response.json() as Promise<T>;
}

type CounsellorProfileResponse = Omit<CounsellorProfile, 'overallRating'> & {
  overallRating?: number | null;
};

/** The API omits nullable fields, while screens consume an explicit null. */
const normaliseCounsellorProfile = ({ overallRating, ...profile }: CounsellorProfileResponse): CounsellorProfile => ({
  ...profile,
  overallRating: overallRating ?? null,
});



export const api = {
  /** `roleHint` only steers the local store; the deployed API derives the role itself. */
  login: (email: string, password: string, roleHint?: Role): Promise<Session> =>
    request('/auth/sessions', {
          method: 'POST',
          // The platform decides how long the server lets the session slide.
          body: JSON.stringify({ email, password, client: platformClient }),
        }),

  register: (input: RegisterRequest): Promise<User> =>
    request('/auth/users', { method: 'POST', body: JSON.stringify(input) }),

  /** US-08 — invalidate the server session; a missing route must not block local sign-out. */
  logout: (accessToken: string, refreshToken?: string | null): Promise<void> =>
    request<void>(
          '/auth/sessions/current',
          // Without the refresh token the session could simply be minted again, so
          // signing out has to name it too.
          { method: 'DELETE', body: JSON.stringify({ refreshToken: refreshToken ?? null }) },
          accessToken,
        ).catch(() => undefined),

  listServices: (query = ''): Promise<Service[]> =>
    request(`/services${query.trim() ? `?query=${encodeURIComponent(query.trim())}` : ''}`),

  getService: (id: string): Promise<Service> =>
    request(`/services/${encodeURIComponent(id)}`),

  /** When this service can be booked. Derived server-side from the counsellor's
   *  windows and this service's duration, so it changes as bookings are made. */
  listServiceSlots: (serviceId: string, modality?: string): Promise<BookableStart[]> =>
    request(
      `/services/${encodeURIComponent(serviceId)}/slots`
      + (modality ? `?modality=${encodeURIComponent(modality)}` : ''),
    ),

  /** `startsAt` is the chosen time; its end follows from the service's duration. */
  createOrder: (serviceId: string, startsAt: string, modality: string, timezone: string, accessToken: string): Promise<Order> =>
    request('/orders', { method: 'POST', body: JSON.stringify({ serviceId, startsAt, modality, timezone }) }, accessToken),

  completeStubPayment: (order: Order, accessToken: string): Promise<StubPaymentConfirmation> =>
    request(`/orders/${encodeURIComponent(order.id)}/payments/stub`, { method: 'POST' }, accessToken),

  // --- payments (US-47) ---------------------------------------------------

  /**
   * Whether this backend takes card payments, and the publishable key to do it with.
   * Fetched rather than bundled so a key rotation does not need a new app build.
   */
  getPaymentConfig: (): Promise<PaymentConfig> =>
    request('/payments/config'),

  /**
   * Open the Stripe payment for an order that is already holding its slot. Safe to
   * call again after a dropped connection: the backend keys it on the order, so
   * Stripe replays the same PaymentIntent rather than opening a second charge.
   */
  createPaymentIntent: (orderId: string, accessToken: string): Promise<PaymentIntent> =>
    request(`/orders/${encodeURIComponent(orderId)}/payment-intents`, { method: 'POST' }, accessToken),

  /**
   * The source of truth after PaymentSheet closes. PaymentSheet succeeding only means
   * Stripe accepted the card; the booking exists once the backend has processed the
   * webhook, which is what this reports.
   */
  getOrderStatus: (orderId: string, accessToken: string): Promise<OrderStatusResponse> =>
    request(`/orders/${encodeURIComponent(orderId)}`, undefined, accessToken),

  listMyBookings: (accessToken: string): Promise<Booking[]> =>
    request('/me/bookings', undefined, accessToken),

  cancelBooking: (bookingId: string, reason: string | null, accessToken: string): Promise<CancelBookingResult> =>
    request(
          `/bookings/${encodeURIComponent(bookingId)}/cancel`,
          { method: 'POST', body: JSON.stringify({ reason }) },
          accessToken,
        ),

  getBooking: (bookingId: string, accessToken: string): Promise<Booking> =>
    request(`/bookings/${encodeURIComponent(bookingId)}`, {}, accessToken),

  getBookingReceipt: (bookingId: string, accessToken: string): Promise<Receipt> =>
    request(`/bookings/${encodeURIComponent(bookingId)}/receipt`, undefined, accessToken),

  /** US-53 — the backend enforces completed ownership and one review per booking. */
  createReview: (bookingId: string, draft: ReviewDraft, accessToken: string): Promise<Review> =>
    request(`/bookings/${encodeURIComponent(bookingId)}/review`, { method: 'POST', body: JSON.stringify(draft) }, accessToken),

  // --- counsellor payouts (US-47) ----------------------------------------

  getPayoutStatus: (accessToken: string): Promise<PayoutStatus> =>
    request('/me/payout-status', undefined, accessToken),

  /**
   * Always returns a new link: Account Links are single-use and expire in minutes.
   * `returnTo` says where this platform wants the counsellor back; the backend
   * honours it only for the app's own scheme or an origin it serves.
   */
  startStripeOnboarding: (accessToken: string, returnTo?: string): Promise<StripeOnboarding> =>
    request('/me/stripe-onboarding', { method: 'POST', body: JSON.stringify({ returnTo: returnTo ?? null }) }, accessToken),

  updateTaxDetails: (update: TaxDetailsUpdate, accessToken: string): Promise<PayoutStatus> =>
    request('/me/tax-details', { method: 'PUT', body: JSON.stringify(update) }, accessToken),

  // --- notifications -------------------------------------------------------

  /**
   * In-app notifications, newest first. The backend has not built this route yet:
   * until it does, a missing route reads as "none", so turning it on needs no
   * change here.
   */
  listNotifications: async (accessToken: string): Promise<AppNotification[]> => {
    try {
      return await request<AppNotification[]>('/me/notifications', undefined, accessToken);
    } catch (error) {
      if (error instanceof ApiError && [404, 405, 501].includes(error.status)) return [];
      throw error;
    }
  },

  markNotificationRead: (id: string, accessToken: string): Promise<void> =>
    request(`/me/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' }, accessToken),

  // --- job seeker profile -----------------------------------------------

  getJobSeekerProfile: (accessToken: string): Promise<JobSeekerProfile> =>
    request('/me/job-seeker-profile', undefined, accessToken),

  /** The whole profile. `photoUrl` is a data URI, or null to remove the photo. */
  updateJobSeekerProfile: (update: JobSeekerProfileUpdate, accessToken: string): Promise<JobSeekerProfile> =>
    request('/me/job-seeker-profile', { method: 'PATCH', body: JSON.stringify(update) }, accessToken),

  /** US-27 — shared by Job Seekers and Career Professionals. */
  getPrivacySettings: (accessToken: string): Promise<PrivacySettings> =>
    request('/me/profile-visibility', undefined, accessToken),

  updateProfileVisibility: (visibility: ProfileVisibility, accessToken: string): Promise<PrivacySettings> =>
    request('/me/profile-visibility', { method: 'PATCH', body: JSON.stringify({ visibility }) }, accessToken),

  // --- counsellor workspace (contract-published, backend pending) ---

  /** The Career Professionals a Job Seeker can book: the people behind Explore's services. */
  listCounsellors: async (): Promise<CounsellorProfile[]> =>
    (await request<CounsellorProfileResponse[]>('/counsellors')).map(normaliseCounsellorProfile),

  /** A Career Professional's public profile: what a Job Seeker reads before booking. */
  getCounsellorProfile: async (counsellorId: string): Promise<CounsellorProfile> =>
    normaliseCounsellorProfile(await request<CounsellorProfileResponse>(`/counsellors/${encodeURIComponent(counsellorId)}`)),

  getOwnCounsellorProfile: (user: User, accessToken: string): Promise<CounsellorProfile> =>
    request('/me/counsellor-profile', undefined, accessToken),

  updateOwnCounsellorProfile: (counsellorId: string, update: CounsellorProfileUpdate, accessToken: string): Promise<CounsellorProfile> =>
    request('/me/counsellor-profile', { method: 'PATCH', body: JSON.stringify(update) }, accessToken),

  /** US-05 — whether first-login onboarding (profile setup, verification submission) is done. */
  getOnboardingState: (accessToken: string): Promise<OnboardingState> =>
    request('/me/onboarding-state', undefined, accessToken),

  listOwnServices: (counsellorId: string, accessToken: string): Promise<Service[]> =>
    request('/me/services', undefined, accessToken),

  createService: (counsellorId: string, draft: ServiceDraft, accessToken: string): Promise<Service> =>
    request('/me/services', { method: 'POST', body: JSON.stringify(draft) }, accessToken),

  updateService: (serviceId: string, draft: ServiceUpdate, accessToken: string): Promise<Service> =>
    request(`/me/services/${encodeURIComponent(serviceId)}`, { method: 'PATCH', body: JSON.stringify(draft) }, accessToken),

  /** Soft delete: the service is deactivated rather than removed. See `demoDeleteService`. */
  deleteService: (serviceId: string, accessToken: string): Promise<void> =>
    request(`/me/services/${encodeURIComponent(serviceId)}`, { method: 'DELETE' }, accessToken),

  // --- US-39: the counsellor's calendar -----------------------------------
  // Windows, not per-service slots: one stretch of time serves every service they
  // offer, and booking any of them consumes it for all.

  listOwnAvailabilityWindows: (counsellorId: string, accessToken: string): Promise<AvailabilityWindow[]> =>
    request('/me/availability-windows', undefined, accessToken),

  createAvailabilityWindow: (draft: WindowDraft, accessToken: string): Promise<AvailabilityWindow> =>
    request('/me/availability-windows', { method: 'POST', body: JSON.stringify(draft) }, accessToken),

  updateAvailabilityWindow: (windowId: string, draft: Partial<WindowDraft>, accessToken: string): Promise<AvailabilityWindow> =>
    request(`/me/availability-windows/${encodeURIComponent(windowId)}`, { method: 'PATCH', body: JSON.stringify(draft) }, accessToken),

  deleteAvailabilityWindow: (windowId: string, accessToken: string): Promise<void> =>
    request(`/me/availability-windows/${encodeURIComponent(windowId)}`, { method: 'DELETE' }, accessToken),

  // --- confirming an address, and recovering an account --------------------

  /** Spends the link and hands back a session: the link is itself proof of ownership. */
  verifyEmail: (token: string): Promise<Session> =>
    request('/auth/email-verifications', { method: 'POST', body: JSON.stringify({ token }) }),

  /** Always resolves, whether or not the address has an account. */
  requestEmailVerification: (email: string): Promise<void> =>
    request<void>('/auth/email-verification-requests', { method: 'POST', body: JSON.stringify({ email }) }),

  requestPasswordReset: (email: string): Promise<void> =>
    request<void>('/auth/password-reset-requests', { method: 'POST', body: JSON.stringify({ email }) }),

  /** Sets a new password and ends every other session, on every device. */
  resetPassword: (token: string, password: string, passwordConfirmation: string): Promise<void> =>
    request<void>('/auth/password-resets', {
      method: 'POST',
      body: JSON.stringify({ token, password, passwordConfirmation }),
    }),

  submitVerification: (linkedInUrl: string, accessToken: string): Promise<VerificationSubmission> =>
    request('/me/verification-submissions', { method: 'POST', body: JSON.stringify({ linkedInUrl }) }, accessToken),

  // --- administration ------------------------------------------------------

  getPlatformStats: (accessToken: string): Promise<PlatformStats> =>
    request('/admin/stats', {}, accessToken),

  listVerificationSubmissions: (status: string, accessToken: string): Promise<VerificationSubmission[]> =>
    request(`/admin/verifications?status=${encodeURIComponent(status)}`, {}, accessToken),

  decideVerification: (
    submissionId: string,
    decision: 'verified' | 'rejected',
    reason: string,
    accessToken: string,
  ): Promise<VerificationSubmission> =>
    request(
      `/admin/verifications/${encodeURIComponent(submissionId)}/decision`,
      { method: 'POST', body: JSON.stringify({ decision, reason }) },
      accessToken,
    ),

  listPaymentOversight: (accessToken: string): Promise<PaymentOversight[]> =>
    request('/admin/payments', {}, accessToken),

  listAllBookings: (accessToken: string): Promise<AdminBooking[]> =>
    request('/admin/bookings', {}, accessToken),

  listAllCounsellors: (accessToken: string): Promise<AdminCounsellor[]> =>
    request('/admin/counsellors', {}, accessToken),

  listAllJobSeekers: (accessToken: string): Promise<AdminJobSeeker[]> =>
    request('/admin/job-seekers', {}, accessToken),
};

/** Field-level errors published by the API, keyed by the form field they belong to. */
export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? (error.body.fieldErrors ?? {}) : {};
}

export function userFacingError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.body.code === 'INVALID_CREDENTIALS') return 'The email or password is incorrect.';
    return error.body.message || 'Something went wrong. Please try again.';
  }
  if (error instanceof TypeError) return 'We could not reach Yoir. Check your connection and try again.';
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
