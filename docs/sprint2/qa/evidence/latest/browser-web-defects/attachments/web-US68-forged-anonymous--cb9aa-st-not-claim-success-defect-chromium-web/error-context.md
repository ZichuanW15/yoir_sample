# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: web.spec.ts >> US68 forged anonymous confirmation URL must not claim success @defect
- Location: e2e/web.spec.ts:401:5

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  getByText('You\'re booked', { exact: true })
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" getByText('You\'re booked', { exact: true }) with timeout 5000ms
  - waiting for getByText('You\'re booked', { exact: true })
    14 × locator resolved to 1 element
       - unexpected value "1"

```

# Page snapshot

```yaml
- generic [ref=e10]:
  - generic [ref=e12]:
    - 'progressbar "Step 3 of 3: Confirmed" [ref=e14]':
      - generic [ref=e15]: Time
      - generic [ref=e21]: Payment
      - generic [ref=e27]:
        - generic [ref=e28]: "3"
        - generic [ref=e30]: Confirmed
    - generic [ref=e31]:
      - generic [ref=e42]: You're booked
      - generic [ref=e44]: Payment successful. No real money was charged — this build uses a payment stub.
    - generic [ref=e46]:
      - generic [ref=e47]: with
      - generic [ref=e49]:
        - generic [ref=e50]: When
        - generic [ref=e51]: Thursday 1 October
      - generic [ref=e52]:
        - generic [ref=e53]: Session
        - generic [ref=e54]: 11:00 am – 12:00 pm
      - generic [ref=e55]:
        - generic [ref=e56]: Delivery
        - generic [ref=e57]: Online
      - generic [ref=e58]:
        - generic [ref=e59]: Paid
        - generic [ref=e60]: $71 · Paid
    - generic [ref=e61]:
      - generic [ref=e62]: References
      - generic [ref=e63]:
        - generic [ref=e64]: Booking
        - generic [ref=e65]: does-not-exist
      - generic [ref=e66]:
        - generic [ref=e67]: Payment
        - generic [ref=e68]: not-paid
    - generic [ref=e69]: Online. Joining details are sent to your registered email before the session. Keep the booking reference — your counsellor can see the booking now.
  - button "Back to Marketplace" [ref=e76] [cursor=pointer]
