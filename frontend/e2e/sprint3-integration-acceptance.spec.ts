import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// Successful setup, saves and independent readbacks use the real isolated API.
// Only explicitly marked failure/delay cases intercept transport. The diagnosis
// integration checks are regression gates now that dev implements the API hook;
// the unresolved professional-rating assertion remains advisory.
const password = 'sprint3-integration-qa-password';
const version = 'yoir-six-step-v1';
const savePattern = '**/api/v1/diagnoses/*/steps/now';
type Diagnosis = {
  id: string; revision: number; currentStep: number;
  answers: { now?: string; other?: Record<string, string> };
};
type Account = { email: string; accessToken: string; diagnosis: Diagnosis };
const headers = (user: Account) => ({ Authorization: `Bearer ${user.accessToken}` });

async function account(request: APIRequestContext): Promise<Account> {
  const email = `qa-integration-${randomUUID()}@example.com`;
  const registered = await request.post('/api/v1/auth/users', { data: {
    name: 'Integration QA', email, password, passwordConfirmation: password, role: 'job_seeker',
  } });
  expect(registered.status()).toBe(201);
  const loggedIn = await request.post('/api/v1/auth/sessions', { data: { email, password } });
  expect(loggedIn.status()).toBe(200);
  const { accessToken } = await loggedIn.json();
  const started = await request.post('/api/v1/me/diagnosis', {
    headers: { Authorization: `Bearer ${accessToken}` }, data: { questionnaireVersion: version },
  });
  expect(started.status()).toBe(200);
  const diagnosis = await started.json();
  expect(diagnosis).toMatchObject({ revision: 0, currentStep: 1 });
  return { email, accessToken, diagnosis };
}

async function login(page: Page, user: Account) {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const reply = page.waitForResponse(response => response.url().endsWith('/auth/sessions')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  expect((await reply).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/auth\/login/);
  await page.goto('/job-seeker/diagnosis');
  await expect(page.getByRole('progressbar')).toHaveCount(1);
}

async function choose(page: Page, note: string) {
  await expect(page.getByRole('progressbar', { name: 'Step 1 of 6' })).toBeVisible();
  await page.getByRole('radio', { name: 'Something else', exact: true }).click();
  await page.getByLabel('Tell us a little more (optional)', { exact: true }).fill(note);
}

async function readback(request: APIRequestContext, user: Account): Promise<Diagnosis> {
  const reply = await request.get('/api/v1/me/diagnosis', { headers: headers(user) });
  expect(reply.status()).toBe(200);
  return reply.json();
}

async function evidence(info: TestInfo, data: unknown) {
  await info.attach('diagnosis-boundary-readback', {
    body: JSON.stringify(data, null, 2), contentType: 'application/json',
  });
}

test.afterEach(async ({ page }, info) => {
  await info.attach('integration-acceptance-screen', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  });
});

test('[S3-DIAGNOSIS-SERVER-ACK][QA-165] Continue waits for the real saved-step acknowledgement @injected-network', async ({ page, request }, info) => {
  const user = await account(request);
  let writes = 0;
  let serverStatus: number | undefined;
  let release!: () => void;
  const heldResponse = new Promise<void>(resolve => { release = resolve; });
  await page.route(savePattern, async route => {
    writes += 1;
    const response = await route.fetch();
    serverStatus = response.status();
    await heldResponse;
    await route.fulfill({ response });
  });
  try {
    await login(page, user);
    await choose(page, 'Returning after caring for family');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    // Either the expected request starts or the current app visibly advances.
    // Do not turn missing integration into waitForResponse's transport timeout.
    await expect.poll(async () => writes > 0
      || await page.getByRole('progressbar', { name: 'Step 2 of 6' }).isVisible()).toBe(true);
    expect(writes, 'The UI advanced without attempting the required diagnosis API save.').toBe(1);
    await expect.poll(() => serverStatus).toBe(200);
    await expect(page.getByRole('progressbar', { name: 'Step 1 of 6' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeDisabled();
    release();
    await expect(page.getByRole('progressbar', { name: 'Step 2 of 6' })).toBeVisible();
    expect(await readback(request, user)).toMatchObject({
      revision: 1, currentStep: 2,
      answers: { now: 'other', other: { now: 'Returning after caring for family' } },
    });
  } finally {
    release();
    await evidence(info, { writes, serverStatus: serverStatus ?? null, stored: await readback(request, user) });
  }
});

test('[S3-DIAGNOSIS-SAVE-RECOVERY][QA-165] a refused server save retains the answer and retries without advancement @injected-network', async ({ page, request }, info) => {
  const user = await account(request);
  let interceptedWrites = 0;
  await page.route(savePattern, async route => {
    interceptedWrites += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({
      code: 'UNAVAILABLE', message: 'Diagnosis was not saved. Please retry.', requestId: 'qa-refused-diagnosis',
    }) });
  });
  try {
    await login(page, user);
    await choose(page, 'Retain this answer while offline');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await expect.poll(async () => interceptedWrites > 0
      || await page.getByRole('progressbar', { name: 'Step 2 of 6' }).isVisible()).toBe(true);
    expect(interceptedWrites, 'No diagnosis save was attempted; the injected failure and retry UI were not reached.').toBe(1);
    await expect(page.getByRole('alert')).toContainText('Diagnosis was not saved');
    await expect(page.getByRole('progressbar', { name: 'Step 1 of 6' })).toBeVisible();
    await expect(page.getByLabel('Tell us a little more (optional)', { exact: true })).toHaveValue('Retain this answer while offline');
    expect(await readback(request, user)).toEqual(user.diagnosis);
    await page.unroute(savePattern);
    const saved = page.waitForResponse(response => response.url().endsWith(`/diagnoses/${user.diagnosis.id}/steps/now`)
      && response.request().method() === 'PUT');
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByRole('progressbar', { name: 'Step 2 of 6' })).toBeVisible();
    expect(await readback(request, user)).toMatchObject({ revision: 1, currentStep: 2,
      answers: { now: 'other', other: { now: 'Retain this answer while offline' } } });
  } finally {
    await evidence(info, { interceptedWrites, injectedFailureReached: interceptedWrites > 0, stored: await readback(request, user) });
  }
});

