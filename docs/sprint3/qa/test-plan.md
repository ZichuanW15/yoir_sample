# Sprint 3 implemented-feature QA plan

Baseline: `cdcc44e66d647a9c5993736b797312b495715a3f` (`dev`), reviewed on
16 October 2026. The [matrix](qa-matrix.md) maps all 23 QA tasks to the exact
parent requirements in the [issue snapshot](issue-snapshot-20261016.json).
**Test owner: Wilson.**

This is a repeatable procedure and expected-outcome plan. It does not itself
record a successful execution. The [initial report](test-results-20261016.md) and
the follow-up reports linked below record the commands actually run, timestamps,
source hashes, environment, exit codes and per-case results. Earlier Sprint 2
results and the October walkthrough remain historical evidence for their own builds.

The later **16 October test-completion update** has its own
[execution report](test-results-completion-20261016.md). The additional procedures
below describe new source coverage; the initial dated report is retained and is
not relabelled as this later execution.

The subsequent [gap-follow-up report](test-results-gap-followup-20261016.md)
records the next **6 passing refresh regressions**, **3 reproduced refresh
defects**, and **4 failed new browser acceptance assertions** (0 skipped, 0 flaky,
no runtime errors). Their actual failure points are distinguished below.
It also distinguishes the full shared regression (568 passed) from the focused
shared/iOS/Android refresh runs (15 passed and, separately, 3 advisory failures
per preset). Earlier reports and their evidence remain unchanged.

