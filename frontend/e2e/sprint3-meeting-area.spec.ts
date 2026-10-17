import { randomUUID } from 'node:crypto';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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

test('US36/43 both parties retain the purchased in-person area after a listing move and withdrawal', async ({ page, request, browser }, info) => {
  const buyer = await login(page, 'buyer');
  const sellerContext = await browser.newContext({ baseURL: new URL(page.url()).origin,
    timezoneId: 'Australia/Melbourne', locale: 'en-AU' });
  try {
    const sellerPage = await sellerContext.newPage();
    const seller = await login(sellerPage, 'reviewer');
    const title = `Purchased Melbourne session ${randomUUID().slice(0, 8)}`;
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
    const { booking } = await paid.json();
    expect(booking).toMatchObject({ orderId: order.id, serviceId: service.id,
      modality: 'in_person', meetingArea: 'Melbourne, VIC', status: 'confirmed' });

    const edited = await request.patch(`/api/v1/me/services/${service.id}`, {
      headers: headers(seller), data: { ...draft, location: { state: 'VIC', cityOrRegion: 'Geelong' } },
    });
    expect(edited.status()).toBe(200);
    const listing = await request.get(`/api/v1/services/${service.id}`);
    expect(listing.status()).toBe(200);
    expect(await listing.json()).toMatchObject({ location: { state: 'VIC', cityOrRegion: 'Geelong' } });
    for (const [viewer, session] of [[page, buyer], [sellerPage, seller]] as const) {
      await assertPurchasedArea(viewer, request, session, booking.id, order.id, service.id, title);
    }

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
    await info.attach('purchased-area-readback', { body: JSON.stringify({ orderId: order.id,
      bookingId: booking.id, serviceId: service.id, purchasedArea: 'Melbourne, VIC',
      editedListingArea: 'Geelong, VIC', serviceWithdrawn: true,
      browserViewers: ['buyer', 'counsellor'] }), contentType: 'application/json' });
  } finally {
    await sellerContext.close();
  }
});
