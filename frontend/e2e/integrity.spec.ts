import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

type Session = { accessToken: string; user: { id: string; role: string } };
type Service = {
  id: string;
  title: string;
  priceMinor: number;
  counsellor: { id: string; verificationStatus: string };
};

const seedEmail = 'maya@example.com';
const seedPassword = 'password123';

// The shared Playwright configuration starts the local API with its own temporary
// database. These tests use no deployment, synthetic successful response, profile
// route implementation, or direct database mutation. Chromium evidence is not
// evidence that the native iOS/Android applications have been exercised.
async function login(page: Page, email = seedEmail, password = seedPassword, landing = /\/counsellor$/): Promise<Session> {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const reply = page.waitForResponse(response => response.url().endsWith('/auth/sessions')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  const response = await reply;
  expect(response.status()).toBe(200);
  await expect(page).toHaveURL(landing);
  return response.json();
}

async function ownServices(request: APIRequestContext, accessToken: string): Promise<Service[]> {
  const result = await request.get('/api/v1/me/services', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(result.status()).toBe(200);
  return result.json();
}

async function serviceDraft(page: Page, title: string, price: string) {
  await page.getByLabel('Service title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(
    'A dedicated browser QA service for checking publication and price integrity.',
  );
  await page.getByLabel('Price (AUD)', { exact: true }).fill(price);
}

test('DEF-PROFILE-PROVENANCE: live verified identity agrees with the persisted counsellor profile', async ({ page, request }) => {
  const session = await login(page);
  const services = await ownServices(request, session.accessToken);
  const service = services.find(item => item.counsellor.id === session.user.id);
  expect(service, 'The isolated verified seed counsellor must own a real API service').toBeDefined();
  expect(service!.counsellor.verificationStatus).toBe('verified');
  await expect(page.getByRole('button', { name: `Edit ${service!.title}`, exact: true })).toBeVisible();

  await expect(page.getByText('Verified Career Professional', { exact: true })).toBeVisible();
});

test('CURRENT-IMPLEMENTATION: newly registered counsellor receives publish 403 with no saved or falsely successful service', async ({ page, request }) => {
  // Characterize the existing require_verified_counsellor boundary, not a final
  // decision that the Sprint 3 review workflow is part of Sprint 2 acceptance.
  // If the team deliberately changes that boundary, review this expectation.
  const email = `web-pending-${randomUUID()}@example.com`;
  const password = 'qa-pending-password';
  const registered = await request.post('/api/v1/auth/users', { data: {
    name: 'Pending browser counsellor', email, password, passwordConfirmation: password, role: 'counsellor',
  } });
  expect(registered.status()).toBe(201);
  // US-05 sends a first-login counsellor to onboarding, which offers no route to
  // service creation; a deep link still reaches the form, so the API must refuse.
  const session = await login(page, email, password, /\/counsellor\/onboarding$/);
  expect(session.user.role).toBe('counsellor');
  expect(await ownServices(request, session.accessToken)).toEqual([]);
  await page.goto('/counsellor');
  await expect(page).toHaveURL(/\/counsellor\/onboarding$/);
  await page.goto('/counsellor/services/new');
  const title = `Rejected pending publication ${randomUUID()}`;
  await serviceDraft(page, title, '70.50');
  const reply = page.waitForResponse(response => response.url().endsWith('/me/services')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Publish service', exact: true }).click();
  const response = await reply;
  expect(response.status()).toBe(403);
  expect((await response.json()).code).toBe('FORBIDDEN');
  await expect(page.getByRole('alert')).toContainText(/verified/i);
  await expect(page).toHaveURL(/\/counsellor\/services\/new$/);
  await expect(page.getByLabel('Service title', { exact: true })).toHaveValue(title);
  await expect(page.getByLabel('Price (AUD)', { exact: true })).toHaveValue('70.50');
  await expect(page.getByText('Service published', { exact: true })).toHaveCount(0);
  expect(await ownServices(request, session.accessToken)).toEqual([]);
  const publicResult = await request.get('/api/v1/services');
  expect(publicResult.status()).toBe(200);
  expect((await publicResult.json() as Service[]).filter(item => item.title === title)).toEqual([]);
});

test('DEF-MONEY-CENTS: real persisted cents remain visible in the marketplace and service detail @defect', async ({ page, request }) => {
  const auth = await request.post('/api/v1/auth/sessions', { data: { email: seedEmail, password: seedPassword } });
  expect(auth.status()).toBe(200);
  const session: Session = await auth.json();
  const title = `Exact cents ${randomUUID()}`;
  const created = await request.post('/api/v1/me/services', {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: { title, description: 'An actual API-created service whose price includes fifty cents.',
      priceMinor: 7050, durationMinutes: 60, currency: 'AUD', modalities: ['online'], location: null },
  });
  expect(created.status()).toBe(201);
  const service: Service = await created.json();
  const persisted = await request.get(`/api/v1/services/${service.id}`);
  expect(persisted.status()).toBe(200);
  expect((await persisted.json()).priceMinor).toBe(7050);

  await page.goto('/marketplace');
  await page.getByLabel('Search services or Career Professionals').fill(title);
  const card = page.getByRole('button', { name: `${title} by`, exact: false });
  await expect(card).toBeVisible();
  // Keep both independent display failures in the evidence instead of stopping
  // at the first screen. Do not import the production formatter as the oracle.
  await expect.soft(card).toHaveAccessibleName(/\$70\.50/);
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/services/${service.id}$`));
  await expect(page.getByText('About this service', { exact: true })).toBeVisible();
  await expect.soft(page.getByText('$70.50', { exact: true }).filter({ visible: true }).first()).toBeVisible();
});

test('DEF-PRICE-SIGN: negative browser input must not publish a positive-price service @defect', async ({ page, request }) => {
  const session = await login(page);
  const title = `Negative price ${randomUUID()}`;
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await serviceDraft(page, title, '-70.50');
  const sentPrices: number[] = [];
  page.on('request', outgoing => {
    if (outgoing.url().endsWith('/me/services') && outgoing.method() === 'POST') {
      const body = outgoing.postDataJSON() as { title: string; priceMinor: number };
      if (body.title === title) sentPrices.push(body.priceMinor);
    }
  });
  await page.getByRole('button', { name: 'Publish service', exact: true }).click();
  // A correct implementation may reject in the form or let the API reject the
  // negative value. Either is acceptable; silently removing the minus is not.
  // Soft UI assertions keep persistence and transmitted-price evidence available
  // when the current bug redirects to the dashboard after creating the service.
  await expect.soft(page.getByRole('alert')).toBeVisible();
  await expect.soft(page).toHaveURL(/\/counsellor\/services\/new$/);
  expect.soft(sentPrices.some(price => price > 0), 'The submitted minus sign must not become a positive price').toBe(false);
  const saved = await ownServices(request, session.accessToken);
  expect(saved.filter(item => item.title === title), 'Invalid negative input must not persist a service').toEqual([]);
});