The [first native device report](test-results-native-20261016.md) records D02/D03
passing on iOS and Android in Expo Go, with Android operated in IDEA. The
[remaining native case report](test-results-native-remaining-20261016.md) closes
the other 22 case/platform executions with **11 PASS, 8 FAIL and 3 BLOCKED**.
Together the recorded runs cover all 26 planned case/platform combinations:
**15 PASS, 8 FAIL and 3 BLOCKED**, with no wholly unrun case. Incomplete substeps
remain explicit in their original ledgers. Five supplementary workflow groups
are separately recorded as PASS in the report's
[execution information](test-results-native-remaining-20261016.md#execution-information);
they are not additional case/platform executions or replacements for the recorded
failures and blocked outcomes.

## Scope and priority

1. **US-09–11:** test the real diagnosis API's ownership, ordered durable saves,
   validation, retry/revision behavior, migration and concurrent access. Test
   frontend entry, local save/reopen, Back, validation and account switching as a
   separate boundary.
2. **US-12–13:** test the new backend direction and criteria endpoints, revision
   changes, incomplete/unauthorized reads and generation failure recovery. Test
   local rules and Explore handoff separately; app-to-API integration is absent.
3. **Other merged Sprint 3 features:** run existing targeted regression for
   onboarding, privacy/profile, verification, service edits, booking detail,
   rescheduling, admin oversight and recovery. Add cases where a concrete
   acceptance boundary lacks coverage rather than duplicating every old test.
4. **Review lifecycle:** test real eligible/ineligible buyer submission,
   duplicate rejection, comment/rating limits, cross-view aggregation, rollback,
   PostgreSQL competing writes and served-browser submission/error recovery.
5. **Admin and privacy:** cover stateful approval/rejection/resubmission, owner
   oversight, requester filtering, two-account isolation, fresh-session reads and
   failed-save recovery. Test both the direct admin APIs and current UI list lookup.
6. **Remaining implemented screens:** cover email verification, receipts, payout
   setup, notifications UI, Job Seeker home and professional detail, with loading,
   empty/error, pending/retry, role and navigation boundaries. Mark controlled HTTP
   and native/browser mocks explicitly. The notification backend is absent;
   notification UI tests cannot establish delivery or server persistence.
7. **Refresh and integration gaps:** exercise failure after a successful mounted
   load, focus return, and screen reaction to an already-renewed session. Keep
   correct failing assertions for stale data separately from recovery regressions.
   Add browser assertions for server-confirmed diagnosis advancement, refused-save
   recovery, fresh-browser server resume and explicit unrated profile wording.

Changes for this QA work are limited to tests, test tooling and evidence. Product
defects are recorded for the product owner/developers. Existing advisory suites
keep their assertions and failure reports; normal regression checks retain their
gates. An unexpected new failure is investigated before a pass claim is made.

## Environments and data

| Layer | Test environment | Evidence limit |
| --- | --- | --- |
| Model/component | Locked frontend dependencies; Jest shared preset and separately named iOS/Android presets | Fetch/storage/router/native dependencies may be mocked. No physical-device or full OS acceptance. |
| API + PostgreSQL | Real FastAPI/TestClient, Python 3.12, disposable loopback PostgreSQL database, test-only accounts | Tests may reset/drop data in their owned database. Mail/payment providers are intercepted or disabled. |
| Migration | Existing migration tests create separate temporary SQLite engines | Data-preservation assertions do not certify a real deployment rollback. |
| Web | Exported Web build, Chromium, repository `e2e/serve.py`, owned temporary SQLite and seeded fixtures | Test-only API on loopback; no deployed site, real provider transaction or PostgreSQL browser-concurrency claim. |
| Native device follow-up | iPhone 18 Pro / iOS 27.0 and IDEA Android 16 / API 36, Expo Go 57.0.9, owned SQLite API; environment and execution information recorded in the native reports | D02/D03: 4 PASS. D01/D04–D13: 11 PASS, 8 FAIL, 3 BLOCKED. Combined recorded runs: 15 PASS, 8 FAIL, 3 BLOCKED. Local fixtures, disabled mail provider and stub payments do not establish a signed build or deployed acceptance. Supplementary workflow results have their own execution information; Jest platform presets remain separate component evidence. |

Backend tests are destructive only inside an owned test database. The default
safe path unsets `DATABASE_URL` so `tests/conftest.py` creates temporary SQLite.
For PostgreSQL, use a new database named `yoir_test` or ending `_test` and set
`YOIR_QA_ALLOW_DATABASE_RESET=true` only for that owned target. Never point this
harness at development, staging or production data. Backend fixture code disables
real Stripe and Mailgun keys; the Web harness also uses its own database and
test-only session settings.

## Repeatable commands

Run commands from the stated directory with dependencies matching the repository
lockfiles. If `uv` is not installed, the current report must record the actual
equivalent environment setup; do not change `uv.lock` to accommodate the machine.
Run database suites serially against each owned database.

### Backend: focused diagnosis boundary

From `backend/`:

```bash
uv sync --locked
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest \
  tests/test_diagnosis.py tests/test_diagnosis_contract.py \
  tests/test_diagnosis_migration.py tests/test_diagnosis_qa_journeys.py \
  tests/test_diagnosis_direction.py tests/test_diagnosis_marketplace_criteria.py \
  tests/test_sprint3_api_journeys_qa.py tests/test_sprint3_privacy_profile_qa.py \
  tests/test_contract.py -q
```

This safe fallback uses temporary SQLite. Its concurrent-start/save results cannot
establish PostgreSQL transaction behavior. Repeat the selected API suite against an owned
PostgreSQL test database for those cases, recording the backend and all skips.

Full merged backend regression, from `backend/` in the prepared environment:

```bash
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest \
  tests -m 'not live and not future_contract' -q
uv run --no-sync ruff check app tests
```

The follow-up transaction/history/privacy cases can also be selected independently:

```bash
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest \
  tests/test_sprint3_completion_qa.py -q
```

A selected PostgreSQL command uses the same pytest selection with the owned test
database environment set instead of the two `env -u` flags. Record strict XFAIL
separately from pass; investigate unexpected XPASS/failure. Do not silently turn a
database startup or collection error into a defect assertion result.

### Frontend: targeted model and component boundary

From `frontend/`:

```bash
npm ci --no-audit
npm run test:ci -- --runTestsByPath \
  __tests__/diagnosis.test.ts \
  __tests__/screens/diagnosis.test.tsx \
  __tests__/diagnosis/useDiagnosis.test.tsx \
  __tests__/diagnosis/storage.web.test.ts
npm run test:ci -- --runTestsByPath \
  __tests__/screens/counsellor-onboarding.test.tsx \
  __tests__/screens/counsellor-dashboard.test.tsx \
  __tests__/screens/job-seeker-profile.test.tsx \
  __tests__/screens/privacy-reviews.test.tsx \
  __tests__/screens/counsellor-verification.test.tsx \
  __tests__/screens/counsellor-edit-service.test.tsx \
  __tests__/screens/counsellor-bookings.test.tsx \
  __tests__/screens/booking-detail.test.tsx \
  __tests__/screens/reschedule.test.tsx \
  __tests__/screens/forgot.test.tsx \
  __tests__/screens/reset.test.tsx \
  __tests__/api/verification-admin-client.test.ts
```

Additional admin/review component tests can be selected with:

```bash
npm run test:ci -- --runTestsByPath \
  __tests__/screens/admin-payments.test.tsx \
  __tests__/screens/admin-verifications.test.tsx \
  __tests__/screens/admin-overview-users.test.tsx \
  __tests__/screens/review-boundaries.test.tsx
```

Follow-up screen, mounted-focus and native-storage wrapper coverage:

```bash
npm run test:ci -- --runTestsByPath \
  __tests__/screens/verify-email.test.tsx \
  __tests__/screens/receipt.test.tsx \
  __tests__/screens/counsellor-payouts.test.tsx \
  __tests__/screens/notifications-panel.test.tsx \
  __tests__/screens/job-seeker-home.test.tsx \
  __tests__/screens/professional-detail.test.tsx \
  __tests__/screens/focus-refresh.test.tsx \
  __tests__/diagnosis/storage.native.test.ts
```

The `storage.native` source explicitly loads the native wrapper and controls
SecureStore. Its write-error case characterizes a swallowed exception, not a
durable save. Repeat applicable sources under the named iOS/Android Jest presets
for platform component results; those remain separate from device/keychain tests.

Focused mounted-refresh reruns, from `frontend/`, with the existing lockfile:

```bash
npm run test:ci -- --runTestsByPath __tests__/screens/focus-refresh.test.tsx
npm run test:ios -- --runTestsByPath __tests__/screens/focus-refresh.test.tsx
npm run test:android -- --runTestsByPath __tests__/screens/focus-refresh.test.tsx
```

The three new acceptance assertions stay in the independent advisory suite and
return nonzero while the product defects reproduce. Preserve that exit status
and JSON report; do not use `test.failing`, skip, or a success-shaped mock to hide
an unexpected failure. Run each command independently, from `frontend/`:

```bash
mkdir -p artifacts/sprint3-refresh
npm run test:defects -- --runTestsByPath __tests__/defects/sprint3-refresh-acceptance.test.tsx \
  --json --outputFile=artifacts/sprint3-refresh/shared.json
npm run test:ios:defects -- --runTestsByPath __tests__/defects/sprint3-refresh-acceptance.test.tsx \
  --json --outputFile=artifacts/sprint3-refresh/ios.json
npm run test:android:defects -- --runTestsByPath __tests__/defects/sprint3-refresh-acceptance.test.tsx \
  --json --outputFile=artifacts/sprint3-refresh/android.json
```

Validate report health separately using the actual runner outcome, for example
`node ../scripts/check_defect_report.cjs --format jest --report
artifacts/sprint3-refresh/shared.json --outcome failure` after a failed shared run.
Repeat for iOS/Android. A healthy report with failed assertions is not a pass.

The same component remains mounted while the test invokes controlled router
focus callbacks. Session tests call `adoptSession` through the real AuthProvider
bridge, then verify the new token on mocked API calls. They test reaction to a
session that has already been updated, **not** a real HTTP refresh-token exchange.
Neither this focus simulation nor the iOS/Android preset establishes device
navigation or OS focus behavior. The Users focus defect has a separate witness
proving that the simulated event occurred before the missing-reread assertion.

The diagnosis additions exercise screen, ownership-hook and controlled Web
storage behavior. The blocked/quota-storage cases characterize current fallback
behavior; they do not assert a successful durable save. Once changes are stable,
appropriate shared/platform regression and
quality checks are:

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run test:ios
npm run test:android
npm run test:defects
npm run test:ios:defects
npm run test:android:defects
```

The shared coverage command measures its configured source set. Current gates
apply to selected original API/marketplace/auth/format paths; passing them is not
90% coverage of every Sprint 3 screen. Record measured files/branches and uncovered
paths rather than deriving acceptance from one percentage.

### Web: real served application

From `frontend/` after the backend environment is ready:

```bash
npx playwright install chromium
EXPO_PUBLIC_API_URL=/api/v1 EXPO_PUBLIC_USE_DEMO_API=false npm run build:web
WEB_QA_OUTPUT_DIR=test-results/sprint3-normal npm run test:web
WEB_QA_OUTPUT_DIR=test-results/sprint3-defects npm run test:web:defects
```

Focused new browser acceptance rerun, from `frontend/`:

```bash
WEB_QA_OUTPUT_DIR=test-results/sprint3-integration-acceptance \
  npm run test:web:defects -- e2e/sprint3-integration-acceptance.spec.ts
```

This selects four ordinary `@defect` assertions, not passing characterizations.
Successful registration/login, diagnosis setup and readback use the real isolated
API. The save-acknowledgement case holds a real save response; the refused-save
case intercepts a matching save with 503. Both first require the application to
send that request. If it instead advances locally with zero requests, record a
missing-integration failure: **503 delivery, error UI, retained answers after
server refusal and retry were not reached and are not accepted**. Preserve the
readback attachment showing stored revision/step, not just the failing screenshot.
The resume case starts a fresh browser context with no prior local state and an
API-confirmed saved record. The unrated case confirms zero reviews and an
absent/null rating through the API before requiring neutral UI text; this endpoint
omits null-valued fields and the client normalizes a missing rating to null.

The recorded final run had four failed assertions: the first two
cases observed zero app save requests (API revision 0 / step 1; 503 not reached);
the fresh-context resume case had server revision 1 / step 2 but UI step 1; the
unrated case passed API/profile/no-star preconditions and then failed the explicit
neutral-text assertion. These failures are not setup errors and are not successful
save-recovery acceptance.

| Browser assertion / QA | Required result after a product fix |
| --- | --- |
| `S3-DIAGNOSIS-SERVER-ACK` / #165 | One real save request; no advancement while its response is held; after release, UI and API both report the saved answer and step 2. |
| `S3-DIAGNOSIS-SAVE-RECOVERY` / #165 | A save is attempted and actually receives the injected 503; visible error, retained answer and no advancement; removing interception permits one confirmed save on retry. |
| `S3-DIAGNOSIS-SERVER-RESUME` / #162/#168 | A clean browser context reads the existing API-confirmed step 2 and displays its saved answer when returning to step 1. |
| `S3-PROFILE-UNRATED` / #219 | A real zero-review professional has no fabricated rating and displays an explicit neutral unrated phrase. |

Focused diagnosis and advisory accessibility reruns, from `frontend/`:

```bash
npm run test:web -- e2e/sprint3-diagnosis.spec.ts
npm run test:web -- e2e/sprint3-workflows.spec.ts
npm run test:web -- e2e/sprint3-completion.spec.ts
npm run test:web:defects -- e2e/sprint3-accessibility.spec.ts
```

A selected radio must expose `aria-checked="true"` in the exported Web DOM; RNTL's native
`accessibilityState` assertion is not evidence that this Web attribute exists.

The Playwright config starts `e2e/serve.py` with a disposable SQLite database and
the exported build. Default URL is `http://127.0.0.1:43117`; an unused
`WEB_QA_PORT` may be supplied and must be recorded. `YOIR_QA_PYTHON` can select the
prepared backend interpreter. Use the project's pinned browser installation if
the local browser cache is missing. Keep normal and `@defect` report directories
separate when overriding `WEB_QA_OUTPUT_DIR` so one run does not overwrite the
other's evidence.

The [Web harness guide](../../../frontend/e2e/README.md) describes the additional
owned fixtures, including completed bookings for review eligibility, admin users,
and 201 historical orders for a direct-detail lookup boundary. Those fixture
states are not evidence of production fulfilment, refunds or payout transitions.
The browser tests write/read through the real API; deliberately failed HTTP
requests are labelled failure recovery, not outages observed in production.

`sprint3-completion.spec.ts` registers unique users through the real API and uses
the existing isolated administrator/unrated-service fixtures. It requires no
additional fixture endpoint. Administrator status writes, privacy saves and
reads all use the real API. Its rejected stale submission obtains an actual 409
after another actor approves the account; it is not a mocked failure response.

## Diagnosis scenarios and expected outcomes

The following cases describe the product boundary to exercise. Their execution
status is **NOT ESTABLISHED BY THIS PLAN**; link the actual test result before
calling a case passed.

| Case | Setup and action | Expected outcome / assertion boundary | QA |
| --- | --- | --- | --- |
| S3-D01 | New Job Seeker signs in; enter Home. Repeat as a guest and as a counsellor. | Job Seeker reaches diagnosis; guest reaches login; wrong role reaches its own home. No other user's local answers appear while storage loads. | #162 |
| S3-D02 | Start with blank required single-choice question; press Continue. Then choose an answer and continue. | Required answer displays a clear alert and does not advance. Valid input advances; empty optional multi-choice values are allowed. | #165, #168 |
| S3-D03 | Save first local step, reload/leave and return, then go Back and change it. | Same-device draft resumes at the saved step with populated answers. Back edits preserve other answers. This is labelled local persistence. | #162, #165, #168 |
| S3-D04 | API start twice; save ordered steps with returned revision; authenticate a new session for the same user. | One record, no reset on start, confirmed answers/revision/current step survive new session. | #162, #165, #168 |
| S3-D05 | Submit missing/extra metadata, unknown option, wrong type, duplicate multi-choice or out-of-order step. | Validation/state error; prior confirmed answers/revision unchanged. | #165, #168 |
| S3-D06 | Replay stale revision after another accepted write; on PostgreSQL race two writes and two starts. | Stale write cannot overwrite newer answers; exactly one competing revision wins; concurrent starts create one owned record. | #165, #168 |
| S3-D07 | Request foreign/unknown record; repeat reads/writes with guest, wrong role, expired/revoked credentials. | Auth/role/ownership errors, no private data leakage and no mutation. Foreign/unknown IDs have equivalent not-found behavior. | #162, #168 |
| S3-D08 | Force a database write failure after confirmed progress. | Error response and prior state retained. No successful save, increment or partially persisted answer. | #165, #168 |
| S3-D09 | Complete the five local input screens and reach result; abandon a retake before completion. | Result is sixth screen and shows local rule explanation/steps. Abandoned retake keeps previous completed direction. This is not API-generated result acceptance. | #165, #171 |
| S3-D10 | Test challenge, goal/situation fallback, barriers, previous attempts and no-diagnosis ranking fixtures. | Deterministic current rules; a barrier does not outrank the main match; no diagnosis produces no invented match claim. | #171 |
| S3-D11 | From completed direction open Explore, inspect `Best matches first`, then return to result. | Matching is applied to the loaded catalogue locally; result survives return; no backend filtering claim. | #174 |
| S3-D12 | Use no-fit/empty catalogue or a search with no matches, then clear/return. | Clear no-fit/empty message, local diagnosis retained, no fake match; result remains reachable. | #174 |
| S3-D13 | Reject professional/service fetch, then retry successfully. | Visible error and retry; no successful professional list fabricated during failure. This exercises catalogue loading, not server result generation. | #171, #174 |
| S3-D14 | Seed one user's local record, change/logout account and load another user's record asynchronously. | No previous-account answers rendered while new record resolves. Mocked storage evidence is distinguished from API ownership evidence. | #162, #168 |

### US-36 historical service-information probe

`backend/tests/test_sprint3_service_history_qa.py` creates a booking through the
real order/stub-payment APIs, edits the owned service title and meeting area,
then rereads the embedded order booking plus both participants' detail and list
views. Expected by parent #31 AC3: the original booked title and meeting area
remain unchanged, alongside the already frozen price, time and identifiers.

The test is a strict XFAIL for **S3-BE-SERVICE-HISTORY**. Its isolated SQLite probe
observed the new listing title and area leaking into all five historical views;
commercial/time/reference fields stayed unchanged. The current dated report
records any additional PostgreSQL execution. To reproduce the assertion without
expected-failure masking, from `backend/`:

```bash
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest \
  tests/test_sprint3_service_history_qa.py --runxfail -q
```

The unmasked command is expected to fail while the defect exists. No service
removal or broader deletion policy is inferred from this edit-only probe. The
separate `test_sprint3_completion_qa.py` source now exercises withdrawal with paid
upcoming/completed/paid-out bookings, both delivery modes, repeated withdrawal,
preserved participant/order/receipt/admin views, blocked new purchases and
failed-write rollback/retry. These cases do not edit the booked title/area and
therefore do not resolve the historical-edit defect.

### Additional API and component scenarios

| Boundary | Procedure and required outcome | Source / QA |
| --- | --- | --- |
| Derived diagnosis data | Complete all API steps, read direction/criteria, edit an earlier answer, submit derived criteria to services search, reject a stale save. Read failure must retain saved answers and retry without a new diagnosis. | `test_sprint3_api_journeys_qa.py`; #171/#174 |
| Reviews and ratings | Submit three ratings across two services; compare service and counsellor aggregates with persisted rows and public/participant reads. Reject injected IDs, invalid scores and overlong comments without changing totals. | Same file; #213/#216/#219 |
| Review transaction failure | Flush review and rating writes, fail commit, verify all rows/caches rolled back, then retry successfully. | Same file; #213/#216/#219 |
| Review competition | On PostgreSQL, run duplicate writes to one booking and simultaneous writes to two bookings on one/two services. Expect one 201 plus one 409 for duplicates; two rows and exact totals for distinct reviews. | `test_sprint3_review_concurrency_qa.py`; #213/#216/#219 |
| Verification and availability | Reject/re-submit/approve the same professional and publish using the same session; compare hold expiry, payment, rescheduling and cancellation across slots, calendar minutes and admin order detail. | `test_sprint3_api_journeys_qa.py`; #192/#195/#198/#204/#210/#222/#225 |
| Reschedule transaction failure | Flush booking/order changes, fail commit, verify original booking, order, calendar and admin detail; retry the same requested slot. | Same file; #225 |
| Privacy requester matrix | Save public/partial/restricted, authenticate again, compare guest/seeker/other-professional list and detail filtering, retain complete owner `/me` read. Rejected or failed writes must retain prior state. | `test_sprint3_privacy_profile_qa.py`; #183/#186 |
| Seeker profile | Save private fields, reject email/user-ID injection, log out/switch/re-login, reject non-seeker writes and inject a flushed-write commit failure followed by retry. | Same file; #189 |
| Privacy acceptance defects | After a confirmed Public setting and failed Restricted save, expect Public still selected. For partially visible profiles, require the API to omit private field keys as well as values. | `sprint3-privacy-acceptance.test.tsx`, `test_sprint3_privacy_contract_qa.py`; #183/#186 |
| Admin components | Load/refresh/retry lists and details, validate review reasons, confirm decisions before API calls, preserve form state on failure, render both user roles and enforce owner navigation. | Four admin/review component suites above; #198/#210/#222/#231 |
| Review components | Gate incomplete/nonbuyer/already-reviewed bookings; validate rating and comment, retain inputs after errors, prevent duplicate pending submission and use confirmed API response. | `review-boundaries.test.tsx`; #213 |

The PostgreSQL review race tests use controlled transaction barriers and actual
SQL/HTTP results. Three currently reproduced assertions use narrow, strict
`KnownAcceptanceDefect` XFAIL markers. Run them without masking for investigation:

```bash
# From backend, with DATABASE_URL pointing to an exclusively owned PostgreSQL
# database ending _test, and YOIR_QA_ALLOW_DATABASE_RESET=true:
.venv/bin/python -m pytest tests/test_sprint3_review_concurrency_qa.py --runxfail -q
```

This command currently fails for real defects; setup/runtime failures remain
ordinary failures. An expectation that starts passing is strict XPASS and requires
review/removal of its marker. A SQLite skip is not a passing concurrency case.

### Follow-up completion procedures

These source-backed scenarios close test-coverage gaps at the implemented
boundaries. Their execution results belong to the follow-up report; existing
defects are preserved and are not fixed by adding these tests.

| Boundary | Procedure and required outcome | Source / limit |
| --- | --- | --- |
| Verification transactions | Flush a submission or decision write, refuse commit, read own/public profile, queue, direct submission and administrator users from fresh sessions, then retry. Readers retain the prior status/URL/reason and no decision email is sent before success; successful decisions update all readers and publishing eligibility. | `test_sprint3_completion_qa.py`; real database transaction with injected commit fault and intercepted mail, not inbox delivery. |
| Cross-view status refresh | Load a different prior status, make real Pending/Verified/Rejected decisions, reload professional profile, My Services, verification page and admin user list; compare the persisted profile. Separately keep profile/workspace components mounted and trigger controlled focus callbacks. | `sprint3-completion.spec.ts`, `focus-refresh.test.tsx`; Web reload and mounted component focus are distinct evidence. |
| Failed verification UI | Load a rejected submission, approve through the administrator API, submit the stale form and require a real 409, visible error, retained input and no false Pending. Reload displays the confirmed Verified state. | `sprint3-completion.spec.ts`; no successful HTTP responses are mocked. |
| Profile and payment refresh | After a successful load, fail a profile refocus: hide the old badge and show unavailable, then recover. While a profile save is pending, refocus must retain the draft. Fail a payment-list refocus: old rows disappear, error is distinct from empty, retry loads fresh data. | Existing `focus-refresh.test.tsx` cases; separate from workspace/Users defects below. |
| Workspace recovery and adopted session | After success, fail the next profile read, display the error, then recover profile/service/window data on another focus. Adopt a new token through AuthProvider and require each workspace API dependency to use it without a new login. | 2 added regressions in `focus-refresh.test.tsx`; mocked API and focus. The successful recovery does not accept the stale badge displayed during failure. |
| Mounted Users adopted-session recovery | For each role view, adopt a new token and display fresh directory values. Separately fail either of the two directory reads, then retry both with that token and replace prior rows only after a successful response. | 4 added regressions in `focus-refresh.test.tsx`; no HTTP refresh-token exchange occurs. |
| Refresh defect acceptance | Confirm the intended failed read or independent focus witness. Require an unavailable workspace status after failed refocus; require mounted Users to reread on focus; withhold stale directory rows/actions after an adopted-session read fails. | 3 ordinary advisory assertions in `sprint3-refresh-acceptance.test.tsx`: `S3-WORKSPACE-STALE-STATUS`, `S3-ADMIN-USERS-FOCUS`, `S3-ADMIN-USERS-STALE-REFRESH`. All three currently reproduce; see the gap-follow-up report. |
| Privacy changes | Start with visible private details, change Public→Partial→Restricted→Public in the owner UI, explicitly reload the already-open guest page, remove private values/links, and restore them only after Public. API cases repeat transitions for guest/seeker/owner public-route reads and retain the full owner `/me` record; refused commits must not partially change readers. | Web/API completion sources and `professional-detail.test.tsx`; explicit reload is not automatic live update. Empty-key omission remains a separate defect. |
| Unrated and empty discovery | Use a real zero-review service: marketplace says New, service detail has no written reviews, and public profile does not invent a score. A no-match search must still allow return/reload of the local direction and retake with saved answers. Home empty/error catalogue states retain the completed direction. | `sprint3-completion.spec.ts`, `professional-detail.test.tsx`, `job-seeker-home.test.tsx`; explicit unrated-profile text is still absent, and diagnosis remains local. |
| Email confirmation and receipts | Delay confirmation before adopting its session; reject bad/missing tokens, preserve retry on network errors, validate resend and prevent duplicate pending actions. Load receipts with exact cents and applicable supplier/buyer/tax fields; show no receipt facts for pending/error/guest/missing-ID reads and retain Back behavior. | `verify-email.test.tsx`, `receipt.test.tsx`; controlled HTTP, not real mailbox/deep-link, financial/legal or provider sign-off. |
| Payout setup | Exercise role/readiness gates, polling-result handling and unmount cancellation wiring, fresh onboarding URL and return-status read, browser/request errors, ABN/GST input rules and tax-save pending/retry. | `counsellor-payouts.test.tsx` mocks the polling helper; existing `payments/waitForPayouts.test.ts` separately verifies its retry limit and timing. Controlled API/browser; no actual Stripe onboarding, transfer or tax-rule approval. |
| Notifications UI | Exercise guest/authenticated loading and cached rows, read/unread state, individual/bulk local updates, navigation, reopen refresh and logout hiding. Missing endpoints must use the implemented fallback without fabricating persisted notifications. | `notifications-panel.test.tsx`; the backend is absent. Optimistic local marking and simulated successful responses are not server persistence/delivery evidence. |
| Native diagnosis wrapper | Forward exact per-user keys and serialized data; unreadable storage returns no record; rejected writes are characterized explicitly as swallowed errors. | `diagnosis/storage.native.test.ts`; mocked SecureStore only, not device restart or secure-storage acceptance. |

### Remaining acceptance: reproduced failures, unreached paths and unrun environments

The browser acceptance source now attempts previously missing app boundaries;
that does not make them accepted. Read its recorded result in the gap-follow-up
report. A missing request is an executed integration failure while the downstream
503 recovery path is **not reached**. Both native runs are now closed: their
26 case/platform outcomes total **15 PASS, 8 FAIL and 3 BLOCKED**. The local
run reproduced four defects on both platforms: failed onboarding reads opening
the workspace, service edits changing historical titles, booking-read failures
appearing as empty lists, and duplicate email-resend requests while pending.
Supplementary workflow PASS confirmations are recorded in the
[execution information](test-results-native-remaining-20261016.md#execution-information).
They do not specify a complete platform, build or substep matrix, and therefore
do not establish every password-token, provider-return or webhook edge case.
Component/API passes and supplementary workflow confirmations do not override
these distinctions:

- App advance only after server save; app failed-save recovery and stale-revision
  reconciliation; cross-device restore of backend-confirmed diagnosis progress.
- Frontend consumption and failure UI for the now-implemented backend direction/
  criteria responses; approved questionnaire topic-bank/conditional/matching rules.
- Complete parent acceptance where recorded service-history, concurrent-review,
  accessibility or admin defects remain. Passing sequential review flows do not
  override failed concurrent aggregation.
- Explicit unrated wording on the public professional profile; an absent score
  is not that wording. Safe stale-data handling on a mounted administrator Users
  view after session adoption/read failure, and on workspace failed refocus, now
  have separate ordinary failing acceptance assertions. Users also fails to
  reread on simulated focus. The recovery regressions do not resolve these
  reproduced failures or establish an end-to-end HTTP token-renewal journey.
  The separately recorded D06 native focus/return checks retain their own scope.
- Real notification backend delivery/read persistence; only the implemented
  frontend fallback, local state and client request boundary are covered.
- Signed standalone-build storage behavior and release-environment link routing.
  Recorded Expo Go runs cover local picker, browser handoff and route checks
  within their stated limits; the five supplementary groups cover email,
  password reset, payment-provider flow, offline recovery and Android photo
  denial at workflow level. Exact build/platform execution details and the
  valid/expired/reused/altered reset-token, session-policy, provider cancellation/
  return and webhook substeps still require mapped evidence before they can be
  accepted individually. D02 observes same-device local diagnosis persistence
  after restart and account switching; it is not a storage security audit or
  cross-device/server-backed restore.
- Shared deployment migration/rollback, a real meeting-provider session and signed
  release-build acceptance. Local SQLite fixtures and stub-paid orders do not
  establish these boundaries or live payment transfers.

## Recording and completion criteria

For each executed command retain the command text, start/end time, interpreter/
browser/OS versions, product commit, test-file changes/hashes, exit code, per-case
outcomes and relevant failure diagnostics. Name the test database backend without
publishing secrets. Record any mocked network/provider boundary beside the result.

Use separate counts for **passed**, **failed**, **XFAIL**, **skipped** and **not run**.
If a new issue is found, record the input, expected result, actual result and a
reproduction selector. A passing test that merely characterizes current behavior
does not override a conflicting parent requirement.

A QA task is ready for team acceptance only when each parent criterion has linked
execution evidence or an explicitly agreed remaining-scope decision. Neither the
issue's closed frontend/backend subtask nor an advisory-green CI run closes a QA
task automatically. Remote issue updates, release tags and publication are
separate actions from this local QA run.

## Supplemental recovery boundaries

`backend/tests/test_sprint3_recovery_boundaries_qa.py` covers signed event ordering,
metadata fallback when the provider intent ID has not been persisted, transactional
rollback of webhook event claims and bookings, repeated delivery, and per-row
expiry/payout recovery. Existing recording provider fixtures intercept SDK calls;
HMAC verification is real. These are local integration boundaries, not real
provider payment/transfer evidence. Run the file with the same isolated database
setup as the complete backend suite. Existing defects are unchanged.

[Device/external procedures](device-acceptance.md) link both completed native
reports: D02/D03 contributed 4 PASS; D01/D04–D13 contributed 11 PASS, 8 FAIL and
3 BLOCKED. The combined recorded ledger is **15 PASS, 8 FAIL and 3 BLOCKED**
across 26 case/platform combinations. Supplementary workflow PASS confirmations
remain separately linked in
[execution information](test-results-native-remaining-20261016.md#execution-information),
without altering original counts or implying coverage of unspecified substeps.
