# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: integrity.spec.ts >> DEF-MONEY-CENTS: real persisted cents remain visible in the marketplace and service detail @defect
- Location: e2e/integrity.spec.ts:103:5

# Error details

```
Error: expect(locator).toHaveAccessibleName(expected) failed

Locator: getByRole('button', { name: 'Exact cents 2b2b7cd1-3fea-4f7f-be9a-91104c5411a3 by' })
Expected pattern: /\$70\.50/
Received string:  "Exact cents 2b2b7cd1-3fea-4f7f-be9a-91104c5411a3 by Maya Chen, $71"
Timeout: 5000ms

Call log:
  - Expect "soft toHaveAccessibleName" getByRole('button', { name: 'Exact cents 2b2b7cd1-3fea-4f7f-be9a-91104c5411a3 by' }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'Exact cents 2b2b7cd1-3fea-4f7f-be9a-91104c5411a3 by' })
    14 × locator resolved to <button tabindex="0" role="button" type="button" class="css-g5y9jx r-1loqt21 r-1otgn73" aria-label="Exact cents 2b2b7cd1-3fea-4f7f-be9a-91104c5411a3 by Maya Chen, $71">…</button>
       - unexpected value "Exact cents 2b2b7cd1-3fea-4f7f-be9a-91104c5411a3 by Maya Chen, $71"

```

```yaml
- button "Exact cents 2b2b7cd1-3fea-4f7f-be9a-91104c5411a3 by Maya Chen, $71":
  - text: MC Maya Chen
  - img
  - text: Verified $71 Exact cents 2b2b7cd1-3fea-4f7f-be9a-91104c5411a3 An actual API-created service whose price includes fifty cents. Online
  - img
  - text: New (0)
```

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('$70.50', { exact: true }).visible().first()
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "soft toBeVisible" getByText('$70.50', { exact: true }).visible().first() with timeout 5000ms
  - waiting for getByText('$70.50', { exact: true }).visible().first()

```

```yaml
- button "Back":
  - img
- text: Service details
- img
- text: Career service Exact cents 2b2b7cd1-3fea-4f7f-be9a-91104c5411a3 $71 per session Online New on Yoir About this service An actual API-created service whose price includes fifty cents. MC Maya Chen Verified counsellor Career counsellor specialising in early-career transitions and interview preparation.
- img
- text: 4.9 · 46 reviews How it is delivered
- img
- text: Online. Joining details are shared with your confirmation. Booking this service 1 Choose a time that suits you from the counsellor's open slots. 2 Pay through Yoir — this build uses a clearly labelled test payment. 3 Get a confirmation with the reference, time and delivery details.
- button "Book this service":
  - img
  - text: Book this service
```

# Test source

```ts
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
  68  |   ).toBeVisible();
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
> 129 |   await expect.soft(page.getByText('$70.50', { exact: true }).filter({ visible: true }).first()).toBeVisible();
      |                                                                                                  ^ Error: expect(locator).toBeVisible() failed
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