```

# Test source

```ts
  307 |   await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  308 |   const updatedResponse = await updatedReply;
  309 |   expect(updatedResponse.status()).toBe(200);
  310 |   const updated = await updatedResponse.json();
  311 |   expect(updated.id).toBe(slot.id);
  312 |   expect(updated.serviceId).toBe(service.id);
  313 |   expect(localTime(updated.startsAt)).toBe('11:30');
  314 |   expect(new Date(updated.endsAt).getTime() - new Date(updated.startsAt).getTime()).toBe(30 * 60_000);
  315 |   persisted = await request.get(`/api/v1/services/${service.id}/slots`);
  316 |   expect(persisted.status()).toBe(200);
  317 |   expectStoredSlot(await persisted.json(), updated);
  318 |   await expect(slotRow).toContainText(/11:30\s*am\s*–\s*12:00\s*pm/);
  319 |   await slotRow.click();
  320 |   const deletedReply = page.waitForResponse(r => r.url().endsWith(`/me/availability-slots/${slot.id}`) && r.request().method() === 'DELETE');
  321 |   await page.getByRole('button', { name: 'Remove slot', exact: true }).click();
  322 |   expect((await deletedReply).status()).toBe(204);
  323 |   await expect(page.getByText('Your availability', { exact: true })).toBeVisible();
  324 |   await expect(slotRow).toHaveCount(0);
  325 |   persisted = await request.get(`/api/v1/services/${service.id}/slots`);
  326 |   expect(persisted.status()).toBe(200);
  327 |   expect(await persisted.json()).toEqual([]);
  328 | });
  329 | 
  330 | test('[QA-106][US08-AC3] logout prevents browser history and protected deep-link access', async ({ page, request }) => {
  331 |   // Keep a known public app page earlier in history, not the browser's blank tab.
  332 |   await page.goto('/marketplace');
  333 |   await expect(page.getByLabel('Search services or counsellors')).toBeVisible();
  334 |   const session = await login(page, 'maya@example.com', '/auth/login', 'password123');
  335 |   await expect(page).toHaveURL(/\/counsellor$/);
  336 |   await page.getByRole('button', { name: 'Professional profile', exact: true }).click();
  337 |   await expect(page).toHaveURL(/\/counsellor\/profile$/);
  338 |   await page.goBack();
  339 |   await expect(page).toHaveURL(/\/counsellor$/);
  340 |   const loggedOut = page.waitForResponse(r => r.url().endsWith('/auth/sessions/current') && r.request().method() === 'DELETE');
  341 |   await page.getByRole('button', { name: 'Account, Maya Chen', exact: true }).click();
  342 |   await page.getByRole('button', { name: 'Log out', exact: true }).click();
  343 |   expect((await loggedOut).status()).toBe(204);
  344 |   const isPublic = async () => {
  345 |     await expect(page.getByLabel('Search services or counsellors')
  346 |       .or(page.getByRole('button', { name: 'Log in', exact: true }))
  347 |       .or(page.getByRole('button', { name: 'Just looking? Browse as a guest', exact: true })).first()).toBeVisible();
  348 |     await expect(page).not.toHaveURL(/\/counsellor(?:\/|$)/);
  349 |     await expect(page.getByRole('button', { name: 'Account, Maya Chen', exact: true })).toHaveCount(0);
  350 |     await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toHaveCount(0);
  351 |   };
  352 |   await isPublic();
  353 |   // profile was ahead of dashboard before logout: try that retained entry first.
  354 |   await page.goForward();
  355 |   await isPublic();
  356 |   await page.goBack();
  357 |   await isPublic();
  358 |   await page.goForward();
  359 |   await isPublic();
  360 |   for (const path of ['/counsellor', '/counsellor/profile', '/counsellor/availability', '/counsellor/services/new']) {
  361 |     await page.goto(path);
  362 |     await isPublic();
  363 |   }
  364 |   expect((await request.get('/api/v1/me/services', { headers: { Authorization: `Bearer ${session.accessToken}` } })).status()).toBe(401);
  365 | });
  366 | 
  367 | test('US45 implemented Web keyword search shows matching results and a recoverable empty state', async ({ page, request }) => {
  368 |   const response = await request.get('/api/v1/services');
  369 |   expect(response.status()).toBe(200);
  370 |   const services = await response.json();
  371 |   await page.goto('/marketplace');
  372 |   await expect(page.getByRole('button', { name: / by .*\$/ }).first()).toBeVisible();
  373 |   const search = page.getByLabel('Search services or counsellors');
  374 |   const service = services[0];
  375 |   await search.fill(service.title);
  376 |   await expect(page.getByRole('button', { name: `${service.title} by`, exact: false })).toBeVisible();
  377 |   await search.fill(`no-such-service-${randomUUID()}`);
  378 |   await expect(page.getByRole('button', { name: / by .*\$/ })).toHaveCount(0);
  379 |   await expect(page.getByText('No services match your search.', { exact: true })).toBeVisible();
  380 |   await search.clear();
  381 |   await expect(page.getByRole('button', { name: `${service.title} by`, exact: false })).toBeVisible();
  382 | });
  383 | 
  384 | test('[QA-118][US40-AC4] real empty availability has an explanatory state @defect', async ({ page, request }) => {
  385 |   const auth = await request.post('/api/v1/auth/sessions', { data: { email: 'maya@example.com', password: 'password123' } });
  386 |   expect(auth.status()).toBe(200);
  387 |   const { accessToken } = await auth.json();
  388 |   const create = await request.post('/api/v1/me/services', {
  389 |     headers: { Authorization: `Bearer ${accessToken}` },
  390 |     data: { title: `Empty calendar ${randomUUID()}`, description: 'A new service with no availability for the empty-state acceptance check.', priceMinor: 7500, currency: 'AUD', modalities: ['online'], location: null },
  391 |   });
  392 |   expect(create.status()).toBe(201);
  393 |   const service = await create.json();
  394 |   expect(await (await request.get(`/api/v1/services/${service.id}/slots`)).json()).toEqual([]);
  395 |   await login(page, await account(request), `/auth/login?serviceId=${service.id}`);
  396 |   await expect(page.getByText('When suits you?')).toBeVisible();
  397 |   await expect(page.getByRole('button', { name: 'Continue to payment' })).toBeDisabled();
  398 |   await expect(page.getByText(/no (?:\w+ ){0,3}(?:slots|times|sessions)|fully booked/i)).toBeVisible();
  399 | });
  400 | 
  401 | test('US68 forged anonymous confirmation URL must not claim success @defect', async ({ page }) => {
  402 |   const params = new URLSearchParams({ bookingId: 'does-not-exist', paymentId: 'not-paid',
  403 |     startsAt: '2026-10-01T01:00:00Z', endsAt: '2026-10-01T02:00:00Z', modality: 'online', amountMinor: '7050' });
  404 |   await page.goto(`/bookings/confirmation?${params}`);
  405 |   // A real app screen must be present before checking the negative assertion.
  406 |   await expect(page.getByRole('button', { name: 'Back to Marketplace' })).toBeVisible();
> 407 |   await expect(page.getByText("You're booked", { exact: true })).toHaveCount(0);
      |                                                                  ^ Error: expect(locator).toHaveCount(expected) failed
  408 | });
  409 | 
```