# Sprint 3 QA procedures — executed scope

**Review:** 17 October 2026, Australia/Melbourne. **Owner:** Wilson (`Zhouzhny`).
**Current dev baseline:** `9cce9737ded87c13a7575d7236a051c5db7628f8`.

The [QA matrix](qa-matrix.md) maps all 23 tasks to parent criteria and executable
sources. The [latest meeting-area report](test-results-meeting-area-20261017.md)
records new API, migration, browser and advisory commands, times and outcomes.
The [06:33 UTC component refresh](test-results-dev-refresh-20261017.md) retains
full regression and coverage results for the unchanged frontend source boundary.
The [earlier full report](test-results-final-20261017.md) keeps its dated API,
browser and live-client results for the previous product.
These procedures reproduce the recorded executions.
Failed assertions retain their recorded outcomes.

## 1. Scope and expected outcomes

| Area | Procedures and expected outcomes |
| --- | --- |
| Diagnosis entry/resume | Load backend questionnaire and owned record, handle absent record, reject guest/wrong role/foreign IDs, reopen from a fresh browser, and ignore late previous-account responses. |
| Diagnosis validation/save | Enforce the implemented five input steps plus result; retain Back/edit answers; send questionnaire version and expected revision; do not advance before successful acknowledgement; preserve inputs after refused saves and permit retry. |
| Diagnosis result/retake | Load backend direction/criteria; reject incomplete/unauthorized result reads; retry a derived-result failure without saving the confirmed answer again; preserve the previous confirmed result when a retake is cancelled; completed retake updates the same record. |
| Explore handoff | Allow the ordinary catalogue to load independently; wait for supported server criteria before the diagnosis-filtered request; verify query/filter mapping, no-match state, unsupported-signal explanation, search recovery and return to the unchanged diagnosis. |
| Privacy/profile | Exercise both member roles and all visibility levels, owner/visitor/admin boundaries, invalid inputs, omitted private keys, no-store headers, hidden-field search exclusion, persisted transitions and flushed-write rollback/retry. |
| Service/order history | Buy before/after a rename, change price/location, withdraw the listing, then check buyer/counsellor/admin views, receipts, mail rendering and commission statements. Titles, purchase prices and general meeting areas must remain tied to each order. Exact booking addresses remain independently editable. Distinguish frozen empty areas from legacy null fallback, and retain the upgrade-time migration boundary. |
| Remaining Sprint 3 stories | Maintain onboarding, verification, administration, booking/reschedule, reviews/aggregates, password reset and profile regression. Check pending, empty, failure/retry, role/account isolation and cross-view state. |
| Concurrency/recovery | Run real PostgreSQL competing diagnosis saves, booking/reschedule and review writes. Check atomic rollback and retry; record strict XFAIL individually. |
| Shared critical path | Repeat registration/login/logout, marketplace, reservation and implemented stub-payment journeys through actual HTTPX and TypeScript clients. |

Tests and fixtures are updated for the latest implementation. Product code,
dependencies and CI gates are not changed by QA. Deleted local diagnosis model
and storage tests are replaced with API-bound assertions. Fixed privacy omission,
diagnosis integration, frozen-title and backend meeting-area checks run as normal
regressions. The latest product change comes from upstream PR #244.

## 2. Environments and data

- **Jest:** installed locked frontend dependencies; shared, iOS and Android presets
  run separately with controlled network, router, native and device seams.
- **PostgreSQL:** create a new loopback instance/database exclusively for this run.
  Test databases must end in `_test`. `YOIR_QA_ALLOW_DATABASE_RESET=true` is permitted
  only for that owned database. The suite clears its test tables.
- **SQLite:** `tests/conftest.py` creates a temporary fallback when `DATABASE_URL`
  is unset. Migration tests and the browser harness own separate temporary SQLite
  databases. SQLite results must not be labelled PostgreSQL concurrency evidence.
- **Web:** fresh Expo export, Chromium, `frontend/e2e/serve.py`, real seeded local
  API and one worker with zero retries. Successful responses remain real; explicit
  route delays/503s/aborts exercise failure paths.
- **Live clients:** a separate PostgreSQL database and separately started loopback
  API. Set test-only credentials, disable Stripe/Mailgun and use verified seeded
  buyer `alex@example.com` / `password123`. Do not use deployed accounts or data.

Record Node/npm/Python/PostgreSQL versions, both source revisions, source hashes,
commands, timestamps, exit codes and environment boundaries. Preserve initial
failures as well as corrected final runs. Do not publish access tokens or keys.

## 3. Dependency preparation

From the repository root, with Node 20 and Python 3.12 available:

```bash
npm --prefix frontend ci --no-audit
uv sync --locked --project backend
cd frontend
npx playwright install chromium
```

