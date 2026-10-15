# Sprint 3 test-completion follow-up — 16 October 2026

## Scope and baseline

This follow-up adds **127 regression cases** for implemented functionality:
**83 frontend component, 37 backend API/recovery and 7 Chromium cases** across
11 new source files. The complete local QA overlay now adds 239 regression cases
relative to dev; the previous 10 defect cases are retained unchanged. These are
unique source cases, excluding repeated native presets and reruns.

Product baseline: `cdcc44e66d647a9c5993736b797312b495715a3f` on local `sprint3-qa`.
Product code, dependencies, existing defect assertions and CI gates are unchanged.
There was no new fetch, commit, push, PR, merge or remote issue update in this
follow-up. The [earlier report](test-results-20261016.md) records the preceding
dev synchronization and issue audit.

Execution dates are **16 October in Melbourne (UTC+11)**; stored timestamps use
15 October evening UTC. [Execution records](evidence/20261016-completion/executions.json)
provide exact commands, working directories, times, exits and source hashes.
Packaging is not another test run.

## Final execution

| Suite / label | Passed | Unexpected failures | Other | Exit |
| --- | ---: | ---: | --- | ---: |
| Shared frontend / `frontend-shared` | 562 | 0 | Coverage collected | 0 |
| iOS components / `frontend-ios` | 571 | 0 | Platform preset, no device | 0 |
| Android components / `frontend-android` | 571 | 0 | Platform preset, no device | 0 |
| PostgreSQL / `backend-postgres-complete` | 848 | 0 | 21 existing strict XFAIL; 7 deselected | 0 |
| Chromium / `browser-regression` | 32 | 0 | No skips or retries | 0 |
| Live HTTPX / `live-httpx` | 2 | 0 | Separate PostgreSQL API | 0 |
| Live TypeScript / `live-typescript` | 2 | 0 | Real network/client/database | 0 |

Frontend lint, TypeScript checking, backend Ruff and the deployable Web export
also passed. The backend selection remains `tests -m 'not live and not
future_contract'`; live cases run separately, future-contract proposals are
excluded. Strict XFAILs are unresolved defects, not passes. Platform totals
overlap and must not be summed as unique feature coverage.

Separate Jest and Playwright defect suites were **not rerun** in this follow-up,
as requested. Their earlier failures remain in the original report. The broad
backend suite still executes existing strict XFAIL cases; none were removed,
reclassified or weakened. QA-tooling suites and dependency audit were not
repeated. In particular, the earlier high/moderate dependency advisories are
not resolved by this test-only change.

## Coverage improvement

| Measured source set | Earlier lines | Current lines | Earlier branches | Current branches |
| --- | ---: | ---: | ---: | ---: |
| Shared frontend configured app/src set | 86.51% | **94.45%** | 76.15% | **86.69%** |
| Backend app | 94.11% | **94.78%** | 83.22% | **85.16%** |

Denominators are unchanged: frontend 2,454 lines / 2,210 branches; backend
3,139 statements / 566 branches. Frontend now covers 2,318 lines and 1,916
branches; backend covers 2,975 statements and 482 branches (combined 93.31%).
The [frontend report](evidence/20261016-completion/frontend-coverage.json) and
[backend report](evidence/20261016-completion/backend-coverage.json) retain
per-file values and backend missing lines/branches.

The email-verification page, receipt, seeker home, public professional detail,
NotificationsPanel and the native diagnosis-storage wrapper reached 100% of
their measured lines/branches; payout setup reached 100% lines / 97.43% branches.
Mocked OS/provider boundaries and absent APIs remain outside these claims.
High code coverage does not establish complete requirements or device acceptance.
The separate email-verification banner remains at 92.3% branch coverage.

## Added cases and actual boundaries

