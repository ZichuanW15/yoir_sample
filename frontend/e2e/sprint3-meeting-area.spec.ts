import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

// Verified identities come from sprint3_fixtures.py in the owned local server.
// The service, availability, order, payment stub and later edit use real API
// routes. Each party reads the booking through its own authenticated browser.
const password = 'qa-browser-fixture-password';
type Session = { accessToken: string; user: { id: string; role: string } };
const headers = (session: Session) => ({ Authorization: `Bearer ${session.accessToken}` });

async function login(page: Page, key: 'buyer' | 'reviewer'): Promise<Session> {
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

async function assertPurchasedArea(
  page: Page, request: APIRequestContext, session: Session, bookingId: string,
  orderId: string, serviceId: string, title: string,
) {
  // A new page load and separate API read prevent retained component state from
  // hiding an incorrect value returned after the listing is moved or withdrawn.
  const pending = page.waitForResponse(response =>
    new URL(response.url()).pathname === `/api/v1/bookings/${bookingId}`
    && response.request().method() === 'GET');
  await page.goto(`/bookings/${bookingId}`);
  const loaded = await pending;
  expect(loaded.status()).toBe(200);
  expect(await loaded.json()).toMatchObject({ id: bookingId, orderId, serviceId,
    modality: 'in_person', serviceTitle: title, meetingArea: 'Melbourne, VIC', status: 'confirmed' });
  await expect(page.getByText('General area: Melbourne, VIC', { exact: true })).toBeVisible();
  await expect(page.getByText('General area: Geelong, VIC', { exact: true })).toHaveCount(0);
  const stored = await request.get(`/api/v1/bookings/${bookingId}`, { headers: headers(session) });
  expect(stored.status()).toBe(200);
  expect(await stored.json()).toMatchObject({ id: bookingId, orderId, serviceId,
    modality: 'in_person', serviceTitle: title, meetingArea: 'Melbourne, VIC', status: 'confirmed' });
}

type ConfirmationPurchase = {
  booking: { id: string; orderId: string; serviceId: string; startsAt: string; endsAt: string };
  paymentId: string; title: string; editedTitle: string; amountMinor: number;
};

async function assertPurchasedConfirmation(
  page: Page, purchase: ConfirmationPurchase, stage: 'edited' | 'withdrawn', info: TestInfo,
) {
  const { booking, paymentId, title, editedTitle, amountMinor } = purchase;
  const params = new URLSearchParams({ bookingId: booking.id, paymentId,
    serviceId: booking.serviceId, modality: 'in_person', startsAt: booking.startsAt,
    endsAt: booking.endsAt, amountMinor: String(amountMinor) });
  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'phone', width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const readBooking = page.waitForResponse(response =>
      new URL(response.url()).pathname === `/api/v1/bookings/${booking.id}`
      && response.request().method() === 'GET');
    const readListing = page.waitForResponse(response =>
      new URL(response.url()).pathname === `/api/v1/services/${booking.serviceId}`
      && response.request().method() === 'GET');
    // Each viewport starts a fresh page and waits for both real API reads. The
    // confirmation must consume the stored purchase, including after a 404 listing.
    await page.goto(`/bookings/confirmation?${params}`);
    const [loadedBooking, loadedListing] = await Promise.all([readBooking, readListing]);
    expect(loadedBooking.status()).toBe(200);
    expect(await loadedBooking.json()).toMatchObject({ id: booking.id, orderId: booking.orderId,
      serviceId: booking.serviceId, serviceTitle: title, meetingArea: 'Melbourne, VIC',
      modality: 'in_person', status: 'confirmed' });
    expect(loadedListing.status()).toBe(stage === 'edited' ? 200 : 404);
    if (stage === 'edited') {
      expect(await loadedListing.json()).toMatchObject({ title: editedTitle,
        location: { state: 'VIC', cityOrRegion: 'Geelong' } });
    }
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    await expect(page.getByText(booking.id, { exact: true })).toBeVisible();
    await expect(page.getByText(/^In person · Melbourne, VIC\./)).toBeVisible();
    await expect(page.getByText(editedTitle, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Geelong, VIC/)).toHaveCount(0);
    await info.attach(`purchased-confirmation-${stage}-${viewport.name}`, {
      body: await page.screenshot({ fullPage: true }), contentType: 'image/png',
    });
  }
}