test('[S3-DIAGNOSIS-SERVER-RESUME][QA-162][QA-168] a fresh browser resumes the same account server-confirmed answers', async ({ browser, request, baseURL }, info) => {
  const user = await account(request);
  const saved = await request.put(`/api/v1/diagnoses/${user.diagnosis.id}/steps/now`, {
    headers: headers(user), data: { questionnaireVersion: version, expectedRevision: 0,
      value: 'other', other: 'Confirmed in another session' },
  });
  expect(saved.status()).toBe(200);
  expect(await readback(request, user)).toMatchObject({ revision: 1, currentStep: 2 });
  expect(baseURL).toBeTruthy();
  const isolated = await browser.newContext({ baseURL,
    timezoneId: 'Australia/Melbourne', locale: 'en-AU', storageState: { cookies: [], origins: [] } });
  try {
    const second = await isolated.newPage();
    await login(second, user);
    await evidence(info, { stored: await readback(request, user), freshContext: true,
      displayedStep: await second.getByRole('progressbar').getAttribute('aria-label') });
    await info.attach('fresh-browser-resume-screen', { body: await second.screenshot({ fullPage: true }), contentType: 'image/png' });
    await expect(second.getByRole('progressbar', { name: 'Step 2 of 6' })).toBeVisible();
    await second.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(second.getByLabel('Tell us a little more (optional)', { exact: true })).toHaveValue('Confirmed in another session');
  } finally {
    await isolated.close();
  }
});

test('@defect [S3-PROFILE-UNRATED][QA-219] a real unrated professional has an explicit neutral rating state', async ({ page, request }, info) => {
  const id = 'qa-s3-available';
  const reply = await request.get(`/api/v1/counsellors/${id}`);
  expect(reply.status()).toBe(200);
  const profile = await reply.json();
  expect(profile.reviewCount).toBe(0);
  // This public endpoint excludes null response fields; the client normalizes
  // an omitted overallRating to null. Either representation is unrated.
  expect(profile.overallRating ?? null).toBeNull();
  await page.goto(`/professionals/${id}`);
  await expect(page.getByText(profile.displayName, { exact: true })).toBeVisible();
  await expect(page.getByText(/^★/)).toHaveCount(0);
  await info.attach('unrated-api-precondition', { body: JSON.stringify({ id,
    overallRating: profile.overallRating ?? null,
    ratingFieldPresent: Object.hasOwn(profile, 'overallRating'),
    reviewCount: profile.reviewCount }), contentType: 'application/json' });
  // Accept neutral equivalent wording; verification status is not a rating state.
  await expect(page.getByText(/^(No reviews yet|No ratings yet|Not yet rated|Unrated|New on Yoir)$/i)).toBeVisible();
});

