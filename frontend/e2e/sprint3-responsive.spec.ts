import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';

// These cases deliberately resize their viewport. They verify the breakpoint
// and desktop controls, including when launched by a phone-browser project.
// Accounts are seeded by the isolated real API; successful responses are not mocked.
const password = 'qa-browser-fixture-password';
type Session = { accessToken: string; user: { id: string; name: string; role: string } };
const headers = (session: Session) => ({ Authorization: `Bearer ${session.accessToken}` });

// Same UI login boundary as the existing Sprint 3 workflow cases.
async function login(page: Page, key: 'buyer' | 'reviewer' | 'admin'): Promise<Session> {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(`qa-s3-${key}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const pending = page.waitForResponse(response => response.url().endsWith('/auth/sessions')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  const session: Session = await response.json();
  await expect(page).not.toHaveURL(/\/auth\/login/);
  return session;
}

test.afterEach(async ({ page }, info) => {
  await info.attach('responsive-browser-screen', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  });
});

test('US01/04 registration preserves its role and complete draft across the 1024px breakpoint', async ({ page }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 1023, height: 900 });
  await page.goto('/auth/register?role=job_seeker');
  const email = `qa-responsive-${randomUUID()}@example.com`;
  const name = 'Responsive draft owner';
  const secret = 'responsive-draft-password';
  const registrationRequests: unknown[] = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/v1/auth/users' && request.method() === 'POST') {
      registrationRequests.push(request.postDataJSON());
    }
  });
  await page.getByRole('radio', { name: 'Career Professional', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(secret);
  await page.getByLabel('Confirm password', { exact: true }).fill(secret);

  for (const width of [1023, 1024, 1023]) {
    await page.setViewportSize({ width, height: 900 });
    const desktopBrand = page.getByText('Secure payment through Yoir', { exact: true });
    if (width === 1024) await expect(desktopBrand).toBeVisible();
    else await expect(desktopBrand).toHaveCount(0);
    await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(name);
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue(secret);
    await expect(page.getByLabel('Confirm password', { exact: true })).toHaveValue(secret);
    await expect(page).toHaveURL(/\/auth\/register\?role=job_seeker$/);
  }
  expect(registrationRequests).toHaveLength(0);
  const registered = page.waitForResponse(response => response.url().endsWith('/auth/users')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  expect((await registered).status()).toBe(201);
  await expect(page.getByText('Your account is ready', { exact: true })).toBeVisible();
  expect(registrationRequests).toEqual([{
    name, email, password: secret, passwordConfirmation: secret, role: 'counsellor',
  }]);
});

const roles = [
  {
    key: 'buyer', role: 'job_seeker',
    hiddenLink: 'Workspace',
    links: [
      { label: 'Explore', path: /\/marketplace$/ },
      { label: 'My sessions', path: /\/bookings$/ },
      { label: 'Home', path: /\/job-seeker(?:\/diagnosis)?$/ },
    ],
  },
  {
    key: 'reviewer', role: 'counsellor',
    hiddenLink: 'Users',
    links: [
      { label: 'Workspace', path: /\/counsellor$/ },
      { label: 'My sessions', path: /\/bookings$/ },
      { label: 'Availability', path: /\/counsellor\/availability$/ },
      { label: 'Profile', path: /\/counsellor\/profile$/ },
      { label: 'Verification', path: /\/counsellor\/verification$/ },
    ],
  },
  {
    key: 'admin', role: 'platform_owner',
    hiddenLink: 'Availability',
    links: [
      { label: 'Overview', path: /\/admin$/ },
      { label: 'Verifications', path: /\/admin\/verifications$/ },
      { label: 'Users', path: /\/admin\/counsellors$/ },
      { label: 'Bookings', path: /\/admin\/bookings$/ },
      { label: 'Payments', path: /\/admin\/payments$/ },
    ],
  },
] as const;

for (const role of roles) {
  test(`US07/08 ${role.role} desktop sidebar navigates its sections and logs out through the account menu`, async ({ page, request }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 1280, height: 900 });
    const session = await login(page, role.key);
    expect(session.user.role).toBe(role.role);
    const navigation = page.getByRole('navigation');
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole('link', { name: role.hiddenLink, exact: true })).toHaveCount(0);
    for (const link of role.links) {
      await navigation.getByRole('link', { name: link.label, exact: true }).click();
      await expect(page).toHaveURL(link.path);
    }

    await page.getByRole('button', { name: `Account, ${session.user.name}`, exact: true }).click();
    await expect(page.getByRole('button', { name: 'Log out', exact: true })).toBeVisible();
    const revoked = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/api/v1/auth/sessions/current'
      && response.request().method() === 'DELETE');
    await page.getByRole('button', { name: 'Log out', exact: true }).click();
    expect((await revoked).status()).toBe(204);
    // US08 permits the public entry or login screen; AdminShell redirects a
    // cleared administrator session to login. Both must be anonymous below.
    await expect(page).toHaveURL(url => url.pathname === '/' || url.pathname === '/auth/login');
    await expect(page.getByRole('button', { name: `Account, ${session.user.name}`, exact: true }))
      .toHaveCount(0);
    const denied = await request.get('/api/v1/me/bookings', { headers: headers(session) });
    expect(denied.status()).toBe(401);
    await page.goto('/marketplace');
    await expect(page.getByText('Browsing as a guest', { exact: true })).toBeVisible();
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Explore', exact: true }))
      .toBeVisible();
  });
}

test('US36 desktop delete confirmation preserves an unsaved draft on cancel and withdraws only on confirm', async ({ page, request }) => {
  test.setTimeout(45000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const seller = await login(page, 'reviewer');
  const title = `Responsive delete ${randomUUID().slice(0, 8)}`;
  const created = await request.post('/api/v1/me/services', {
    headers: headers(seller), data: { title, description: 'Dedicated desktop confirmation fixture.',
      priceMinor: 9500, currency: 'AUD', durationMinutes: 60, modalities: ['online'], location: null },
  });
  expect(created.status()).toBe(201);
  const service = await created.json();
  let deleteRequests = 0;
  page.on('request', request => {
    if (new URL(request.url()).pathname === `/api/v1/me/services/${service.id}`
      && request.method() === 'DELETE') deleteRequests += 1;
  });
  await page.goto(`/counsellor/services/${service.id}/edit`);
  await expect(page.getByLabel('Service title', { exact: true })).toHaveValue(title);
  const draft = `${title} unsaved`;
  await page.getByLabel('Service title', { exact: true }).fill(draft);
  await page.getByRole('button', { name: 'Delete service', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Delete this service?', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Delete this service?', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Service title', { exact: true })).toHaveValue(draft);
  expect(deleteRequests).toBe(0);
  const retained = await request.get(`/api/v1/services/${service.id}`);
  expect(retained.status()).toBe(200);
  expect(await retained.json()).toMatchObject({ title });

  await page.getByRole('button', { name: 'Delete service', exact: true }).click();
  const deleted = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/v1/me/services/${service.id}`
    && response.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  expect((await deleted).status()).toBe(204);
  await expect(page).toHaveURL(/\/counsellor$/);
  expect(deleteRequests).toBe(1);
  expect((await request.get(`/api/v1/services/${service.id}`)).status()).toBe(404);
});


test('DEF-REGISTER-WEB-CHECKED: selected account role exposes its checked state @defect', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/auth/register?role=job_seeker');
  const professional = page.getByRole('radio', { name: 'Career Professional', exact: true });
  await professional.click();
  await expect(professional).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Job Seeker', exact: true }))
    .toHaveAttribute('aria-checked', 'false');
});

test('DEF-DESKTOP-NAV-CURRENT: the active sidebar link exposes the current page @defect', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, 'buyer');
  const explore = page.getByRole('navigation').getByRole('link', { name: 'Explore', exact: true });
  await explore.click();
  await expect(page).toHaveURL(/\/marketplace$/);
  await expect(explore).toHaveAttribute('aria-current', 'page');
});
