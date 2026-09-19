# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: web.spec.ts >> [QA-118][US40-AC4] real empty availability has an explanatory state @defect
- Location: e2e/web.spec.ts:384:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/no (?:\w+ ){0,3}(?:slots|times|sessions)|fully booked/i)
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText(/no (?:\w+ ){0,3}(?:slots|times|sessions)|fully booked/i) with timeout 5000ms
  - waiting for getByText(/no (?:\w+ ){0,3}(?:slots|times|sessions)|fully booked/i)

```

```yaml
- button "Go back":
  - img
- text: Choose a time
- 'progressbar "Step 1 of 3: Time"': 1 Time 2 Payment 3 Confirmed
- text: When suits you? Select one available session for Empty calendar b51cbeb1-c198-4994-8ca9-f5a68323c4b0.
- img
- text: Times are shown in your device timezone (Australia/Melbourne).
- button "Continue to payment" [disabled]
```

# Test source

```ts
  298 |   const slotRow = page.getByRole('button').filter({ hasText: service.title });
  299 |   await expect(slotRow).toBeVisible();
  300 |   await expect(slotRow).toContainText(/9:15\s*am\s*–\s*10:15\s*am/);
  301 |   await slotRow.click();
  302 |   await expect(page.getByText(/^Edit slot ·/)).toBeVisible();
  303 |   await page.getByRole('radio', { name: '11', exact: true }).click();
  304 |   await page.getByRole('radio', { name: ':30', exact: true }).click();
  305 |   await page.getByRole('radio', { name: '30 min', exact: true }).click();
  306 |   const updatedReply = page.waitForResponse(r => r.url().endsWith(`/me/availability-slots/${slot.id}`) && r.request().method() === 'PATCH');
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
> 398 |   await expect(page.getByText(/no (?:\w+ ){0,3}(?:slots|times|sessions)|fully booked/i)).toBeVisible();
      |                                                                                          ^ Error: expect(locator).toBeVisible() failed
  399 | });
  400 | 
  401 | test('US68 forged anonymous confirmation URL must not claim success @defect', async ({ page }) => {
  402 |   const params = new URLSearchParams({ bookingId: 'does-not-exist', paymentId: 'not-paid',
  403 |     startsAt: '2026-10-01T01:00:00Z', endsAt: '2026-10-01T02:00:00Z', modality: 'online', amountMinor: '7050' });
  404 |   await page.goto(`/bookings/confirmation?${params}`);
  405 |   // A real app screen must be present before checking the negative assertion.
  406 |   await expect(page.getByRole('button', { name: 'Back to Marketplace' })).toBeVisible();
  407 |   await expect(page.getByText("You're booked", { exact: true })).toHaveCount(0);
  408 | });
  409 | 
```