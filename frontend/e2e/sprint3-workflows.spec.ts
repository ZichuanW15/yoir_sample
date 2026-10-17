import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

// Preconditions come from sprint3_fixtures.py in the exclusively owned SQLite
// server. Completed sessions are fixtures, not evidence of scheduler/payment
// provider acceptance. Every successful response below comes from the real API.
const password = 'qa-browser-fixture-password';
const bookingId = 'qa-s3-completed-booking';
const serviceId = 'qa-s3-review-service';
type Session = { accessToken: string; user: { id: string; role: string } };
const headers = (session: Session) => ({ Authorization: `Bearer ${session.accessToken}` });

async function login(page: Page, key: string): Promise<Session> {
  await page.goto('/auth/login');
  await page.getByLabel('Email', { exact: true }).fill(`qa-s3-${key}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const reply = page.waitForResponse(response => response.url().endsWith('/auth/sessions')
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  const response = await reply;
  expect(response.status()).toBe(200);
  const session: Session = await response.json();
  await expect(page).not.toHaveURL(/\/auth\/login/);
  return session;
}

async function storedBooking(request: APIRequestContext, session: Session, id = bookingId) {
  const response = await request.get(`/api/v1/bookings/${id}`, { headers: headers(session) });
  expect(response.status()).toBe(200);
  return response.json();
}

test.afterEach(async ({ page }, info) => {
  await info.attach('sprint3-workflow-screen', {
    body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
  });
});

test('US53/54/55 real review validates, retains a failed draft, persists once and updates public ratings @injected-network', async ({ page, request }) => {
  const session = await login(page, 'buyer');
  const before = await storedBooking(request, session);
  expect(before.status).toBe('completed');
  expect(before.review).toBeNull();
  await page.goto('/bookings');
  await page.getByRole('tab', { name: 'Past', exact: true }).click();
  await page.getByRole('button', { name: 'Write a review', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/bookings/${bookingId}/review$`));

  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Choose a star rating');
  await page.getByRole('radio', { name: '4 stars', exact: true }).click();
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Write a short review');
  expect((await storedBooking(request, session)).review).toBeNull();

  const comment = 'The session helped me prepare clear interview examples.';
  await page.getByLabel('Your review', { exact: true }).fill(`  ${comment}  `);
  await page.route(`**/api/v1/bookings/${bookingId}/review`, route => route.abort('failed'));
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Your review', { exact: true })).toHaveValue(`  ${comment}  `);
  await expect(page.getByRole('button', { name: 'Submit review', exact: true })).toBeEnabled();
  expect((await storedBooking(request, session)).review).toBeNull();
  await page.unroute(`**/api/v1/bookings/${bookingId}/review`);

  const reply = page.waitForResponse(response => response.url().endsWith(`/bookings/${bookingId}/review`)
    && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Submit review', exact: true }).click();
  const submitted = await reply;
  expect(submitted.status()).toBe(201);
  const review = await submitted.json();
  expect(review).toMatchObject({ bookingId, serviceId, rating: 4, comment });
  await expect(page).toHaveURL(new RegExp(`/services/${serviceId}$`));
  await expect(page.getByText(comment, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByText('4/5', { exact: true }).filter({ visible: true })).toBeVisible();

  // Fresh unauthenticated reads and navigation prove persistence, not React state.
  const publicService = await request.get(`/api/v1/services/${serviceId}`);
  expect(publicService.status()).toBe(200);
  expect(await publicService.json()).toMatchObject({ averageRating: 4, reviewCount: 1,
    reviews: [expect.objectContaining({ id: review.id, rating: 4, comment })] });
  const professional = await request.get('/api/v1/counsellors/qa-s3-reviewer');
  expect(professional.status()).toBe(200);
  expect(await professional.json()).toMatchObject({ overallRating: 4, reviewCount: 1 });
  await page.goto('/professionals/qa-s3-reviewer');
  await expect(page.getByText('★ 4.0 · 1 reviews', { exact: true })).toBeVisible();

  await page.goto(`/bookings/${bookingId}/review`);
  await expect(page.getByText('Review already submitted', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Submit review', exact: true })).toHaveCount(0);
  const duplicate = await request.post(`/api/v1/bookings/${bookingId}/review`, {
    headers: headers(session), data: { rating: 1, comment: 'Duplicate must not overwrite the original.' },
  });
  expect(duplicate.status()).toBe(409);
  expect((await storedBooking(request, session)).review).toMatchObject({ id: review.id, rating: 4, comment });
});

for (const status of ['confirmed', 'cancelled']) {
  test(`US53 real ${status} booking blocks a review in the page and API`, async ({ page, request }) => {
    const session = await login(page, 'buyer');
    const id = `qa-s3-${status}-booking`;
    expect((await storedBooking(request, session, id)).status).toBe(status);
    await page.goto(`/bookings/${id}/review`);
    await expect(page.getByText('This session is not ready to review', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Your review', { exact: true })).toHaveCount(0);
    const result = await request.post(`/api/v1/bookings/${id}/review`, {
      headers: headers(session), data: { rating: 5, comment: 'This must not be accepted yet.' },
    });
    expect(result.status()).toBe(409);
    expect((await storedBooking(request, session, id)).review).toBeNull();
  });
}

test('US53 another buyer cannot open or review a completed booking', async ({ page, request }) => {
  const session = await login(page, 'stranger');
  const getReply = page.waitForResponse(response => response.url().endsWith(`/bookings/${bookingId}`));
  await page.goto(`/bookings/${bookingId}/review`);
  expect((await getReply).status()).toBe(404);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Your review', { exact: true })).toHaveCount(0);
  const result = await request.post(`/api/v1/bookings/${bookingId}/review`, {
    headers: headers(session), data: { rating: 5, comment: 'Not this buyer’s session.' },
  });
  expect(result.status()).toBe(404);
});

test('US32/33/58 admin confirmation, approval and reasoned reinvestigation persist through the real API', async ({ page, request }) => {
  const session = await login(page, 'admin');
  const target = 'qa-s3-candidate';
  const read = async () => {
    const response = await request.get(`/api/v1/admin/verifications/${target}`, { headers: headers(session) });
    expect(response.status()).toBe(200);
    return response.json();
  };
  expect((await read()).status).toBe('pending');
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await page.getByRole('navigation').getByRole('link', { name: 'Verifications', exact: true }).click();
  } else {
    await page.getByRole('tab', { name: 'Verify', exact: true }).click();
  }
  await expect(page).toHaveURL(/\/admin\/verifications$/);
  await page.getByRole('button', { name: 'Review QA Verification Candidate', exact: true }).click();
  await expect(page.getByText('Candidate background', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Approve QA Verification Candidate?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  expect((await read()).status).toBe('pending');
  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  const approvedReply = page.waitForResponse(response => response.url().endsWith(`/admin/verifications/${target}/decision`));
  await page.getByRole('button', { name: 'Approve', exact: true }).last().click();
  expect((await approvedReply).status()).toBe(200);
  expect((await read()).status).toBe('verified');
  await expect(page.getByText('Additional investigation', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Mark as rejected', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm rejection', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Say why');
  expect((await read()).status).toBe('verified');
  const reason = 'Please provide a LinkedIn profile with your current professional experience.';
  await page.getByLabel('Why are you rejecting this?', { exact: true }).fill(reason);
  const rejectedReply = page.waitForResponse(response => response.url().endsWith(`/admin/verifications/${target}/decision`));
  await page.getByRole('button', { name: 'Confirm rejection', exact: true }).click();
  expect((await rejectedReply).status()).toBe(200);
  expect(await read()).toMatchObject({ status: 'rejected', decisionReason: reason });
  await page.reload();
  await expect(page.getByText(reason, { exact: true })).toBeVisible();
  const queueReload = page.waitForResponse(response => response.url().includes('/admin/verifications?status=pending'));
  await page.getByRole('button', { name: 'Back to Verifications', exact: true }).click();
  expect((await queueReload).status()).toBe(200);
  await expect(page.getByRole('button', { name: 'Review QA Verification Candidate', exact: true })).toHaveCount(0);
  // External email delivery is disabled; the decision and review trail are the
  // tested outcomes, not receipt of a Mailgun email.
});

test('US48 admin payment detail retries a failed real read and preserves the recorded split @injected-network', async ({ page, request }) => {
  const session = await login(page, 'admin');
  const orderId = 'qa-s3-completed-order';
  const read = await request.get(`/api/v1/admin/payments/${orderId}`, { headers: headers(session) });
  expect(read.status()).toBe(200);
  const before = await read.json();
  expect(before).toMatchObject({ amountMinor: 8450, platformFeeMinor: 845, counsellorPayoutMinor: 7605,
    bookingStatus: 'completed', paymentStatus: 'paid' });
  await page.route('**/api/v1/admin/payments', route => route.abort('failed'));
  await page.goto(`/admin/payments/${orderId}`);
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await expect(page.getByText('This order could not be found.', { exact: true })).toHaveCount(0);
  await page.unroute('**/api/v1/admin/payments');
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  for (const text of ['$84.50', '$8.45', '$76.05', 'QA Review Buyer', 'QA Review Professional', 'Completed']) {
    await expect(page.getByText(text, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(`Payment reference ${orderId}`, { exact: true })).toBeVisible();
  const after = await request.get(`/api/v1/admin/payments/${orderId}`, { headers: headers(session) });
  expect(after.status()).toBe(200);
  expect(await after.json()).toEqual(before);
});

test('US48 an old existing order opens by ID beyond the first 200 list rows @defect', async ({ page, request }, info) => {
  const session = await login(page, 'admin');
  const orderId = 'qa-s3-archive-200';
  const direct = await request.get(`/api/v1/admin/payments/${orderId}`, { headers: headers(session) });
  expect(direct.status()).toBe(200);
  const list = await request.get('/api/v1/admin/payments', { headers: headers(session) });
  expect(list.status()).toBe(200);
  const rows = await list.json();
  expect(rows).toHaveLength(200);
  expect(rows.some((row: { orderId: string }) => row.orderId === orderId)).toBe(false);
  await info.attach('old-order-api-proof', { body: JSON.stringify({ direct: await direct.json(),
    defaultListCount: rows.length, defaultListContainsOrder: false }), contentType: 'application/json' });
  await page.goto(`/admin/payments/${orderId}`);
  // Acceptance assertion: the existing read-by-ID API must support this screen.
  // Current UI searches only the default list, showing a false not-found result.
  await expect(page.getByText(`Payment reference ${orderId}`, { exact: true })).toBeVisible();
});

test('US40/41 alternate delivery and held time stay consistent across buyer and counsellor Web views', async ({ page, request, browser }) => {
  const session = await login(page, 'buyer');
  const id = 'qa-s3-availability-service';
  const before = await request.get(`/api/v1/services/${id}/slots?modality=online`);
  expect(before.status()).toBe(200);
  const starts = await before.json();
  expect(starts.length).toBeGreaterThan(0);
  expect(await (await request.get(`/api/v1/services/${id}/slots?modality=in_person`)).json()).toEqual([]);
  await page.goto(`/services/${id}/timeslots`);
  await expect(page.getByText('No open times right now', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue to payment', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Show online times', exact: true }).click();
  await expect(page.getByText('No open times right now', { exact: true })).toHaveCount(0);
  await page.getByRole('radio').filter({ hasText: /60 min/ }).first().click();
  const orderReply = page.waitForResponse(response => response.url().endsWith('/orders') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Continue to payment', exact: true }).click();
  const reserved = await orderReply;
  expect(reserved.status()).toBe(201);
  const order = await reserved.json();
  expect(order).toMatchObject({ serviceId: id, startsAt: starts[0].startsAt });
  expect(reserved.request().postDataJSON()).toMatchObject({ serviceId: id, modality: 'online' });
  await expect(page).toHaveURL(/\/bookings\/checkout/);

  const other = await browser.newContext({ baseURL: new URL(page.url()).origin, timezoneId: 'Australia/Melbourne', locale: 'en-AU' });
  try {
    const professionalPage = await other.newPage();
    const professional = await login(professionalPage, 'available');
    const windows = await request.get('/api/v1/me/availability-windows', { headers: headers(professional) });
    expect(windows.status()).toBe(200);
    expect(await windows.json()).toEqual([expect.objectContaining({ id: 'qa-s3-available-window', freeMinutes: 120 })]);
    await expect(professionalPage.getByText(/^2 hours free to book, through/)).toBeVisible();
    const remaining = await (await request.get(`/api/v1/services/${id}/slots?modality=online`)).json();
    expect(remaining.some((slot: { startsAt: string }) => slot.startsAt === order.startsAt)).toBe(false);
    const ownServices = await request.get('/api/v1/me/services', { headers: headers(professional) });
    expect(ownServices.status()).toBe(200);
    expect((await ownServices.json()).find((service: { id: string }) => service.id === id).nextAvailableAt).toBe(remaining[0].startsAt);
    await expect(professionalPage.getByText(/^Next open /)).toBeVisible();
    const ownership = await request.get(`/api/v1/orders/${order.id}`, { headers: headers(session) });
    expect(ownership.status()).toBe(200);
  } finally {
    await other.close();
  }
});
