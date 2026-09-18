<!--
  Exported from the project wiki. Do not edit here - edit the wiki page and re-export.
  Source page: Sprint 2 Test Approach
  Source URL:  https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Test-Approach
  Wiki commit: 5c23698 (2026-09-18)
  Exported:    2026-09-18
-->

# Sprint 2 Test Approach

This page defines the QA approach, acceptance gates and evidence boundary for Sprint 2. It follows the structure of [Sprint 1 Test Approach](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-1-Test-Approach), with the current availability-window, booking and authentication contracts. The evidence edition is **18 September 2026**. Its version-controlled sources are the [dev-sync review and results](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/8aa24284dbbcf64a18e63b783cf43648574d75c6/docs/sprint2/qa/dev-sync-review-20260918.md), [machine-readable validation](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/8aa24284dbbcf64a18e63b783cf43648574d75c6/docs/sprint2/qa/dev-sync-validation-20260918.json) and [Application CI workflow](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/8aa24284dbbcf64a18e63b783cf43648574d75c6/.github/workflows/app-ci.yml).

## Ownership and exact baseline

The QA Lead is **Zhenyang Zhou**. QA work covers tests, fixtures, test tooling, CI, traceability and evidence. Product behaviour is not changed to manufacture passing results. The dev-sync preserved dev's production behaviour; its only production-file difference was removal of a trailing blank line for the whitespace check.