test('US36/43 both parties and confirmation retain purchased title and in-person area after a listing edit and withdrawal', async ({ page, request, browser }, info) => {
  const buyer = await login(page, 'buyer');
  const sellerContext = await browser.newContext({ baseURL: new URL(page.url()).origin,
    timezoneId: 'Australia/Melbourne', locale: 'en-AU' });
  try {
    const sellerPage = await sellerContext.newPage();
    const seller = await login(sellerPage, 'reviewer');
    const unique = randomUUID().slice(0, 8);
    const title = `Purchased Melbourne session ${unique}`;
    const editedTitle = `Updated Geelong session ${unique}`;
    const draft = { title, description: 'An in-person booking with a purchased meeting-area snapshot.',
      priceMinor: 9500, currency: 'AUD', durationMinutes: 60, modalities: ['in_person'],
      location: { state: 'VIC', cityOrRegion: 'Melbourne' } };
    const created = await request.post('/api/v1/me/services', { headers: headers(seller), data: draft });
    expect(created.status()).toBe(201);
    const service = await created.json();
    expect(service).toMatchObject({ title, modalities: ['in_person'], location: draft.location });

    // The review fixture's only existing window is historical and online. Add
    // dedicated future in-person availability through its public owner API.
    const startsAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
    startsAt.setUTCMinutes(0, 0, 0);
    const available = await request.post('/api/v1/me/availability-windows', {
      headers: headers(seller), data: { startsAt: startsAt.toISOString(),
        endsAt: new Date(startsAt.getTime() + 2 * 60 * 60 * 1000).toISOString(),
        modalities: ['in_person'] },
    });
    expect(available.status()).toBe(201);
    const ordered = await request.post('/api/v1/orders', { headers: headers(buyer), data: {
      serviceId: service.id, startsAt: startsAt.toISOString(), modality: 'in_person',
      timezone: 'Australia/Melbourne',
    } });
    expect(ordered.status()).toBe(201);
    const order = await ordered.json();
    const paid = await request.post(`/api/v1/orders/${order.id}/payments/stub`, { headers: headers(buyer) });
    expect(paid.status()).toBe(200);
    const { booking, paymentId } = await paid.json();
    expect(paymentId).toEqual(expect.any(String));
    expect(booking).toMatchObject({ orderId: order.id, serviceId: service.id,
      serviceTitle: title, modality: 'in_person', meetingArea: 'Melbourne, VIC', status: 'confirmed' });

    const edited = await request.patch(`/api/v1/me/services/${service.id}`, {
      headers: headers(seller), data: { ...draft, title: editedTitle,
        location: { state: 'VIC', cityOrRegion: 'Geelong' } },
    });
    expect(edited.status()).toBe(200);
    const listing = await request.get(`/api/v1/services/${service.id}`);
    expect(listing.status()).toBe(200);
    expect(await listing.json()).toMatchObject({ title: editedTitle,
      location: { state: 'VIC', cityOrRegion: 'Geelong' } });
    for (const [viewer, session] of [[page, buyer], [sellerPage, seller]] as const) {
      await assertPurchasedArea(viewer, request, session, booking.id, order.id, service.id, title);
    }
    const purchase = { booking, paymentId, title, editedTitle, amountMinor: draft.priceMinor };
    await assertPurchasedConfirmation(page, purchase, 'edited', info);

    const withdrawn = await request.delete(`/api/v1/me/services/${service.id}`, { headers: headers(seller) });
    expect(withdrawn.status()).toBe(204);
    expect((await request.get(`/api/v1/services/${service.id}`)).status()).toBe(404);
    for (const [role, viewer, session] of [
      ['buyer', page, buyer], ['counsellor', sellerPage, seller],
    ] as const) {
      await assertPurchasedArea(viewer, request, session, booking.id, order.id, service.id, title);
      await info.attach(`purchased-area-${role}`, {
        body: await viewer.screenshot({ fullPage: true }), contentType: 'image/png',
      });
    }
    await assertPurchasedConfirmation(page, purchase, 'withdrawn', info);
    await info.attach('purchased-area-readback', { body: JSON.stringify({ orderId: order.id,
      bookingId: booking.id, serviceId: service.id, purchasedArea: 'Melbourne, VIC',
      purchasedTitle: title, editedListingTitle: editedTitle,
      editedListingArea: 'Geelong, VIC', serviceWithdrawn: true,
      browserViewers: ['buyer', 'counsellor'],
      confirmationViewports: [{ width: 1440, height: 1000 }, { width: 390, height: 844 }],
      confirmationStages: ['edited', 'withdrawn'] }), contentType: 'application/json' });
  } finally {
    await sellerContext.close();
  }
});
