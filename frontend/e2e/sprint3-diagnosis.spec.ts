import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

// Real exported Web UI + isolated local API. Diagnosis answers currently stay
// in this browser; these tests do not claim server-confirmed/cross-device saves.
const password = 'sprint3-qa-password';

async function register(request: APIRequestContext) {
  const email = `sprint3-${randomUUID()}@example.com`;
  const response = await request.post('/api/v1/auth/users', { data: {
    name: 'Sprint3 QA', email, password, passwordConfirmation: password, role: 'job_seeker',
  } });
  expect(response.status()).toBe(201);
  return email;
}

async function login(page: Page, email: string, secret = password) {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(secret);
  const response = page.waitForResponse(r => r.url().endsWith('/auth/sessions') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  expect((await response).status()).toBe(200);
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Account, Sprint3 QA', exact: true }).click();
  const response = page.waitForResponse(r => r.url().endsWith('/auth/sessions/current') && r.request().method() === 'DELETE');
  await page.getByRole('button', { name: 'Log out', exact: true }).click();
  expect((await response).status()).toBe(204);
}

async function complete(page: Page, challenge = 'Resume') {
  await page.getByRole('radio', { name: 'Looking for a job', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('radio', { name: 'Improve my resume/application', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  // Empty multi-select answers are valid; single-select answers are required.
  await expect(page.getByText('What have you tried so far?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('radio', { name: challenge, exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'See my Yoir Direction', exact: true }).click();
  await expect(page.getByText('Your Yoir Direction', { exact: true })).toBeVisible();
}

test.afterEach(async ({ page }, info) => {
  await info.attach('sprint3-web-screen', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  });
});

test('US09/10/11 local Web diagnosis validates, resumes after login and isolates accounts', async ({ page, request }) => {
  const first = await register(request);
  const second = await register(request);
  await login(page, first);
  await expect(page).toHaveURL(/\/job-seeker\/diagnosis/);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Choose an option to continue.');
  await expect(page.getByRole('progressbar', { name: 'Step 1 of 6' })).toBeVisible();
  await page.getByRole('radio', { name: 'Something else', exact: true }).click();
  await page.getByLabel('Tell us a little more (optional)', { exact: true }).fill('Returning after caring for family');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Step 2 of 6' })).toBeVisible();
  await logout(page);

  // Same storage partition, different account: no previous person's answers.
  await login(page, second);
  await expect(page.getByRole('progressbar', { name: 'Step 1 of 6' })).toBeVisible();
  await expect(page.getByLabel('Tell us a little more (optional)', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await logout(page);

  await login(page, first);
  await page.getByRole('button', { name: 'Continue the Yoir Diagnosis', exact: true }).click();
  await expect(page.getByRole('progressbar', { name: 'Step 2 of 6' })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  // The conditional field and its saved value establish the selected answer.
  // Native accessibilityState is not reliably exposed as aria-checked on Web;
  // the separate accessibility defect case keeps that finding visible.
  await expect(page.getByLabel('Tell us a little more (optional)', { exact: true })).toHaveValue('Returning after caring for family');
});

test('US12/13 local direction leads through a real professional and service to a stub booking', async ({ page, request }, info) => {
  // Booking requires a verified email. The owned seed supplies that explicit
  // precondition; email-provider delivery is outside this diagnosis journey.
  const email = 'alex@example.com';
  const secret = 'password123';
  await login(page, email, secret);
  await complete(page);
  await expect(page.getByText('Resume and applications', { exact: true })).toBeVisible();
  await expect(page.getByText('Suggested next steps', { exact: true })).toBeVisible();
  const professional = page.getByRole('button', { name: /, Career Professional$/ }).first();
  await expect(professional).toBeVisible();
  await professional.click();
  await expect(page).toHaveURL(/\/professionals\//);
  const id = new URL(page.url()).pathname.split('/').pop();
  const services = await (await request.get('/api/v1/services')).json();
  const service = services.find((item: { counsellor: { id: string } }) => item.counsellor.id === id);
  expect(service, 'seeded matched professional offers a service').toBeTruthy();
  await page.getByRole('button', { name: service.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/services/${service.id}$`));
  await page.getByRole('button', { name: 'Book this service', exact: true }).click();
  await page.getByRole('radio').filter({ hasText: /min/ }).first().click();
  const ordered = page.waitForResponse(r => r.url().endsWith('/orders') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click();
  expect((await ordered).status()).toBe(201);
  await expect(page).toHaveURL(/\/bookings\/checkout/);
  const paid = page.waitForResponse(r => r.url().endsWith('/payments/stub') && r.request().method() === 'POST');
  await page.getByRole('button', { name: /^Pay \$/ }).click();
  const response = await paid;
  expect(response.status()).toBe(200);
  const receipt = await response.json();
  expect(receipt.booking).toMatchObject({ serviceId: service.id, status: 'confirmed' });
  await expect(page.getByText(receipt.booking.id, { exact: true })).toBeVisible();
  await expect(page.getByText(/No real money was charged/)).toBeVisible();

  // Evidence only: observe the integration boundary without requiring a missing
  // endpoint/save to stay missing when the frontend is integrated in future.
  const session = await (await request.post('/api/v1/auth/sessions', { data: { email, password: secret } })).json();
  const persisted = await request.get('/api/v1/me/diagnosis', {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  await info.attach('server-diagnosis-observation', {
    body: JSON.stringify({ status: persisted.status(), body: await persisted.json() }, null, 2),
    contentType: 'application/json',
  });
});

test('US09/12 cancelled local retake preserves the old direction and completed retake replaces it', async ({ page, request }) => {
  await login(page, await register(request));
  await complete(page);
  await page.getByRole('button', { name: 'Retake the diagnosis', exact: true }).click();
  await page.getByRole('radio', { name: 'Looking to upskill or study', exact: true }).click();
  await page.getByRole('button', { name: 'Skip for now', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View my Yoir Direction: Resume and applications', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retake diagnosis', exact: true }).click();
  await complete(page, 'Interview');
  await expect(page.getByText('Interview skills', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go to my home', exact: true }).click();
  await expect(page.getByRole('button', { name: 'View my Yoir Direction: Interview skills', exact: true })).toBeVisible();
});