test('@defect [S3-DIAGNOSIS-HOME-READ-RECOVERY][QA-162][QA-168] an unavailable saved diagnosis offers retry without replacing confirmed answers @injected-network', async ({ page, request }, info) => {
  const user = await account(request);
  const saved = await request.put(`/api/v1/diagnoses/${user.diagnosis.id}/steps/now`, {
    headers: headers(user), data: { questionnaireVersion: version, expectedRevision: 0,
      value: 'other', other: 'Keep the server-confirmed answer' },
  });
  expect(saved.status()).toBe(200);
  const confirmed = await readback(request, user);
  let starts = 0;
  let refusedReads = 0;
  page.on('request', reply => {
    if (reply.url().endsWith('/me/diagnosis') && reply.method() === 'POST') starts += 1;
  });
  await page.route('**/api/v1/me/diagnosis', async route => {
    if (route.request().method() !== 'GET') return route.continue();
    refusedReads += 1;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({
      code: 'UNAVAILABLE', message: 'Saved diagnosis is temporarily unavailable.', requestId: 'qa-diagnosis-read',
    }) });
  });
  try {
    // Login lands at the home load-error boundary; no new diagnosis may be started.
    await page.goto('/auth/login');
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Log in', exact: true }).click();
    await expect.poll(() => refusedReads).toBeGreaterThan(0);
    await expect(page.getByRole('alert')).toContainText('Saved diagnosis is temporarily unavailable');
    await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(0);
    expect(starts).toBe(0);
    expect(await readback(request, user)).toEqual(confirmed);
    await page.unroute('**/api/v1/me/diagnosis');
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await expect(page.getByRole('progressbar', { name: 'Step 2 of 6' })).toBeVisible();
    await page.getByRole('button', { name: 'Continue the Yoir Diagnosis', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByLabel('Tell us a little more (optional)', { exact: true })).toHaveValue('Keep the server-confirmed answer');
    expect(starts).toBe(0);
    expect(await readback(request, user)).toEqual(confirmed);
  } finally {
    await evidence(info, { injectedStatus: 503, refusedReads, replacementStarts: starts,
      pageUrl: page.url(), original: confirmed, stored: await readback(request, user) });
  }
});

test('[QA-165][QA-168] a real revision conflict reloads confirmed progress before an explicit retry', async ({ page, request }, info) => {
  const user = await account(request);
  await login(page, user);
  await choose(page, 'This browser draft');
  const otherSession = await request.put(`/api/v1/diagnoses/${user.diagnosis.id}/steps/now`, {
    headers: headers(user), data: { questionnaireVersion: version, expectedRevision: 0,
      value: 'other', other: 'Other session confirmed answer' },
  });
  expect(otherSession.status()).toBe(200);
  const conflict = page.waitForResponse(reply => reply.url().endsWith(`/diagnoses/${user.diagnosis.id}/steps/now`)
    && reply.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  expect((await conflict).status()).toBe(409);
  await expect(page.getByRole('progressbar', { name: 'Step 2 of 6' })).toBeVisible();
  const confirmed = await readback(request, user);
  expect(confirmed).toMatchObject({ revision: 1,
    answers: { other: { now: 'Other session confirmed answer' } } });
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByLabel('Tell us a little more (optional)', { exact: true })).toHaveValue('This browser draft');
  const retry = page.waitForResponse(reply => reply.url().endsWith(`/diagnoses/${user.diagnosis.id}/steps/now`)
    && reply.request().method() === 'PUT');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  const retried = await retry;
  expect(retried.status()).toBe(200);
  expect(retried.request().postDataJSON()).toMatchObject({ expectedRevision: 1 });
  expect(await readback(request, user)).toMatchObject({ revision: 2,
    answers: { other: { now: 'This browser draft' } } });
  await evidence(info, { conflictStatus: 409, beforeExplicitRetry: confirmed,
    afterExplicitRetry: await readback(request, user) });
});

test('[QA-171] result retry recovers the real direction without submitting the completed answer twice @injected-network', async ({ page, request }, info) => {
  const user = await account(request);
  for (const [step, value, revision] of [
    ['now', 'job', 0], ['goal', 'resume', 1], ['tried', [], 2], ['stuck', 'resume', 3],
  ] as const) {
    const saved = await request.put(`/api/v1/diagnoses/${user.diagnosis.id}/steps/${step}`, {
      headers: headers(user), data: { questionnaireVersion: version, expectedRevision: revision, value },
    });
    expect(saved.status()).toBe(200);
  }
  let writes = 0;
  page.on('request', reply => {
    if (reply.url().endsWith(`/diagnoses/${user.diagnosis.id}/steps/barriers`)
      && reply.method() === 'PUT') writes += 1;
  });
  await page.route(`**/api/v1/diagnoses/${user.diagnosis.id}/direction`, route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({
      code: 'UNAVAILABLE', message: 'Direction is temporarily unavailable.', requestId: 'qa-direction-read',
    }),
  }));
  await login(page, user);
  await expect(page.getByRole('progressbar', { name: 'Step 5 of 6' })).toBeVisible();
  await page.getByRole('button', { name: 'See my Yoir Direction', exact: true }).click();
  await expect(page.getByText('Your Yoir Direction', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Direction is temporarily unavailable');
  expect(writes).toBe(1);
  const confirmed = await readback(request, user);
  expect(confirmed).toMatchObject({ revision: 5, currentStep: 6, status: 'answers_complete', answers: { barriers: [] } });
  await page.unroute(`**/api/v1/diagnoses/${user.diagnosis.id}/direction`);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByText('Resume and applications', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'View Career Professionals', exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(writes).toBe(1);
  expect(await readback(request, user)).toEqual(confirmed);
  await evidence(info, { finalStepWrites: writes, confirmed });
});
