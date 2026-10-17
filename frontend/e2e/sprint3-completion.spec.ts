import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

// Real Web export and exclusively owned local API/database. Setup uses public
// application routes and uniquely registered users; no successful responses are
// mocked. Email delivery, native devices and external payment providers are not
// established by these browser cases.
const password = 'sprint3-completion-password';
type Session = { accessToken: string; user: { id: string; name: string; role: string } };
type Account = Session & { email: string };
const headers = (session: Session) => ({ Authorization: `Bearer ${session.accessToken}` });

async function apiLogin(request: APIRequestContext, email: string, secret = password): Promise<Session> {
  const reply = await request.post('/api/v1/auth/sessions', { data: { email, password: secret } });
  expect(reply.status()).toBe(200);
  return reply.json();
}

async function account(request: APIRequestContext, role: 'counsellor' | 'job_seeker' = 'counsellor'): Promise<Account> {
  const email = `qa-completion-${randomUUID()}@example.com`;
  const reply = await request.post('/api/v1/auth/users', { data: {
    name: `QA completion ${randomUUID().slice(0, 8)}`, email, password,
    passwordConfirmation: password, role,
  } });
  expect(reply.status()).toBe(201);
  return { ...await apiLogin(request, email), email };
}

async function login(page: Page, email: string, secret = password) {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(secret);
  const reply = page.waitForResponse(response => response.url().endsWith('/auth/sessions')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  expect((await reply).status()).toBe(200);
  await expect(page).not.toHaveURL(/\/auth\/login/);
}

async function admin(request: APIRequestContext) {
  return apiLogin(request, 'qa-s3-admin@example.com', 'qa-browser-fixture-password');
}

async function profile(request: APIRequestContext, user: Session) {
  const data = {
    linkedinUrl: `https://www.linkedin.com/in/${user.user.id}/`,
    introduction: 'Public summary for the isolated QA profile.',
    background: 'Private background from a previously public profile.',
    experience: 'Private experience from a previously public profile.',
    qualifications: ['Private qualification'], expertise: ['Career transitions'],
    languages: ['English'], baseLocation: { state: 'VIC', cityOrRegion: 'Melbourne' },
    defaultModality: 'online',
  };
  const reply = await request.patch('/api/v1/me/counsellor-profile', { headers: headers(user), data });
  expect(reply.status()).toBe(200);
  const sent = await request.post('/api/v1/me/verification-submissions', {
    headers: headers(user), data: { linkedInUrl: data.linkedinUrl },
  });
  expect(sent.status()).toBe(201);
  return data;
}

async function decide(request: APIRequestContext, owner: Session, user: Session,
  decision: 'pending' | 'verified' | 'rejected') {
  const reply = await request.post(`/api/v1/admin/verifications/${user.user.id}/decision`, {
    headers: headers(owner), data: { decision, reason: decision === 'rejected' ? 'Please update your professional experience.' : '' },
  });
  expect(reply.status()).toBe(200);
  expect(await reply.json()).toMatchObject({ status: decision });
}

async function context(browser: Browser, page: Page) {
  return browser.newContext({ baseURL: new URL(page.url()).origin,
    timezoneId: 'Australia/Melbourne', locale: 'en-AU' });
}

test.afterEach(async ({ page }, info) => {
  await info.attach('sprint3-completion-screen', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  });
});

