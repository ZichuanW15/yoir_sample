import {
  demoCompletePayment, demoCreateOrder, demoCreateService, demoCreateSlot, demoDeleteService, demoDeleteSlot,
  demoGetCounsellorProfile, demoGetService, demoListOwnServices, demoListOwnSlots, demoListServices,
  demoListSlots, demoLogin, demoLogout, demoRegister, demoUpdateCounsellorProfile, demoUpdateService, demoUpdateSlot,
} from './demo';
import { ApiError } from './errors';
import {
  ApiErrorBody, AvailabilitySlot, CounsellorProfile, CounsellorProfileUpdate, Order, RegisterRequest,
  Role, Service, ServiceDraft, ServiceUpdate, Session, SlotDraft, StubPaymentConfirmation, User,
  TriageRecommendation, TriageSubmission,
} from './types';

export { ApiError };

const apiUrl = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1').replace(/\/$/, '');
export const isDemoApi = process.env.EXPO_PUBLIC_USE_DEMO_API === 'true';

async function request<T>(path: string, init?: RequestInit, accessToken?: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = { code: 'NETWORK_RESPONSE_ERROR', message: 'The service returned an unexpected response.', requestId: 'unknown' };
    }
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

/**
 * The counsellor operations below are published in the interface contract but are
 * not served by the deployed backend yet. An operation whose route is missing falls
 * back to the local store so the Sprint 2 counsellor journey stays demonstrable,
 * and records itself in `preview.routes` so a screen can say plainly that it is
 * showing local data. The backend is shipping these routes one at a time, so the
 * record is per route: a live success clears only its own entry.
 */
const previewRoutes = new Set<string>();

export const preview = {
  active: false,
  routes: previewRoutes,
  reset() {
    previewRoutes.clear();
    preview.active = false;
  },
};

/**
 * The contract routes the deployed backend has not shipped yet.
 *
 * A 404 cannot be read as "this route does not exist": the API maps an unrouted path
 * and a genuinely missing resource to the same `{ code: 'NOT_FOUND' }` body, so a
 * status-only rule would answer a wrong id with invented local data. This set is the
 * explicit record instead. Delete an entry the moment its route ships — from then on
 * a 404 from it is a real missing resource and surfaces as an error.
 */
export const undeployedRoutes = new Set(['counsellorProfile', 'ownServices', 'availability']);

async function previewTriage(input: TriageSubmission): Promise<TriageRecommendation> {
  const services = await demoListServices();
  const terms: Record<TriageSubmission['goal'], string[]> = {
    direction: ['career', 'planning', 'clarity'],
    resume: ['resume', 'cv', 'application'],
    interview: ['interview', 'confidence', 'practice'],
    career_change: ['career', 'transition', 'planning'],
  };
  const wanted = terms[input.goal];
  const scored = services
    .filter((service) => input.modality === 'any' || service.modalities.includes(input.modality))
    .map((service) => ({
      service,
      score: wanted.filter((term) => `${service.title} ${service.description}`.toLowerCase().includes(term)).length,
    }))
    .sort((a, b) => b.score - a.score || (b.service.averageRating ?? 0) - (a.service.averageRating ?? 0));
  return {
    summary: `A focused ${input.goal.replace('_', ' ')} session is a useful next step for your ${input.careerStage.replace('_', ' ')} journey.`,
    suggestedSearchTerms: wanted,
    services: scored.slice(0, 3).map(({ service }) => service),
    source: 'preview',
  };
}

function isUndeployedRoute(route: string, error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status === 405 || error.status === 501) return true;
  return error.status === 404 && undeployedRoutes.has(route);
}

async function previewFallback<T>(route: string, live: () => Promise<T>, local: () => Promise<T>): Promise<T> {
  if (isDemoApi) return local();
  try {
    const result = await live();
    previewRoutes.delete(route);
    preview.active = previewRoutes.size > 0;
    return result;
  } catch (error) {
    if (!isUndeployedRoute(route, error)) throw error;
    previewRoutes.add(route);
    preview.active = true;
    return local();
  }
}