`uv` is not required if the existing Python 3.12 virtual environment already
matches `backend/uv.lock`; record that choice and installed versions. Do not
rewrite lockfiles simply to fit a developer machine.

## 4. Shared and platform components

From `frontend/`, choose a new output directory for each execution:

```bash
mkdir -p artifacts/final-qa
npm run lint
npm run typecheck
npm run test:coverage -- --json --outputFile=artifacts/final-qa/shared.json
npm run test:ios -- --json --outputFile=artifacts/final-qa/ios.json
npm run test:android -- --json --outputFile=artifacts/final-qa/android.json
npm audit --omit=dev --audit-level=critical --json
```

Focused diagnosis sources include `__tests__/api/diagnosis-client.test.ts`,
`__tests__/diagnosis/useDiagnosis.test.tsx`,
`__tests__/screens/diagnosis.test.tsx`,
`__tests__/screens/diagnosis-server-qa.test.tsx`,
`__tests__/screens/job-seeker-home.test.tsx` and
`__tests__/screens/marketplace-diagnosis.test.tsx`.
Use `--runTestsByPath` to select a focused correction; do not present its count as
another complete suite.

The dev-document refresh also executes `screens/privacy-settings-boundaries.test.tsx`,
`screens/onboarding-focus.test.tsx`, `screens/service-booking-recovery.test.tsx`,
`screens/feedback-response-contract.test.tsx`, `screens/forgot.test.tsx` and
`screens/reset.test.tsx`. The new cases exercise server acknowledgement, failure
recovery, duplicate prevention and response-shaped rendering through the real
client or explicitly controlled API seam. Their retained **17 October 06:33 UTC**
full shared/iOS/Android results are 597/606/606 passed. Recorded outputs use
`artifacts/qa/sprint3-dev-refresh-20261017/` and the exact command arguments in
[executions.json](evidence/20261017-dev-refresh/executions.json).

Existing numeric gates apply separately to API, marketplace, auth and formatting
sources (90% statements, 80% branches, 90% functions, 90% lines). Whole configured
app coverage is reported separately, with the exclusions in `jest.config.js`.

Run each advisory command separately and retain its real nonzero exit status:

```bash
npm run test:defects -- --json --outputFile=artifacts/final-qa/shared-defects.json
npm run test:ios:defects -- --json --outputFile=artifacts/final-qa/ios-defects.json
npm run test:android:defects -- --json --outputFile=artifacts/final-qa/android-defects.json
```

Validate each report with `node ../scripts/check_defect_report.cjs --format jest
--report <report.json> --outcome failure` (or `success` if its actual command
succeeded). Report-health success does not turn failed assertions into passes.

The dev-document advisory execution includes `defects/sprint3-private-matches.test.tsx`
and `defects/sprint3-reschedule-acceptance.test.tsx`. The first uses omitted-key
privacy responses checked against the actual backend mapper. The second injects
a slot-read 503 and rejects a false no-availability state. Both preserve intended
correctness assertions and actual failure diagnostics.

The meeting-area execution also includes
`defects/sprint3-confirmation-history.test.tsx`. Its controlled transport sends
Melbourne in the purchased booking and Geelong in the current listing. The test
waits for the real client to receive the booking before asserting that the
confirmation screen must show Melbourne. `S3-CONFIRMATION-AREA` records the actual
remaining failure; a completed API response is distinguished from a loading state.

## 5. Backend API, database and migration tests

From `backend/`, with the newly created PostgreSQL target explicitly exported:

```bash
.venv/bin/python -m compileall -q app reset_db.py
.venv/bin/python -m ruff check app tests reset_db.py
mkdir -p artifacts/final-qa
.venv/bin/python -m pytest tests -m 'not live and not future_contract' -q \
  --junitxml=artifacts/final-qa/pytest.xml \
  --cov=app --cov-report=term-missing \
  --cov-report=xml:artifacts/final-qa/coverage.xml \
  --cov-report=json:artifacts/final-qa/coverage.json
```

Set `DATABASE_URL=postgresql://<test-user>@127.0.0.1:<owned-port>/<owned_name>_test`
and `YOIR_QA_ALLOW_DATABASE_RESET=true` only for the disposable database. The
fixture safety guard validates this boundary. Mail and payment provider keys are
overridden by the test harness; product transactions are not contacted.

A safe focused SQLite fallback is:

```bash
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET .venv/bin/python -m pytest -q \
  tests/test_sprint3_final_marketplace_qa.py \
  tests/test_sprint3_final_history_qa.py \
  tests/test_sprint3_privacy_contract_qa.py
```

