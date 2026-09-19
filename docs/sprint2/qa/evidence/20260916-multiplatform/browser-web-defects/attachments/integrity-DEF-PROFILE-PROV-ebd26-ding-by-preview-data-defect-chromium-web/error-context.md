# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integrity.spec.ts >> DEF-PROFILE-PROVENANCE: live verified identity is not silently labelled pending by preview data @defect
- Location: e2e/integrity.spec.ts:49:5

# Error details

```
Error: Real verified API data must not be contradicted by an unlabelled local Pending profile

expect(locator).toBeVisible() failed

Locator: getByText('Verified counsellor', { exact: true }).or(getByText(/verification (?:status )?(?:unknown|unavailable|not available)/i)).or(getByText(/(?:profile|verification).*(?:preview|demo|local data)|(?:preview|demo|local data).*(?:profile|verification)/i)).visible().first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Real verified API data must not be contradicted by an unlabelled local Pending profile getByText('Verified counsellor', { exact: true }).or(getByText(/verification (?:status )?(?:unknown|unavailable|not available)/i)).or(getByText(/(?:profile|verification).*(?:preview|demo|local data)|(?:preview|demo|local data).*(?:profile|verification)/i)).visible().first() with timeout 5000ms
  - waiting for getByText('Verified counsellor', { exact: true }).or(getByText(/verification (?:status )?(?:unknown|unavailable|not available)/i)).or(getByText(/(?:profile|verification).*(?:preview|demo|local data)|(?:preview|demo|local data).*(?:profile|verification)/i)).visible().first()

```

```yaml
- img "Yoir"
- button "Account, Maya Chen": MC
- text: Your workspace Good to see you, Maya
- img
- img
- text: Verification Verification pending Add your LinkedIn profile URL so the Platform Owner can verify you.
- button "Professional profile":
  - img
  - text: 0/5 Professional profile 0 of 5 sections complete. Set up
- text: My services 2 published
- button "New":
  - img
  - text: New
- img
- text: Behavioural interview deep-dive $120 Two hours working through the STAR method on your real examples, with a scored practice round and written notes to take away. Online 3 open slots
- button "Edit Behavioural interview deep-dive":
  - img
  - text: Edit
- button "Delete Behavioural interview deep-dive":
  - img
  - text: Delete
- img
- text: Interview confidence coaching $95 A focused one-to-one session covering behavioural questions, confident delivery and practical feedback for your next interview. Online 3 open slots
- button "Edit Interview confidence coaching":
  - img
  - text: Edit
- button "Delete Interview confidence coaching":
  - img
  - text: Delete
- button "Availability":
  - img
  - text: Availability 6 open slots. Next on Thu, 17 Sept.
  - img
```

# Test source