| Source | Cases | What the new tests establish |
| --- | ---: | --- |
| [`verify-email.test.tsx`](../../../frontend/__tests__/screens/verify-email.test.tsx) | 12 | Confirmation before session adoption, missing/invalid token, network error, resend validation/pending/retry, enumeration-safe response and prerequisite banners. Controlled HTTP; no inbox delivery. |
| [`receipt.test.tsx`](../../../frontend/__tests__/screens/receipt.test.tsx) | 11 | Exact cents and receipt fields, loading/auth/error/missing-ID states and navigation. |
| [`counsellor-payouts.test.tsx`](../../../frontend/__tests__/screens/counsellor-payouts.test.tsx) | 17 | Role/readiness gates, polling-result and cancellation wiring, browser return/error, ABN/GST fields and save/retry. Polling helper mocked here; existing helper tests separately exercise limits/timing. |
| [`notifications-panel.test.tsx`](../../../frontend/__tests__/screens/notifications-panel.test.tsx) | 13 | Guest/account/loading/empty/read/unread states, marking/navigation/reopening and missing-endpoint fallback. Notification backend is absent; no server delivery/persistence claim. |
| [`job-seeker-home.test.tsx`](../../../frontend/__tests__/screens/job-seeker-home.test.tsx) | 9 | Roles, diagnosis entry/resume/completed state, empty/error catalogue, retry and navigation. |
| [`professional-detail.test.tsx`](../../../frontend/__tests__/screens/professional-detail.test.tsx) | 9 | Public/partial/restricted views, loading/error, service filtering, links and no fabricated score. Explicit unrated-profile wording remains absent. |
| [`focus-refresh.test.tsx`](../../../frontend/__tests__/screens/focus-refresh.test.tsx) | 9 | Mounted profile/workspace successful refresh, profile read failure/recovery and dirty draft during an in-flight blur save; controlled focus callbacks. |
| [`storage.native.test.ts`](../../../frontend/__tests__/diagnosis/storage.native.test.ts) | 3 | Per-account keys/serialization and unavailable-read/write handling through mocked SecureStore. Swallowed write errors are characterized, not proof of a durable save. |
| [`test_sprint3_completion_qa.py`](../../../backend/tests/test_sprint3_completion_qa.py) | 27 | Flushed-write rollback/retry for verification, service/profile/privacy; no premature email; six booked-service withdrawal histories, private readers, queue filters and role boundaries. Historical lifecycle states and email are fixtures/mocks. |
| [`test_sprint3_recovery_boundaries_qa.py`](../../../backend/tests/test_sprint3_recovery_boundaries_qa.py) | 10 | Payment metadata recovery, ignored signed events, failure ordering, webhook transaction rollback/same-event retry, expiry/payout peer progress/retry and stale Connect redelivery. SDK calls mocked, local HMAC verification real. |
| [`sprint3-completion.spec.ts`](../../../frontend/e2e/sprint3-completion.spec.ts) | 7 | Real three-status verification changes across views; real stale-write 409; public-profile privacy changes and reload; unrated-service state; no-results search preserving diagnosis answers. |

The [case inventory](evidence/20261016-completion/added-case-inventory.json)
records each added case. All 23 QA tasks remain mapped in the
[English matrix](qa-matrix.md) and [Chinese matrix](qa-matrix.zh-CN.md).
The [test plan](test-plan.md) supplies reproducible setups and expected outcomes.

## Environment and execution evidence

- macOS 26.6.2 ARM64; Node 20.20.2/npm 10.8.2; Python 3.12.14;
  PostgreSQL 16.15; locked Playwright 1.63.0/Chromium. Existing dependencies reused.
- Owned loopback PostgreSQL on port 55449: `sprint3_completion_test` for the
  full regression and `sprint3_completion_live_test` for real client calls.
  The separate live API used port 43160. Temporary services were stopped after
  execution. No shared or production database was used.
- Chromium used the existing isolated SQLite server on port 43159, a fresh Web
  export, `/api/v1`, and demo mode false. Focused setup ran separately on 43149.
  Successful HTTP responses in the new Web cases use the real API. Explicit
  reload tests do not establish background live updates of untouched pages.
- [Live readback](evidence/20261016-completion/live-readback.json) independently
  confirms two paid/confirmed stub bookings, health and deep-link HTTP 200, and
  a missing API route returning JSON 404. Recorded database totals are a final
  snapshot, not a measured before/after delta. Stub payment is not provider proof.
- [Source manifest](evidence/20261016-completion/source-manifest.json) and
  [file manifest](evidence/20261016-completion/manifest.json) preserve baseline,
  final QA overlay and original-report hashes. Selected logs, all case outcomes,
  coverage summaries and seven new Web screenshots are included. Regenerable
  reports/traces stay in ignored `artifacts/qa/sprint3-completion-20261016/`.

[Final consistency verification](completion-validation-20261016.json) checks the
three dated evidence manifests, current execution-source hashes, case totals,
unchanged defect sources, matching English/Chinese task links and unchanged
coverage denominators. Repository metadata checks passed with zero broken
relative Markdown links.

Authoring failures are retained: draft screen/browser selectors, a focus-hook
spy that did not intercept the actual mock, and an initial PostgreSQL invocation
using the wrong installed-driver name. These were corrected in test setup;
the final complete executions above passed. The final backend run includes the
ten later recovery cases, superseding the earlier 838-pass run in this package.

## Remaining acceptance boundaries

Known defects are unchanged. Diagnosis frontend still uses local rules/storage
rather than server diagnosis APIs. Successful workspace refresh tests do not
cover its stale-state failure path; mounted admin-user refresh failure also
remains a gap. Missing explicit unrated-profile copy and notification backend
are not accepted by these tests. Unsettled policy criteria remain in the matrix.

No booted iOS simulator or attached Android device was available at the read-only
environment check. Device restart/storage, OS handoff, actual inbox/deep links,
provider test-mode delivery/transfers, standalone builds and deployment rehearsal
are **NOT RUN**. [Device/external procedures](device-acceptance.md) define their
preconditions, steps, expected results and evidence requirements.

These additions are local and uncommitted, so existing remote CI does not validate
them. Neither these results nor advisory-green CI establishes full story sign-off.
Historical [Oct14](test-results-20261014.md) and
[earlier Oct16](test-results-20261016.md) evidence remains unchanged.