| Purpose | Exact source |
|---|---|
| Product baseline integrated into QA | `dev@776899c8e59669c831b8608513c0567921cb339f` |
| QA integration branch | `sprint2-qa` |
| Updated QA and evidence commit | `8aa24284dbbcf64a18e63b783cf43648574d75c6` |
| Integration into dev | [PR #155](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/155), merge commit `d1c429e5281140c0d20d8c1cc9357d629a296d86` |
| Latest dev observed while preparing this page | `a5b7571aa16dc9cc5747a00fa78aa4d0b7d3534c`, after management-dashboard PR #159 |

The recorded runs used the conflict-resolved working tree subsequently committed as `8aa2428`; source SHA-256 fingerprints bind the results to the tested files. PR #155 has since been merged. The later PR #159 changes are **not covered by these results** and require validation on their own revision. Publication of this page does not create new application-test evidence.

The 15/16 September reports, scope snapshots and native observations remain dated records of the earlier product. This page and the 18 September dev-sync report describe the updated test boundary; earlier demo-API and slot-model assumptions must not be carried forward.

## Evidence language

| Classification | Meaning |
|---|---|
| Pass | The stated check executed successfully on the identified source and environment |
| Fail | An executed assertion found a discrepancy requiring investigation |
| strict XFail | A documented known defect was reproduced; it is not a Pass |
| Todo / Planned | A named boundary is not yet an executable acceptance result |
| Skip | A declared environment or precondition was absent; it is not a Pass |
| Deselected | A test was outside the selected run; it is not a Pass |
| Blocked | Required implementation, environment or owner decision is absent |
| Not Run | No execution evidence exists for the exact source and environment |

Advisory is a **CI policy**, not a test result. An advisory failure remains a Fail. A strict XFail that unexpectedly passes fails the run and requires review of the expectation. Fixture, collection and transport failures must be identified as test-harness problems rather than evidence of a named product defect.

## Scope and repeatable case groups

Tests follow the current application contract: counsellors own `AvailabilityWindow` records; services specify `durationMinutes`; available booking starts are derived from windows, modality, bookings and active holds. Order requests use `startsAt`. Booking consumes an interval without deleting the underlying availability window.

| Case group | Procedure and expected outcome |
|---|---|
| Registration and sessions | Register both roles; check invalid fields, duplicate emails, concurrent registration and preservation of the existing account. Exercise login, refresh and logout/revocation. Reject unauthorized requests without mutation. |
| Marketplace and service detail | Read real active services, search and filter, open details and handle unavailable services or network failures. UI filtering and server query behaviour have separate assertions. |
| Counsellor services and profile | Create, read, update and delete supported service data, including duration and modality. Read and update profile data through the current APIs. Check ownership, permissions, validation and retained drafts on failure. |
| Availability windows | Create, merge, edit and delete future windows; verify read-back, timezone offsets and modality restrictions. Protect booked/held intervals and reject foreign-owner changes. |
| Booking and payment | Derive open starts, select a service/time/modality, create an order and complete the local payment flow. Check persisted orders/bookings, retries, expiry and cross-service contention; reject unavailable starts and foreign orders. |
| Verification and roles | Assert the email-verification booking gate and counsellor publishing restrictions. Use verified seed buyers for successful live booking journeys. Permission tests characterize the implementation without deciding unresolved product policy. |
| Robustness | Probe malformed API bodies, error recovery, empty availability, price formatting, calendar failures, DST, confirmation-route data and startup/font failures. Keep unresolved assertions visible. |
| Harness and traceability | Validate database isolation, repeated setup/teardown, response mocks, source fingerprints, result-report health, contract mappings and repository metadata. |

Detailed executable steps live in the [backend tests](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/tree/8aa24284dbbcf64a18e63b783cf43648574d75c6/backend/tests), [frontend tests](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/tree/8aa24284dbbcf64a18e63b783cf43648574d75c6/frontend/__tests__) and [browser journeys](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/tree/8aa24284dbbcf64a18e63b783cf43648574d75c6/frontend/e2e). Independent fixtures or dedicated server/database instances isolate cases.

The [runtime contract test](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/8aa24284dbbcf64a18e63b783cf43648574d75c6/backend/tests/test_contract.py) checks **46 implemented operation IDs**. The published OpenAPI document and traceability CSV contain **58 operations and 58 corresponding rows**. Route presence and traceability parity do not establish acceptance of every user story. Payment-provider, verification and admin routes may exist without device, external-provider or complete screen-level acceptance evidence.

## Risk-based test pyramid

| Level | Boundary and evidence limit |
|---|---|
| Static | ESLint, TypeScript, Ruff, Python compilation, Actionlint, JSON/YAML/Markdown, contract metadata and whitespace |
| Shared frontend unit/component | API client, authentication state, planner and screens with mocked external seams; does not prove backend persistence |
| iOS and Android components | Separate Expo presets and platform guards; device services remain mocked |
| Backend API | FastAPI routes through validation, authorization and SQLAlchemy using isolated fixtures |
| PostgreSQL | Actual database persistence, migrations, constraints and concurrent reservation behaviour |
| Chromium Web | Built frontend with a real API and temporary SQLite; does not substitute for PostgreSQL or native-device testing |
| Live HTTP and TypeScript client | Separate Uvicorn process with PostgreSQL; HTTPX and the real TypeScript client using unmocked network requests |
| Simulator/device | Separate manual evidence tied to the exact native app, OS and API revision; no new device run for `8aa2428` |
| External services/deployment | Actual provider charges, delivered email and deployed-environment acceptance are not established by local stubs or mocks |

Counts from these layers are not added together as distinct features: they deliberately revisit important risks at different boundaries.

## Database and test-environment safety

The [QA fixtures](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/8aa24284dbbcf64a18e63b783cf43648574d75c6/backend/tests/conftest.py) validate the reset target before importing the product engine:

- SQLite is permitted only for the exact temporary file created by that QA run.
- PostgreSQL requires a dedicated database whose name ends in `_test` and explicit `YOIR_QA_ALLOW_DATABASE_RESET=true` consent.
- `dbname=` and `database=` query overrides are rejected; diagnostics do not echo credentials.
- In-process PostgreSQL tests use `yoir_test`; live Uvicorn journeys use separate `yoir_live_test` state.
- Fixture teardown removes ORM tables and Alembic's version table so the next run recreates migrations correctly. The repeated PostgreSQL run verifies this boundary.
- Standard in-process fixtures clear external payment/mail credentials. Provider-specific tests opt in through controlled test fixtures; a stub payment or mocked mail call is not a delivered service.

Use the validated QA harness for destructive setup, not a developer or deployment database. Local validation used Node **20.20.2**, npm **10.8.2**, Python **3.12.14**, PostgreSQL **16.15** and locked dependencies. CI pins Node **20.20.2**, Python **3.12.13** and PostgreSQL **16.15-bookworm**; the Python patch-version difference is recorded rather than treated as an identical environment.

## Automated acceptance gates

[Application CI](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/8aa24284dbbcf64a18e63b783cf43648574d75c6/.github/workflows/app-ci.yml) has **six job definitions and seven job executions**, because native components run separately for iOS and Android:

1. Frontend lint, typecheck, one regression coverage run, dependency audit and deployable Web export.
2. iOS and Android component regressions with separate platform evidence.
3. Chromium acceptance against an isolated API/database and fresh Web build.
4. Backend compilation, production/test Ruff, PostgreSQL tests and coverage.
5. Live PostgreSQL HTTPX and TypeScript-client journeys, persisted database effects and served Web/API routing.
6. Repository metadata, OpenAPI/traceability, QA tooling, workflow and whitespace checks.

Ordinary regressions, configured coverage, lint, types, builds and report-health checks are blocking. Separate shared, iOS, Android and Chromium defect assertions are advisory, with their raw failures retained. Blocking report validation rejects recognizable setup/runtime/transport failures, including the undefined-session error identified in the review. Report validation cannot prove that every assertion failure has the previously documented cause; new diagnostics still require investigation.

Jest enforces **90% statements, 80% branches, 90% functions and 90% lines separately** for `src/api/`, `src/marketplace/`, `src/auth/` and `src/format.ts`. These are not global thresholds. Whole-source coverage includes `app/**` and `src/**`, with configured type-only and native/provider seam exclusions. Backend coverage is recorded without a numeric fail-under gate. The production dependency audit blocks critical advisories; lower severities remain visible. Actions use immutable commit pins and CI artifacts have 90-day retention.

## Local execution evidence — 18 September 2026

The following fresh results belong to the conflict-resolved sources committed as `8aa2428`. Results, source fingerprints, artifact hashes and failure names are retained in the [validation record](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/8aa24284dbbcf64a18e63b783cf43648574d75c6/docs/sprint2/qa/dev-sync-validation-20260918.json). Repeatable commands and environment setup are defined in the linked Application CI workflow and test scripts.

| Check | Result |
|---|---|
| Two reviewed Sprint 2 backend suites | 94 tests collected successfully |
| Full PostgreSQL backend suite | 564 passed, 15 strict XFail, 7 deselected |
| Repeat Sprint 2 PostgreSQL run | 90 passed, 4 strict XFail; migrations recreated successfully |
| Full temporary-SQLite backend suite | 559 passed, 5 skipped, 15 strict XFail, 7 deselected |
| Shared frontend regression | 37 suites / 298 tests passed; configured coverage gates passed |
| iOS components | 38 suites / 307 tests passed |
| Android components | 38 suites / 307 tests passed |
| Chromium with real API/SQLite | 15 passed |
| Live PostgreSQL HTTPX / TypeScript client | 2 passed / 2 passed |
| Live persistence and served Web/API routes | Passed; +4 users, +1 service, +2 orders, +2 bookings, unchanged window count |
| QA Python / Board / defect-report tooling | 36 / 49 / 87 tests passed |
| Frontend lint, types and Web build; backend compile and Ruff | Passed |
| Actionlint, metadata, QA traceability and whitespace | Passed |
| Production dependency audit | Critical gate passed; 0 critical, 1 high and 15 moderate advisories |

Whole-source frontend coverage was **71.48% statements, 61.07% branches, 73.16% functions and 71.66% lines**, including unexercised admin screens. Passing the core-directory thresholds does not mean all screens reached those percentages.

The separate advisory runs recorded **10 failed / 3 passed** shared assertions, **11 failed / 3 passed** on iOS, **11 failed / 3 passed** on Android, and **4 failed** in Chromium. All four report-health checks passed. Remaining findings cover amount rounding, negative-price normalization, malformed API bodies, confirmation trusting route data, empty-availability feedback, calendar network feedback, DST recurrence and font/splash recovery. Backend XFails and these advisory failures remain unresolved acceptance findings.

Old demo-only findings were retired with the removed demo feature. Old slot-overlap and fabricated-profile findings must not be reported as current failures: current behaviour has passing regression coverage. JSON response helpers now supply Content-Type headers and preserve bodyless 204/205 behaviour, so profile tests reach their intended assertions.

## Native and hosted evidence boundary

The [16 September Expo Go report](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/8aa24284dbbcf64a18e63b783cf43648574d75c6/docs/sprint2/qa/native-device-results-20260916.md) records limited iOS and Android simulator smoke on earlier product `0ffa565e47d60fc2783a4618e5dce6cfe73a4b08`, QA head `3e7f4b348c03504360af04d438202e37a5428e83` plus its documented QA overlay. It includes seeded login/logout and one persisted local stub booking per simulator, with additional Android incorrect-password recovery and photo-picker launch/cancel checks. Those observations are historical; neither they nor Jest's native presets certify the new merged source on a device.

Physical devices, standalone/release builds, external card-payment acceptance, delivered email and a fresh native run on `8aa2428` are **Not Run in this evidence edition**.

The results above are local executions, not GitHub Actions results. The recorded validation did not capture an authenticated, current-head hosted run. The Git history now confirms PR #155 was merged, but a merge does not by itself establish which checks passed. Reconcile the exact commit and job conclusions in [Application CI](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/workflows/app-ci.yml) before claiming hosted validation; September 16 green checks do not validate September 18 source changes. Later dev changes require their own run links.

## Exit criteria and QA hand-off

QA review requires executable regression and harness gates to pass on the stated revision, isolated database use, traceable commands/results, and explicit classifications for every defect and unexecuted boundary. Hosted validation requires run links and conclusions for that same revision.

Product acceptance additionally requires the relevant user-story criteria, unresolved defects and device/provider/deployment boundaries to be resolved or explicitly assessed by their owners. A green workflow with advisory defects is not full acceptance or a release sign-off. Retain dated evidence, rerun affected boundaries after source changes, and record the new commit and environment before updating this page's results.
