import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const password = 'qa-browser-password';

async function account(request: APIRequestContext) {
  const email = `web-${randomUUID()}@example.com`;
  const result = await request.post('/api/v1/auth/users', { data: {
    name: 'Web QA', email, password, passwordConfirmation: password, role: 'job_seeker',
  } });
  expect(result.status()).toBe(201);
  return email;
}

async function login(page: Page, email: string, route = '/auth/login', secret = password) {
  await page.goto(route);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(secret);
  const reply = page.waitForResponse(r => r.url().endsWith('/auth/sessions') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  const response = await reply;
  expect(response.status()).toBe(200);
  return response.json();
}

/** A new job seeker starts with the Yoir Diagnosis; skipping it lands on their home. */
async function skipDiagnosis(page: Page) {
  await expect(page).toHaveURL(/\/job-seeker\/diagnosis/);
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await expect(page).toHaveURL(/\/job-seeker$/);
}

test.afterEach(async ({ page }, info) => {
  await info.attach('web-screen', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
});

test('US44/45/46 public Web catalogue, search, detail and back', async ({ page, request }) => {
  const response = await request.get('/api/v1/services');
  expect(response.ok()).toBeTruthy();
  const [service] = await response.json();
  expect(service.id).toBeTruthy();
  await page.goto('/marketplace');
  await page.getByLabel('Search services or Career Professionals').fill(service.title);
  await page.getByRole('button', { name: `${service.title} by`, exact: false }).click();
  await expect(page).toHaveURL(new RegExp(`/services/${service.id}$`));
  // Expo's navigation stack retains the hidden marketplace behind this screen.
  await expect(page.getByText(service.description, { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(/\/marketplace/);
});

for (const role of ['job_seeker', 'counsellor']) {
  test(`US01/04 Web registration persists ${role}`, async ({ page, request }) => {
    const email = `web-register-${randomUUID()}@example.com`;
    await page.goto(`/auth/register?role=${role}`);
    await page.getByLabel('Full name', { exact: true }).fill('Web Registration');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByLabel('Confirm password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account', exact: true }).click();
    await expect(page.getByText('Your account is ready')).toBeVisible();
    const result = await request.post('/api/v1/auth/sessions', { data: { email, password } });
    expect(result.status()).toBe(200);
    expect((await result.json()).user.role).toBe(role);
    await page.getByRole('button', { name: 'Continue to log in' }).click();
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
  });
}

test('US03 duplicate registration remains on the form with input preserved', async ({ page, request }) => {
  const email = await account(request);
  await page.goto('/auth/register');
  await page.getByLabel('Full name', { exact: true }).fill('Duplicate QA');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password', { exact: true }).fill(password);
  const reply = page.waitForResponse(r => r.url().endsWith('/auth/users') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  expect((await reply).status()).toBe(409);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
  await expect(page.getByText('Your account is ready')).toHaveCount(0);
});

test('US07 invalid login stays anonymous and can retry', async ({ page, request }) => {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(`missing-${randomUUID()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeEnabled();
  // Failure must not leave authority behind, including after a fresh deep link.
  for (const path of ['/counsellor', '/counsellor/profile', '/counsellor/availability', '/counsellor/services/new']) {
    await page.goto(path);
    await expect(page).not.toHaveURL(/\/counsellor(?:\/|$)/);
    await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toHaveCount(0);
  }
  expect((await request.get('/api/v1/me/services')).status()).toBe(401);
  // A real corrected login must still work after the failed attempt.
  await login(page, await account(request));
  await skipDiagnosis(page);
  await expect(page.getByRole('button', { name: 'Account, Web QA', exact: true })).toBeVisible();
});

test('US06/08 Web login, logout and server-side revoked-token replay', async ({ page, request }) => {
  const session = await login(page, await account(request));
  await skipDiagnosis(page);
  await page.getByRole('button', { name: 'Account, Web QA', exact: true }).click();
  const reply = page.waitForResponse(r => r.url().endsWith('/auth/sessions/current') && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  expect((await reply).status()).toBe(204);
  await expect(page.getByRole('button', { name: 'Account, Web QA', exact: true })).toHaveCount(0);
  const replay = await request.post('/api/v1/orders/nonexistent/payments/stub', {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  expect(replay.status()).toBe(401);
});

test('US40/41/47/68 real browser booking to stub receipt (not provider acceptance)', async ({ page, request }) => {
  const services = await (await request.get('/api/v1/services')).json();
  const service = services[0];
  await login(page, 'alex@example.com', `/auth/login?serviceId=${service.id}`, 'password123');
  await expect(page.getByText('When suits you?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  await page.getByRole('radio').filter({ hasText: /min/ }).first().click();
  const orderReply = page.waitForResponse(r => r.url().endsWith('/orders') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Continue to payment' }).click();
  const orderResponse = await orderReply;
  expect(orderResponse.status()).toBe(201);
  const order = await orderResponse.json();
  await expect(page).toHaveURL(/\/bookings\/checkout/);
  const paymentReply = page.waitForResponse(r => r.url().endsWith('/payments/stub'));
  await page.getByRole('button', { name: /^Pay \$/ }).click();
  const paymentResponse = await paymentReply;
  expect(paymentResponse.status()).toBe(200);
  const receipt = await paymentResponse.json();
  expect(receipt.booking.orderId).toBe(order.id);
  expect(receipt.booking.status).toBe('confirmed');
  await expect(page.getByText("You’re booked", { exact: true })).toBeVisible();
  await expect(page.getByText(receipt.booking.id, { exact: true })).toBeVisible();
  await expect(page.getByText(/No real money was charged/)).toBeVisible();
});

test('US44 Web network failure exposes retry and recovers @injected-network', async ({ page }) => {
  // Deliberate transport fault only; recovery calls the actual local API.
  await page.route('**/api/v1/services', route => route.abort('failed'));
  await page.goto('/marketplace');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
  await page.unroute('**/api/v1/services');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('button', { name: / by .*\$/ }).first()).toBeVisible();
});

test('US34/35/37/38 counsellor Web publishing validates area and persists both delivery modes', async ({ page, request }) => {
  await login(page, 'maya@example.com', '/auth/login', 'password123');
  await expect(page).toHaveURL(/\/counsellor$/);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const title = `Web QA service ${randomUUID()}`;
  await page.getByLabel('Service title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill('A real browser test of publishing a career coaching service.');
  await page.getByLabel('Price (AUD)', { exact: true }).fill('70.50');
  await page.getByRole('checkbox', { name: 'In person', exact: true }).click();
  await page.getByRole('button', { name: 'Publish service' }).click();
  await expect(page.getByRole('alert')).toContainText('state and city');
  await page.getByRole('radio', { name: 'VIC', exact: true }).click();
  await page.getByLabel('City or region', { exact: true }).fill('Melbourne');
  const reply = page.waitForResponse(r => r.url().endsWith('/services') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Publish service' }).click();
  const created = await reply;
  expect(created.status()).toBe(201);
  const service = await created.json();
  const saved = await (await request.get(`/api/v1/services/${service.id}`)).json();
  expect(saved.title).toBe(title);
  expect(saved.priceMinor).toBe(7050);
  expect(saved.modalities.sort()).toEqual(['in_person', 'online']);
  expect(saved.location).toEqual({ state: 'VIC', cityOrRegion: 'Melbourne' });
  await expect(page).toHaveURL(/\/counsellor$/);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  // The smallest service card, not another seeded card with the same location.
  const card = page.locator('div').filter({ has: page.getByRole('button', { name: `Edit ${title}`, exact: true }) })
    .filter({ has: page.getByText(title, { exact: true }) }).last();
  await expect(card.getByText('Melbourne, VIC', { exact: true })).toBeVisible();
  await expect(card.getByText('Online', { exact: true })).toBeVisible();
  await expect(card.getByText('In person', { exact: true })).toBeVisible();
  // Reopening does not require automatic relogin (US06 leaves that undecided).
  // A new browser context proves the listing did not merely survive in React state.
  const reopened = await page.context().browser()!.newContext({ baseURL: new URL(page.url()).origin, timezoneId: 'Australia/Melbourne', locale: 'en-AU' });
  try {
    const fresh = await reopened.newPage();
    await login(fresh, 'maya@example.com', '/auth/login', 'password123');
    await expect(fresh).toHaveURL(/\/counsellor$/);
    await expect(fresh.getByText(title, { exact: true })).toBeVisible();
  } finally {
    await reopened.close();
  }
});

test('US34 counsellor publishing preserves the draft after a transport failure and retries once @injected-network', async ({ page, request }) => {
  const session = await login(page, 'maya@example.com', '/auth/login', 'password123');
  await expect(page).toHaveURL(/\/counsellor$/);
  await page.getByRole('button', { name: 'New', exact: true }).click();
  const title = `Retry publication ${randomUUID()}`;
  const description = 'The full draft must survive a transport failure while publishing a real service.';
  await page.getByLabel('Service title', { exact: true }).fill(title);
  await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByLabel('Price (AUD)', { exact: true }).fill('84.25');
  // Inject only the failed request. No synthetic successful API response is used.
  await page.route('**/api/v1/me/services', route => route.request().method() === 'POST'
    ? route.abort('failed') : route.continue());
  await page.getByRole('button', { name: 'Publish service' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Service title', { exact: true })).toHaveValue(title);
  await expect(page.getByLabel('Description', { exact: true })).toHaveValue(description);
  await expect(page.getByLabel('Price (AUD)', { exact: true })).toHaveValue('84.25');
  await expect(page.getByRole('button', { name: 'Publish service' })).toBeEnabled();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const before = await request.get('/api/v1/me/services', { headers });
  expect(before.status()).toBe(200);
  expect((await before.json()).filter((service: { title: string }) => service.title === title)).toHaveLength(0);
  await page.unroute('**/api/v1/me/services');
  const reply = page.waitForResponse(r => r.url().endsWith('/me/services') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Publish service' }).click();
  expect((await reply).status()).toBe(201);
  await expect(page).toHaveURL(/\/counsellor$/);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  const after = await request.get('/api/v1/me/services', { headers });
  expect(after.status()).toBe(200);
  const saved = (await after.json()).filter((service: { title: string }) => service.title === title);
  expect(saved).toHaveLength(1);
  expect(saved[0]).toMatchObject({ title, description, priceMinor: 8425, modalities: ['online'], location: null });
});

test('US39 real Web availability windows create, derive service starts and remove through the API', async ({ page, request }) => {
  const session = await login(page, 'maya@example.com', '/auth/login', 'password123');
  await expect(page).toHaveURL(/\/counsellor$/);
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const create = await request.post('/api/v1/me/services', { headers, data: {
    title: `Browser window lifecycle ${randomUUID()}`,
    description: 'A dedicated service for checking starts derived from shared availability.',
    priceMinor: 8800, durationMinutes: 60, currency: 'AUD', modalities: ['online'], location: null,
  } });
  expect(create.status()).toBe(201);
  const service = await create.json();
  const loaded = page.waitForResponse(r => r.url().endsWith('/me/availability-windows') && r.request().method() === 'GET');
  await page.getByRole('button', { name: 'Availability', exact: true }).click();
  expect((await loaded).status()).toBe(200);
  await expect(page.getByText('When do you work?', { exact: true })).toBeVisible();
  // Choose a day outside the seed's upcoming fortnight, in the browser's timezone.
  const futureLabel = await page.evaluate(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 15).toLocaleDateString('en-AU', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
  });
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await page.getByRole('button', { name: futureLabel, exact: true }).click();
  await expect(page.getByText('1 day, 9:00 to 12:00', { exact: true })).toBeVisible();
  const createdReply = page.waitForResponse(r => r.url().endsWith('/me/availability-windows') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Add availability', exact: true }).click();
  const createdResponse = await createdReply;
  expect(createdResponse.status()).toBe(201);
  const window = await createdResponse.json();
  expect(window).toMatchObject({ modalities: ['online', 'in_person'], hasBookings: false });
  expect(window).not.toHaveProperty('serviceId');
  const localTime = (iso: string) => new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
  expect(localTime(window.startsAt)).toBe('09:00');
  expect(localTime(window.endsAt)).toBe('12:00');
  const own = await request.get('/api/v1/me/availability-windows', { headers });
  expect(own.status()).toBe(200);
  expect((await own.json()).map((row: { id: string }) => row.id)).toContain(window.id);
  const starts = async () => {
    const response = await request.get(`/api/v1/services/${service.id}/slots?modality=online`);
    expect(response.status()).toBe(200);
    return (await response.json() as { startsAt: string; endsAt: string }[])
      .filter(row => new Date(row.startsAt).getTime() >= new Date(window.startsAt).getTime()
        && new Date(row.endsAt).getTime() <= new Date(window.endsAt).getTime());
  };
  const available = await starts();
  expect(available.length).toBeGreaterThan(1);
  expect(available.every(row => new Date(row.endsAt).getTime() - new Date(row.startsAt).getTime() === service.durationMinutes * 60_000)).toBe(true);
  const remove = page.getByRole('button', { name: new RegExp(`^Remove ${futureLabel} `) });
  await expect(remove).toBeVisible();
  await remove.click();
  await expect(page.getByText('Remove this availability?', { exact: true })).toBeVisible();
  const deletedReply = page.waitForResponse(r => r.url().endsWith(`/me/availability-windows/${window.id}`) && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Remove', exact: true }).click();
  expect((await deletedReply).status()).toBe(204);
  await expect(remove).toHaveCount(0);
  expect(await starts()).toEqual([]);
});

test('[QA-106][US08-AC3] logout prevents browser history and protected deep-link access', async ({ page, request }) => {
  // Keep a known public app page earlier in history, not the browser's blank tab.
  await page.goto('/marketplace');
  await expect(page.getByLabel('Search services or Career Professionals')).toBeVisible();
  const session = await login(page, 'maya@example.com', '/auth/login', 'password123');
  await expect(page).toHaveURL(/\/counsellor$/);
  await page.getByRole('button', { name: 'Professional profile', exact: true }).click();
  await expect(page).toHaveURL(/\/counsellor\/profile$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/counsellor$/);
  const loggedOut = page.waitForResponse(r => r.url().endsWith('/auth/sessions/current') && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Account, Maya Chen', exact: true }).click();
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  expect((await loggedOut).status()).toBe(204);
  const isPublic = async () => {
    await expect(page.getByLabel('Search services or Career Professionals')
      .or(page.getByRole('button', { name: 'Log in', exact: true }))
      .or(page.getByRole('button', { name: 'Just looking? Browse as a guest', exact: true })).first()).toBeVisible();
    await expect(page).not.toHaveURL(/\/counsellor(?:\/|$)/);
    await expect(page.getByRole('button', { name: 'Account, Maya Chen', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toHaveCount(0);
  };
  await isPublic();
  // profile was ahead of dashboard before logout: try that retained entry first.
  await page.goForward();
  await isPublic();
  await page.goBack();
  await isPublic();
  await page.goForward();
  await isPublic();
  for (const path of ['/counsellor', '/counsellor/profile', '/counsellor/availability', '/counsellor/services/new']) {
    await page.goto(path);
    await isPublic();
  }
  expect((await request.get('/api/v1/me/services', { headers: { Authorization: `Bearer ${session.accessToken}` } })).status()).toBe(401);
});

test('US45 implemented Web keyword search shows matching results and a recoverable empty state', async ({ page, request }) => {
  const response = await request.get('/api/v1/services');
  expect(response.status()).toBe(200);
  const services = await response.json();
  await page.goto('/marketplace');
  await expect(page.getByRole('button', { name: / by .*\$/ }).first()).toBeVisible();
  const search = page.getByLabel('Search services or Career Professionals');
  const service = services[0];
  await search.fill(service.title);
  await expect(page.getByRole('button', { name: `${service.title} by`, exact: false })).toBeVisible();
  await search.fill(`no-such-service-${randomUUID()}`);
  await expect(page.getByRole('button', { name: / by .*\$/ })).toHaveCount(0);
  await expect(page.getByText('No services match your search.', { exact: true })).toBeVisible();
  await search.clear();
  await expect(page.getByRole('button', { name: `${service.title} by`, exact: false })).toBeVisible();
});

test('[QA-118][US40-AC4] real empty availability has an explanatory state @defect', async ({ page, request }) => {
  const auth = await request.post('/api/v1/auth/sessions', { data: { email: 'maya@example.com', password: 'password123' } });
  expect(auth.status()).toBe(200);
  const { accessToken } = await auth.json();
  const create = await request.post('/api/v1/me/services', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { title: `Empty calendar ${randomUUID()}`, description: 'A new service with no availability for the empty-state acceptance check.', priceMinor: 7500, currency: 'AUD', durationMinutes: 60, modalities: ['online'], location: null },
  });
  expect(create.status()).toBe(201);
  const service = await create.json();
  // Remove this counsellor's windows in the isolated defect database so this is
  // genuinely empty under the shared-window model, even for a new service.
  const headers = { Authorization: `Bearer ${accessToken}` };
  const windows = await request.get('/api/v1/me/availability-windows', { headers });
  expect(windows.status()).toBe(200);
  for (const window of await windows.json()) {
    expect((await request.delete(`/api/v1/me/availability-windows/${window.id}`, { headers })).status()).toBe(204);
  }
  expect(await (await request.get(`/api/v1/services/${service.id}/slots`)).json()).toEqual([]);
  await login(page, 'alex@example.com', `/auth/login?serviceId=${service.id}`, 'password123');
  await expect(page.getByText('When suits you?')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  await expect(page.getByText(/no (?:\w+ ){0,3}(?:slots|times|sessions)|fully booked/i)).toBeVisible();
});

test('US68 forged anonymous confirmation URL must not claim success @defect', async ({ page }) => {
  const params = new URLSearchParams({ bookingId: 'does-not-exist', paymentId: 'not-paid',
    startsAt: '2026-10-01T01:00:00Z', endsAt: '2026-10-01T02:00:00Z', modality: 'online', amountMinor: '7050' });
  await page.goto(`/bookings/confirmation?${params}`);
  // A real app screen must be present before checking the negative assertion.
  await expect(page.getByRole('button', { name: 'Back to Explore' })).toBeVisible();
  await expect(page.getByText("You’re booked", { exact: true })).toHaveCount(0);
});