Meeting-area sources are `tests/test_sprint3_service_history_qa.py`,
`tests/test_sprint3_meeting_area_migration_qa.py`, and the upstream service/migration
regressions in `tests/test_counsellor.py`, `tests/test_migrations.py` and
`tests/test_diagnosis_migration.py`. They check purchase-time snapshots, both
participants' reads, rendered mail, address/reschedule independence and migration
`0012` data preservation, repeated upgrade and downgrade/re-upgrade. The QA
migration fixture owns a private PostgreSQL schema when the suite uses PostgreSQL;
its SQLite fallback owns a separate temporary file.

For a focused repeat of the new QA sources, from `backend/` with the owned test
database environment set:

```bash
.venv/bin/python -m pytest -q \
  tests/test_sprint3_service_history_qa.py \
  tests/test_sprint3_meeting_area_migration_qa.py
```

The [meeting-area evidence](evidence/20261017-meeting-area/README.md) records the
actual full/focused commands and outcomes. Migration backfill uses the listing
area at upgrade time; it does not reconstruct an earlier location that was never
stored. An empty stored area is a snapshot; only null uses the legacy fallback.

Record strict XFAIL and unexpected XPASS separately. A fixed
strict-XFAIL scenario should become an ordinary regression after verification;
never silently suppress XPASS or weaken the original expected behavior.

## 6. Served-browser and live-client checks

From `frontend/`:

```bash
EXPO_PUBLIC_API_URL=/api/v1 EXPO_PUBLIC_USE_DEMO_API=false npm run build:web
WEB_QA_OUTPUT_DIR="$PWD/test-results/final-regression" npm run test:web
WEB_QA_OUTPUT_DIR="$PWD/test-results/final-defects" npm run test:web:defects
```

The commands use different report directories so the defect run cannot overwrite
the regression report. `serve.py` owns the temporary database and exits with the
Playwright server lifecycle. `WEB_QA_PORT` can select an unused loopback port.
Inspect per-case status, retries, runtime errors and attachments, not only the
summary or process exit code. Validate the defect report with
`check_defect_report.cjs --format playwright` and its actual command outcome.

The latest execution ran the original full Chromium regression selection first
(**38 passed**), followed by a separate focused new case (**1 passed**):

```bash
WEB_QA_OUTPUT_DIR="$PWD/test-results/meeting-area-focused" \
  npm run test:web -- e2e/sprint3-meeting-area.spec.ts
```

`sprint3-meeting-area.spec.ts` creates a dedicated in-person service and window,
places an order and pays through the stub API. After moving the listing from
Melbourne to Geelong, it reads booking detail in separate buyer and counsellor
browser sessions and through authenticated API reads. Both retain Melbourne;
withdrawal leaves those details intact. The test attaches both viewers' screenshots
and a readback record. Its focused pass is not presented as a fresh 39-case full run.
The browser advisory execution recorded **1 passed / 7 failed**, with report health
passing. Exact commands, dates and artifacts are in the meeting-area report.

For live clients, start `uvicorn app.main:app` against the separately owned seeded
PostgreSQL database with external providers disabled. Set `FRONTEND_DIST` to the
fresh export. Verify `/`, a service deep link and an unknown API path (JSON 404).
Export `LIVE_API_BASE_URL`, `LIVE_API_VERIFIED_EMAIL` and
`LIVE_API_VERIFIED_PASSWORD` for both clients, then run serially:

```bash
# backend/
.venv/bin/python -m pytest tests/test_live_api.py -q --junitxml=artifacts/final-qa/live.xml
# frontend/
npm run test:client:live -- --json --outputFile=artifacts/final-qa/live-client.json
```

## 7. Repository and evidence checks

Run repository metadata/OpenAPI/traceability validation, Board Insights tests,
QA recorder/packager/report-health tests and whitespace checks. Check actual
tracked/published Markdown rather than ignored local backup directories. Verify
all evidence hashes and source fingerprints, resolve stale links and confirm
that product files equal the recorded `dev` baseline.

Historical reports retain their dates and outcomes. A deleted historical source
may be linked to its original commit; do not replace a prior result with today's
one. Store selected logs, per-case results, coverage and manifests in the dated
team-space evidence directory. Large regenerable HTML/trace bundles may remain
in local/CI artifacts only when the manifest explicitly lists the omission.

## 8. Recorded native procedures and hand-off

The [device procedures](device-acceptance.md) describe the completed 16 October
Expo Go observations on the iOS simulator and Android emulator, using that
date's product revision and isolated local API. The completed cases total
**23 case/platform outcomes: 15 PASS and 8 FAIL**. Their procedures and findings
retain their original execution dates. The 17 October iOS and Android results
are separate Jest component-preset executions.

Supplementary tester confirmations for mail, reset, payments, offline recovery
and Android permission denial retain their attribution in the native reports.
They are separate from the captured case/platform totals.

The hand-off contains all 23 QA task mappings, command/result records,
repeatable procedures, source and evidence hashes, and the actual regression,
advisory and strict-XFAIL outcomes. QA issue status and test outcome are recorded
separately.