```ts
  1   | import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
  2   | import { randomUUID } from 'node:crypto';
  3   | 
  4   | type Session = { accessToken: string; user: { id: string; role: string } };
  5   | type Service = {
  6   |   id: string;
  7   |   title: string;
  8   |   priceMinor: number;
  9   |   counsellor: { id: string; verificationStatus: string };
  10  | };
  11  | 
  12  | const seedEmail = 'maya@example.com';
  13  | const seedPassword = 'password123';
  14  | 
  15  | // The shared Playwright configuration starts the local API with its own temporary
  16  | // database. These tests use no deployment, synthetic successful response, profile
  17  | // route implementation, or direct database mutation. Chromium evidence is not
  18  | // evidence that the native iOS/Android applications have been exercised.
  19  | async function login(page: Page, email = seedEmail, password = seedPassword): Promise<Session> {
  20  |   await page.goto('/auth/login');
  21  |   await page.getByLabel('Email', { exact: true }).fill(email);
  22  |   await page.getByLabel('Password', { exact: true }).fill(password);
  23  |   const reply = page.waitForResponse(response => response.url().endsWith('/auth/sessions')
  24  |     && response.request().method() === 'POST');
  25  |   await page.getByRole('button', { name: 'Log in', exact: true }).click();
  26  |   const response = await reply;
  27  |   expect(response.status()).toBe(200);
  28  |   await expect(page).toHaveURL(/\/counsellor$/);
  29  |   return response.json();
  30  | }
  31  | 
  32  | async function ownServices(request: APIRequestContext, accessToken: string): Promise<Service[]> {
  33  |   const result = await request.get('/api/v1/me/services', {
  34  |     headers: { Authorization: `Bearer ${accessToken}` },
  35  |   });
  36  |   expect(result.status()).toBe(200);
  37  |   return result.json();
  38  | }
  39  | 
  40  | async function serviceDraft(page: Page, title: string, price: string) {
  41  |   await page.getByRole('button', { name: 'New', exact: true }).click();
  42  |   await page.getByLabel('Service title', { exact: true }).fill(title);
  43  |   await page.getByLabel('Description', { exact: true }).fill(
  44  |     'A dedicated browser QA service for checking publication and price integrity.',
  45  |   );
  46  |   await page.getByLabel('Price (AUD)', { exact: true }).fill(price);
  47  | }
  48  | 
  49  | test('DEF-PROFILE-PROVENANCE: live verified identity is not silently labelled pending by preview data @defect', async ({ page, request }) => {
  50  |   const session = await login(page);
  51  |   const services = await ownServices(request, session.accessToken);
  52  |   const service = services.find(item => item.counsellor.id === session.user.id);
  53  |   expect(service, 'The isolated verified seed counsellor must own a real API service').toBeDefined();
  54  |   expect(service!.counsellor.verificationStatus).toBe('verified');
  55  |   await expect(page.getByRole('button', { name: `Edit ${service!.title}`, exact: true })).toBeVisible();
  56  | 
  57  |   // This checks truth/provenance of an already-rendered dashboard, NOT completion
  58  |   // of the deferred verification workflow or the missing counsellor profile API.
  59  |   // A verified status, an explicit unknown/unavailable status, or a visible label
  60  |   // explaining that the profile/verification is local preview data are all valid.
  61  |   const verified = page.getByText('Verified counsellor', { exact: true });
  62  |   const unknown = page.getByText(/verification (?:status )?(?:unknown|unavailable|not available)/i);
  63  |   const preview = page.getByText(
  64  |     /(?:profile|verification).*(?:preview|demo|local data)|(?:preview|demo|local data).*(?:profile|verification)/i,
  65  |   );
  66  |   await expect(verified.or(unknown).or(preview).filter({ visible: true }).first(),
  67  |     'Real verified API data must not be contradicted by an unlabelled local Pending profile',
> 68  |   ).toBeVisible();
      |     ^ Error: Real verified API data must not be contradicted by an unlabelled local Pending profile
  69  | });
  70  | 
  71  | test('CURRENT-IMPLEMENTATION: newly registered counsellor receives publish 403 with no saved or falsely successful service', async ({ page, request }) => {
  72  |   // Characterize the existing require_verified_counsellor boundary, not a final
  73  |   // decision that the Sprint 3 review workflow is part of Sprint 2 acceptance.
  74  |   // If the team deliberately changes that boundary, review this expectation.
  75  |   const email = `web-pending-${randomUUID()}@example.com`;
  76  |   const password = 'qa-pending-password';
  77  |   const registered = await request.post('/api/v1/auth/users', { data: {
  78  |     name: 'Pending browser counsellor', email, password, passwordConfirmation: password, role: 'counsellor',
  79  |   } });
  80  |   expect(registered.status()).toBe(201);
  81  |   const session = await login(page, email, password);
  82  |   expect(session.user.role).toBe('counsellor');
  83  |   expect(await ownServices(request, session.accessToken)).toEqual([]);
  84  |   const title = `Rejected pending publication ${randomUUID()}`;
  85  |   await serviceDraft(page, title, '70.50');
  86  |   const reply = page.waitForResponse(response => response.url().endsWith('/me/services')
  87  |     && response.request().method() === 'POST');
  88  |   await page.getByRole('button', { name: 'Publish service', exact: true }).click();
  89  |   const response = await reply;
  90  |   expect(response.status()).toBe(403);
  91  |   expect((await response.json()).code).toBe('FORBIDDEN');
  92  |   await expect(page.getByRole('alert')).toContainText(/verified/i);
  93  |   await expect(page).toHaveURL(/\/counsellor\/services\/new$/);
  94  |   await expect(page.getByLabel('Service title', { exact: true })).toHaveValue(title);
  95  |   await expect(page.getByLabel('Price (AUD)', { exact: true })).toHaveValue('70.50');
  96  |   await expect(page.getByText('Service published', { exact: true })).toHaveCount(0);
  97  |   expect(await ownServices(request, session.accessToken)).toEqual([]);
  98  |   const publicResult = await request.get('/api/v1/services');
  99  |   expect(publicResult.status()).toBe(200);
  100 |   expect((await publicResult.json() as Service[]).filter(item => item.title === title)).toEqual([]);
  101 | });
  102 | 
  103 | test('DEF-MONEY-CENTS: real persisted cents remain visible in the marketplace and service detail @defect', async ({ page, request }) => {
  104 |   const auth = await request.post('/api/v1/auth/sessions', { data: { email: seedEmail, password: seedPassword } });
  105 |   expect(auth.status()).toBe(200);
  106 |   const session: Session = await auth.json();
  107 |   const title = `Exact cents ${randomUUID()}`;
  108 |   const created = await request.post('/api/v1/me/services', {
  109 |     headers: { Authorization: `Bearer ${session.accessToken}` },
  110 |     data: { title, description: 'An actual API-created service whose price includes fifty cents.',
  111 |       priceMinor: 7050, currency: 'AUD', modalities: ['online'], location: null },
  112 |   });
  113 |   expect(created.status()).toBe(201);
  114 |   const service: Service = await created.json();
  115 |   const persisted = await request.get(`/api/v1/services/${service.id}`);
  116 |   expect(persisted.status()).toBe(200);
  117 |   expect((await persisted.json()).priceMinor).toBe(7050);
  118 | 
  119 |   await page.goto('/marketplace');
  120 |   await page.getByLabel('Search services or counsellors').fill(title);
  121 |   const card = page.getByRole('button', { name: `${title} by`, exact: false });
  122 |   await expect(card).toBeVisible();
  123 |   // Keep both independent display failures in the evidence instead of stopping
  124 |   // at the first screen. Do not import the production formatter as the oracle.
  125 |   await expect.soft(card).toHaveAccessibleName(/\$70\.50/);
  126 |   await card.click();
  127 |   await expect(page).toHaveURL(new RegExp(`/services/${service.id}$`));
  128 |   await expect(page.getByText('About this service', { exact: true })).toBeVisible();
  129 |   await expect.soft(page.getByText('$70.50', { exact: true }).filter({ visible: true }).first()).toBeVisible();
  130 | });
  131 | 
  132 | test('DEF-PRICE-SIGN: negative browser input must not publish a positive-price service @defect', async ({ page, request }) => {
  133 |   const session = await login(page);
  134 |   const title = `Negative price ${randomUUID()}`;
  135 |   await serviceDraft(page, title, '-70.50');
  136 |   const sentPrices: number[] = [];
  137 |   page.on('request', outgoing => {
  138 |     if (outgoing.url().endsWith('/me/services') && outgoing.method() === 'POST') {
  139 |       const body = outgoing.postDataJSON() as { title: string; priceMinor: number };
  140 |       if (body.title === title) sentPrices.push(body.priceMinor);
  141 |     }
  142 |   });
  143 |   await page.getByRole('button', { name: 'Publish service', exact: true }).click();
  144 |   // A correct implementation may reject in the form or let the API reject the
  145 |   // negative value. Either is acceptable; silently removing the minus is not.
  146 |   // Soft UI assertions keep persistence and transmitted-price evidence available
  147 |   // when the current bug redirects to the dashboard after creating the service.
  148 |   await expect.soft(page.getByRole('alert')).toBeVisible();
  149 |   await expect.soft(page).toHaveURL(/\/counsellor\/services\/new$/);
  150 |   expect.soft(sentPrices.some(price => price > 0), 'The submitted minus sign must not become a positive price').toBe(false);
  151 |   const saved = await ownServices(request, session.accessToken);
  152 |   expect(saved.filter(item => item.title === title), 'Invalid negative input must not persist a service').toEqual([]);
  153 | });
  154 | 
```