for (const [state, label, word] of [
  ['pending', 'Verification pending', 'Pending'],
  ['verified', 'Verified Career Professional', 'Verified'],
  ['rejected', 'Verification rejected', 'Rejected'],
] as const) {
  test(`US32/33/71 real ${state} decision refreshes profile, My Services and administrator users`, async ({ page, request, browser }) => {
    const user = await account(request);
    const owner = await admin(request);
    await profile(request, user);
    // Start with another status: a previously correct label must be replaced.
    const initial = state === 'verified' ? 'rejected' : 'verified';
    await decide(request, owner, user, initial);
    await login(page, user.email);
    await page.goto('/counsellor/profile');
    await expect(page.getByRole('button', { name: 'Verification', exact: true }))
      .toContainText(initial === 'verified' ? 'Verified Career Professional' : 'Verification rejected');

    const other = await context(browser, page);
    try {
      const administrator = await other.newPage();
      await login(administrator, 'qa-s3-admin@example.com', 'qa-browser-fixture-password');
      await administrator.goto('/admin/counsellors');
      const row = administrator.getByRole('button', {
        name: `${user.user.name}, Career Professional. Open their verification`, exact: true,
      });
      await expect(row).toContainText(initial === 'verified' ? 'Verified' : 'Rejected');
      await decide(request, owner, user, state);
      await page.reload();
      await expect(page.getByRole('button', { name: 'Verification', exact: true })).toContainText(label);
      await page.goto('/counsellor');
      await expect(page.getByText('My services', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Verification', exact: true })).toContainText(label);
      await page.goto('/counsellor/verification');
      await expect(page.getByText(label, { exact: true })).toBeVisible();
      await administrator.reload();
      await expect(row).toContainText(word);
      const persisted = await request.get('/api/v1/me/counsellor-profile', { headers: headers(user) });
      expect(persisted.status()).toBe(200);
      expect(await persisted.json()).toMatchObject({ verificationStatus: state });
    } finally {
      await other.close();
    }
  });
}

test('US31/32 a real conflicting verification submission never falsely becomes Pending', async ({ page, request }) => {
  const user = await account(request);
  const owner = await admin(request);
  const data = await profile(request, user);
  await decide(request, owner, user, 'rejected');
  await login(page, user.email);
  await page.goto('/counsellor/verification');
  await expect(page.getByText('Verification rejected', { exact: true })).toBeVisible();
  const revisedUrl = `${data.linkedinUrl}updated/`;
  await page.getByLabel('LinkedIn profile URL', { exact: true }).fill(revisedUrl);

  // The administrator approves after the form was loaded. The actual API must
  // reject this now-stale resubmission; this is not an injected HTTP response.
  await decide(request, owner, user, 'verified');
  const reply = page.waitForResponse(response => response.url().endsWith('/me/verification-submissions')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Resubmit for verification', exact: true }).click();
  expect((await reply).status()).toBe(409);
  await expect(page.getByRole('alert')).toContainText('already verified');
  await expect(page.getByText('Verification pending', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('LinkedIn profile URL', { exact: true })).toHaveValue(revisedUrl);
  await expect(page.getByRole('button', { name: 'Resubmit for verification', exact: true })).toBeEnabled();
  const persisted = await request.get('/api/v1/me/counsellor-profile', { headers: headers(user) });
  expect(await persisted.json()).toMatchObject({ verificationStatus: 'verified', linkedinUrl: data.linkedinUrl });
  await page.reload();
  await expect(page.getByText('Verified Career Professional', { exact: true })).toBeVisible();
  await expect(page.getByLabel('LinkedIn profile URL', { exact: true })).toHaveCount(0);
});

test('US27/28 an already-open public profile removes private fields after real privacy changes and refresh', async ({ page, request, browser }) => {
  const user = await account(request);
  const data = await profile(request, user);
  await login(page, user.email);
  await page.goto('/settings/privacy');
  const other = await context(browser, page);
  try {
    const visitor = await other.newPage();
    await visitor.goto(`/professionals/${user.user.id}`);
    await expect(visitor.getByText(data.background, { exact: true })).toBeVisible();
    await expect(visitor.getByText(data.experience, { exact: true })).toBeVisible();
    await expect(visitor.getByRole('button', { name: 'View LinkedIn profile', exact: true })).toBeVisible();

    for (const [value, title] of [['partial', 'Partially visible'], ['restricted', 'Restricted'], ['public', 'Public']] as const) {
      await page.getByRole('radio', { name: title, exact: true }).click();
      const changed = page.waitForResponse(response => response.url().endsWith('/me/profile-visibility')
        && response.request().method() === 'PATCH');
      await page.getByRole('button', { name: 'Save privacy settings', exact: true }).click();
      const response = await changed;
      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ visibility: value });
      await expect(page.getByRole('button', { name: 'Save privacy settings', exact: true })).toBeDisabled();

      const refreshed = visitor.waitForResponse(reply => reply.url().endsWith(`/counsellors/${user.user.id}`));
      await visitor.reload();
      const publicReply = await refreshed;
      expect(publicReply.status()).toBe(200);
      const publicProfile = await publicReply.json();
      expect(publicProfile.visibility).toBe(value);
      if (value === 'public') {
        await expect(visitor.getByText(data.background, { exact: true })).toBeVisible();
        await expect(visitor.getByText(data.experience, { exact: true })).toBeVisible();
        await expect(visitor.getByRole('button', { name: 'View LinkedIn profile', exact: true })).toBeVisible();
      } else {
        await expect(visitor.getByText(data.background, { exact: true })).toHaveCount(0);
        await expect(visitor.getByText(data.experience, { exact: true })).toHaveCount(0);
        await expect(visitor.getByText('Private qualification', { exact: true })).toHaveCount(0);
        await expect(visitor.getByRole('button', { name: 'View LinkedIn profile', exact: true })).toHaveCount(0);
        expect(JSON.stringify(publicProfile)).not.toContain(data.background);
        expect(JSON.stringify(publicProfile)).not.toContain(data.linkedinUrl);
        for (const privateKey of ['background', 'experience', 'qualifications', 'linkedinUrl']) {
          expect(publicProfile).not.toHaveProperty(privateKey);
        }
        if (value === 'partial') {
          await expect(visitor.getByText(data.introduction, { exact: true })).toBeVisible();
          await expect(visitor.getByText('This profile is restricted', { exact: true })).toHaveCount(0);
        } else {
          await expect(visitor.getByText('This profile is restricted', { exact: true })).toBeVisible();
          await expect(visitor.getByText(data.introduction, { exact: true })).toHaveCount(0);
        }
      }
    }
    // Privacy modifies disclosure, not the saved owner data.
    const own = await request.get('/api/v1/me/counsellor-profile', { headers: headers(user) });
    expect(await own.json()).toMatchObject(data);
  } finally {
    await other.close();
  }
});

test('US54/55 an unrated real service stays New in listings and shows an empty review state', async ({ page, request }) => {
  // Dedicated fixture service is never reviewed by another acceptance case.
  const id = 'qa-s3-availability-service';
  const response = await request.get(`/api/v1/services/${id}`);
  expect(response.status()).toBe(200);
  const service = await response.json();
  expect(service).toMatchObject({ averageRating: null, reviewCount: 0, reviews: [],
    counsellor: { overallRating: null, reviewCount: 0 } });
  await page.goto('/marketplace');
  await page.getByLabel('Search services or Career Professionals', { exact: true }).fill(service.title);
  const card = page.getByRole('button', { name: /^QA modality and remaining time by QA Availability Professional,/ });
  await expect(card.getByText('Career Professional · New', { exact: true })).toBeVisible();
  await expect(card.getByText('New', { exact: true })).toBeVisible();
  await expect(card.getByText('(0)', { exact: true })).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(new RegExp(`/services/${id}$`));
  await expect(page.getByText('New on Yoir', { exact: true })).toBeVisible();
  await expect(page.getByText('No reviews yet', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('No written reviews yet.', { exact: true })).toBeVisible();
  await page.goto('/professionals/qa-s3-available');
  await expect(page.getByText('QA Availability Professional', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: service.title, exact: true })).toBeVisible();
  // The current public profile omits a rating badge for null ratings. This
  // checks that it does not invent zero stars, not a proposed "Unrated" label.
  await expect(page.getByText(/^★ .* reviews$/)).toHaveCount(0);
});

test('US09/12/13 a no-results marketplace search preserves completed diagnosis and original answers', async ({ page, request }) => {
  const user = await account(request, 'job_seeker');
  await login(page, user.email);
  await page.getByRole('radio', { name: 'Something else', exact: true }).click();
  const answer = 'Returning to work after time away';
  await page.getByLabel('Tell us a little more (optional)', { exact: true }).fill(answer);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('radio', { name: 'Improve my resume/application', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Resume/application changes', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('radio', { name: 'Resume', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'See my Yoir Direction', exact: true }).click();
  await expect(page.getByText('Resume and applications', { exact: true }).filter({ visible: true })).toBeVisible();
  const confirmedReply = await request.get('/api/v1/me/diagnosis', { headers: headers(user) });
  expect(confirmedReply.status()).toBe(200);
  const confirmed = await confirmedReply.json();
  expect(confirmed).toMatchObject({ status: 'answers_complete', revision: 5,
    answers: { now: 'other', tried: ['resume'], other: { now: answer } } });
  const criteriaReply = await request.get(`/api/v1/diagnoses/${confirmed.id}/marketplace-criteria`, { headers: headers(user) });
  expect(criteriaReply.status()).toBe(200);
  const criteria = await criteriaReply.json();
  expect(criteria).toMatchObject({ diagnosisId: confirmed.id, area: 'Resume and applications', modality: null });
  expect(criteria.query).toBeTruthy();
  const matched = page.waitForResponse(response => {
    const url = new URL(response.url());
    return url.pathname === '/api/v1/services' && url.searchParams.get('query') === criteria.query;
  });
  await page.getByRole('button', { name: 'View Career Professionals', exact: true }).click();
  await expect(page).toHaveURL(/\/marketplace\?match=1$/);
  const matchedReply = await matched;
  expect(matchedReply.status()).toBe(200);
  expect(new URL(matchedReply.url()).searchParams.has('modality')).toBe(false);
  const matchingServices = await matchedReply.json();
  expect(matchingServices.length).toBeGreaterThan(0);
  const cards = page.getByRole('button', { name: / by .*\$/ });
  await expect(cards.first()).toHaveAccessibleName(new RegExp(`^${matchingServices[0].title} by `));
  await expect(page.getByText('Best for your direction', { exact: true })).toBeVisible();
  const original = await request.get('/api/v1/me/diagnosis', { headers: headers(user) });
  expect(await original.json()).toEqual(confirmed);
  await page.getByLabel('Search services or Career Professionals', { exact: true }).fill(`no-service-${randomUUID()}`);
  await expect(page.getByText('No services match your search.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View my Yoir Direction', exact: true }).click();
  await expect(page.getByText('Resume and applications', { exact: true }).filter({ visible: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Resume and applications', { exact: true }).filter({ visible: true })).toBeVisible();
  await page.getByRole('button', { name: 'Retake the diagnosis', exact: true }).click();
  await expect(page.getByLabel('Tell us a little more (optional)', { exact: true })).toHaveValue(answer);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByText('What have you tried so far?', { exact: true })).toBeVisible();
  const afterExplore = await request.get('/api/v1/me/diagnosis', { headers: headers(user) });
  expect(await afterExplore.json()).toEqual(confirmed);
  // Complete without choosing replacements: original required answers remain
  // usable, and returning to a no-result catalogue did not reset the diagnosis.
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'See my Yoir Direction', exact: true }).click();
  await expect(page.getByText('Resume and applications', { exact: true }).filter({ visible: true })).toBeVisible();
});

test('US36/43/48 a real paid booking keeps its purchased title and price across service edit and withdrawal', async ({ page, request, browser }, info) => {
  const seller = await apiLogin(request, 'maya@example.com', 'password123');
  const buyer = await apiLogin(request, 'qa-s3-buyer@example.com', 'qa-browser-fixture-password');
  const owner = await admin(request);
  const title = `Purchased session ${randomUUID().slice(0, 8)}`;
  const draft = { title, description: 'An isolated service used to verify immutable purchased booking details.',
    priceMinor: 8450, currency: 'AUD', durationMinutes: 60, modalities: ['online'], location: null };
  const created = await request.post('/api/v1/me/services', { headers: headers(seller), data: draft });
  expect(created.status()).toBe(201);
  const service = await created.json();
  const slots = await request.get(`/api/v1/services/${service.id}/slots?modality=online`);
  expect(slots.status()).toBe(200);
  const available = await slots.json();
  expect(available.length).toBeGreaterThan(0);
  // Use the final available start so other seeded journey cases can use the first.
  const ordered = await request.post('/api/v1/orders', { headers: headers(buyer), data: {
    serviceId: service.id, startsAt: available[available.length - 1].startsAt,
    modality: 'online', timezone: 'Australia/Melbourne', preSessionBrief: 'Keep my agreed session details.',
  } });
  expect(ordered.status()).toBe(201);
  const order = await ordered.json();
  const paid = await request.post(`/api/v1/orders/${order.id}/payments/stub`, { headers: headers(buyer) });
  expect(paid.status()).toBe(200);
  const receipt = await paid.json();
  const id = receipt.booking.id;
  expect(receipt.booking).toMatchObject({ serviceTitle: title, status: 'confirmed' });

  await login(page, 'maya@example.com', 'password123');
  await page.goto(`/counsellor/services/${service.id}/edit`);
  await expect(page.getByLabel('Service title', { exact: true })).toHaveValue(title);
  const revisedTitle = `Revised listing ${randomUUID().slice(0, 8)}`;
  await page.getByLabel('Service title', { exact: true }).fill(revisedTitle);
  await page.getByLabel('Price (AUD)', { exact: true }).fill('125');
  const edited = page.waitForResponse(reply => reply.url().endsWith(`/me/services/${service.id}`)
    && reply.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect((await edited).status()).toBe(200);
  const listing = await request.get(`/api/v1/services/${service.id}`);
  expect(await listing.json()).toMatchObject({ title: revisedTitle, priceMinor: 12500 });

  const buyerContext = await context(browser, page);
  const adminContext = await context(browser, page);
  try {
    const buyerPage = await buyerContext.newPage();
    const adminPage = await adminContext.newPage();
    await login(buyerPage, 'qa-s3-buyer@example.com', 'qa-browser-fixture-password');
    await login(adminPage, 'qa-s3-admin@example.com', 'qa-browser-fixture-password');
    const assertHistory = async () => {
      for (const [viewer, auth] of [[buyerPage, buyer], [page, seller]] as const) {
        await viewer.goto(`/bookings/${id}`);
        await expect(viewer.getByText(title, { exact: true })).toBeVisible();
        await expect(viewer.getByText(revisedTitle, { exact: true })).toHaveCount(0);
        const stored = await request.get(`/api/v1/bookings/${id}`, { headers: headers(auth) });
        expect(stored.status()).toBe(200);
        expect(await stored.json()).toMatchObject({ serviceTitle: title, status: 'confirmed',
          amountMinor: 8450 });
      }
      await adminPage.goto(`/admin/payments/${order.id}`);
      await expect(adminPage.getByText(title, { exact: true }).first()).toBeVisible();
      await expect(adminPage.getByText(revisedTitle, { exact: true })).toHaveCount(0);
      const stored = await request.get(`/api/v1/admin/payments/${order.id}`, { headers: headers(owner) });
      expect(stored.status()).toBe(200);
      expect(await stored.json()).toMatchObject({ serviceTitle: title, amountMinor: 8450 });
    };
    await assertHistory();
    // Withdraw through the actual owner API; the browser history must still read.
    const removed = await request.delete(`/api/v1/me/services/${service.id}`, { headers: headers(seller) });
    expect(removed.status()).toBe(204);
    expect((await request.get(`/api/v1/services/${service.id}`)).status()).toBe(404);
    await assertHistory();
    await info.attach('frozen-booking-history', { body: JSON.stringify({ orderId: order.id,
      bookingId: id, purchasedTitle: title, revisedListingTitle: revisedTitle,
      purchasedAmountMinor: 8450, revisedListingAmountMinor: 12500, serviceWithdrawn: true }),
    contentType: 'application/json' });
  } finally {
    await buyerContext.close();
    await adminContext.close();
  }
});