export const api = {
  /** `roleHint` only steers the local store; the deployed API derives the role itself. */
  login: (email: string, password: string, roleHint?: Role): Promise<Session> =>
    isDemoApi
      ? demoLogin(email, password, roleHint)
      : request('/auth/sessions', { method: 'POST', body: JSON.stringify({ email, password }) }),

  register: (input: RegisterRequest): Promise<User> =>
    isDemoApi ? demoRegister(input) : request('/auth/users', { method: 'POST', body: JSON.stringify(input) }),

  /** US-08 — invalidate the server session; a missing route must not block local sign-out. */
  logout: (accessToken: string): Promise<void> =>
    isDemoApi
      ? demoLogout()
      : request<void>('/auth/sessions/current', { method: 'DELETE' }, accessToken).catch(() => undefined),

  listServices: (query = ''): Promise<Service[]> =>
    isDemoApi ? demoListServices(query) : request(`/services${query.trim() ? `?query=${encodeURIComponent(query.trim())}` : ''}`),

  getService: (id: string): Promise<Service> =>
    isDemoApi ? demoGetService(id) : request(`/services/${encodeURIComponent(id)}`),

  listServiceSlots: (serviceId: string): Promise<AvailabilitySlot[]> =>
    isDemoApi ? demoListSlots(serviceId) : request(`/services/${encodeURIComponent(serviceId)}/slots`),

  createOrder: (serviceId: string, slotId: string, modality: string, timezone: string, accessToken: string): Promise<Order> =>
    isDemoApi
      ? demoCreateOrder(serviceId, slotId)
      : request('/orders', { method: 'POST', body: JSON.stringify({ serviceId, slotId, modality, timezone }) }, accessToken),

  completeStubPayment: (order: Order, accessToken: string): Promise<StubPaymentConfirmation> =>
    isDemoApi
      ? demoCompletePayment(order)
      : request(`/orders/${encodeURIComponent(order.id)}/payments/stub`, { method: 'POST' }, accessToken),

  /**
   * Planned backend boundary for the Home triage. Until POST /triage/recommendations
   * ships, a 404/405/501 produces a visibly labelled local recommendation.
   */
  getTriageRecommendations: async (input: TriageSubmission, accessToken?: string): Promise<TriageRecommendation> => {
    if (isDemoApi) return previewTriage(input);
    try {
      const result = await request<Omit<TriageRecommendation, 'source'>>(
        '/triage/recommendations',
        { method: 'POST', body: JSON.stringify(input) },
        accessToken,
      );
      return { ...result, source: 'live' };
    } catch (error) {
      const unavailable = error instanceof TypeError
        || (error instanceof ApiError && [404, 405, 501].includes(error.status));
      if (!unavailable) throw error;
      return previewTriage(input);
    }
  },

  // --- counsellor workspace (contract-published, backend pending) ---

  getOwnCounsellorProfile: (user: User, accessToken: string): Promise<CounsellorProfile> =>
    previewFallback(
      'counsellorProfile',
      () => request(`/counsellors/${encodeURIComponent(user.id)}`, undefined, accessToken),
      () => demoGetCounsellorProfile(user.id, user.name),
    ),

  updateOwnCounsellorProfile: (counsellorId: string, update: CounsellorProfileUpdate, accessToken: string): Promise<CounsellorProfile> =>
    previewFallback(
      'counsellorProfile',
      () => request('/me/counsellor-profile', { method: 'PATCH', body: JSON.stringify(update) }, accessToken),
      () => demoUpdateCounsellorProfile(counsellorId, update),
    ),

  listOwnServices: (counsellorId: string, accessToken: string): Promise<Service[]> =>
    previewFallback('ownServices', () => request('/me/services', undefined, accessToken), () => demoListOwnServices(counsellorId)),

  createService: (counsellorId: string, draft: ServiceDraft, accessToken: string): Promise<Service> =>
    previewFallback(
      'ownServices',
      () => request('/me/services', { method: 'POST', body: JSON.stringify(draft) }, accessToken),
      () => demoCreateService(counsellorId, draft),
    ),

  updateService: (serviceId: string, draft: ServiceUpdate, accessToken: string): Promise<Service> =>
    previewFallback(
      'ownServices',
      () => request(`/me/services/${encodeURIComponent(serviceId)}`, { method: 'PATCH', body: JSON.stringify(draft) }, accessToken),
      () => demoUpdateService(serviceId, draft),
    ),

  /** Soft delete: the service is deactivated rather than removed. See `demoDeleteService`. */
  deleteService: (serviceId: string, accessToken: string): Promise<void> =>
    previewFallback(
      'ownServices',
      () => request(`/me/services/${encodeURIComponent(serviceId)}`, { method: 'DELETE' }, accessToken),
      () => demoDeleteService(serviceId),
    ),

  listOwnAvailabilitySlots: (counsellorId: string, accessToken: string): Promise<AvailabilitySlot[]> =>
    previewFallback('availability', () => request('/me/availability-slots', undefined, accessToken), () => demoListOwnSlots(counsellorId)),

  createAvailabilitySlot: (draft: SlotDraft, accessToken: string): Promise<AvailabilitySlot> =>
    previewFallback(
      'availability',
      () => request('/me/availability-slots', { method: 'POST', body: JSON.stringify(draft) }, accessToken),
      () => demoCreateSlot(draft),
    ),

  updateAvailabilitySlot: (slotId: string, draft: SlotDraft, accessToken: string): Promise<AvailabilitySlot> =>
    previewFallback(
      'availability',
      () => request(`/me/availability-slots/${encodeURIComponent(slotId)}`, { method: 'PATCH', body: JSON.stringify(draft) }, accessToken),
      () => demoUpdateSlot(slotId, draft),
    ),

  deleteAvailabilitySlot: (slotId: string, accessToken: string): Promise<void> =>
    previewFallback(
      'availability',
      () => request(`/me/availability-slots/${encodeURIComponent(slotId)}`, { method: 'DELETE' }, accessToken),
      () => demoDeleteSlot(slotId),
    ),
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
