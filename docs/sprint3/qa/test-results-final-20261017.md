# Sprint 3 final QA execution — 17 October 2026

**Owner:** Wilson (`Zhouzhny`). **Timezone:** Australia/Melbourne.
**Product:** `dev@0df4068f846b1a8346621af1c7584734980e7178`.
**QA:** `sprint3-qa`, merge `0ed3215edc2c8552ce623b494ebe4f59bd40da9e`
plus the test overlay recorded in the [source manifest](evidence/20261017-final/source-manifest.json).

This edition tests the latest merged diagnosis integration (PR #242), privacy
hardening (PR #237) and order-title fix (PR #243), together with the existing
implemented front/back-end regression. Product, dependency and workflow files
match the stated `dev` baseline. QA did not repair product code or alter CI gates.
The report scope consists of existing tests with recorded execution.

## 1. Recorded results

| Execution | Actual result | Exit | Evidence |
| --- | --- | --- | --- |
| Shared components + coverage | 577 passed, 64 suites; 0 failed/pending/runtime-error suites | 0 | [Cases](evidence/20261017-final/frontend-regression.json) |
| iOS components | 586 passed, 65 suites; 0 failed/pending/runtime-error suites | 0 | [Cases](evidence/20261017-final/ios-regression.json) |
| Android components | 586 passed, 65 suites; 0 failed/pending/runtime-error suites | 0 | [Cases](evidence/20261017-final/android-regression.json) |
| PostgreSQL API + coverage | 899 passed, 19 strict XFAIL; no ordinary failure | 0 | [Cases](evidence/20261017-final/backend-postgres.json) |
| Chromium final regression | 38 passed; 0 failed/skipped/flaky, no retries | 0 | [Cases](evidence/20261017-final/browser-final.json) |
| Live HTTPX | 2 passed against separate PostgreSQL API | 0 | [Cases](evidence/20261017-final/httpx-live.json) |
| Live TypeScript client | 2 passed with real fetch against the same owned live API | 0 | [Cases](evidence/20261017-final/typescript-live.json) |
| Shared advisory | 4 passed / 16 failed; 0 pending/runtime errors | 1 | [Cases](evidence/20261017-final/frontend-defects.json) |
| iOS advisory | 4 passed / 17 failed; 0 pending/runtime errors | 1 | [Cases](evidence/20261017-final/ios-defects.json) |
| Android advisory | 4 passed / 17 failed; 0 pending/runtime errors | 1 | [Cases](evidence/20261017-final/android-defects.json) |
| Chromium advisory | 1 passed / 7 failed; 0 skipped/flaky, no retries | 1 | [Cases](evidence/20261017-final/browser-defects.json) |

Component platform counts are separate executions of largely shared sources;
they are not unique user-story counts. Advisory passes are reported separately
and are not added to regression totals. Strict XFAILs reproduce unresolved
behavior and are not passes. The first browser execution recorded **38 passed /
1 failed** before the newly identified recovery defect was classified as advisory;
[that original execution](evidence/20261017-final/browser-regression.json) is retained.

Complete timestamps, command arguments, source revisions and exit codes are in
[executions.json](evidence/20261017-final/executions.json). Main application
executions ran from **04:48 to 04:57 UTC (15:48–15:57 Melbourne)** on 17 October.
Later evidence/metadata checks are recorded separately in the
[final validation](final-validation-20261017.json).

## 2. Coverage and quality checks

| Configured source set | Lines | Branches |
| --- | --- | --- |
| Frontend app/src | 2,383 / 2,521 — **94.52%** | 2,006 / 2,316 — **86.61%** |
| Backend app | 3,027 / 3,192 — **94.83%** | 497 / 582 — **85.40%** |

[Frontend per-file metrics](evidence/20261017-final/frontend-coverage.json) and
[backend per-file metrics](evidence/20261017-final/backend-coverage.json) retain
measured denominators. Frontend API/marketplace/auth/format coverage gates passed
for the configured source sets.

Changed-area line/branch coverage includes diagnosis screen **100% / 95.40%**,
diagnosis hook/views **98.31% / 75.20%**, backend privacy endpoints **100% / 100%**
and services/search **98.86% / 96.15%**. These figures show remaining branch
coverage; this edition does not claim 100% testing or complete product acceptance.

- Frontend lint and TypeScript: passed.
- Backend product/test Ruff and module compilation: passed.
- Fresh same-origin Web export: passed.
- Served homepage/deep route and unknown-API JSON 404 checks: passed.
- QA recorder/packager/traceability tooling: **36 tests passed**.
- Defect-report validator tooling: **87 tests passed**.
- Board Insights: **49 tests passed**.
- Advisory reports passed their execution/report-health checks:
  [component validators](evidence/20261017-final/component-report-health.json)
  and [browser validator](evidence/20261017-final/logs/browser-report-health.txt). This validates
  report completeness, not the correctness of the failing product behavior.
- Production dependency audit: existing critical-level gate passed, **0 critical**;
  the report still contains **51 high and 14 moderate** findings. Dependencies
  were not changed, and an exit-zero critical gate is not a clean audit claim.

## 3. What is now covered

### Server diagnosis and Explore

Removed storage/rules modules no longer have misleading local-only test coverage.
The updated source tests exercise questionnaire/owned-record reads, absent records,
start/version/revision arguments, required answers, acknowledgement ordering,
failed-save retention/retry, late previous-account responses, fresh-browser resume,
409 revision conflicts, backend direction/criteria and derived-result recovery.

Three previously failing browser integration assertions are now normal regression:
server acknowledgement before advancement, recovery after a refused save and
server-confirmed resume in a fresh browser. Retake tests distinguish an untouched
confirmed record while editing/cancelling a draft from sequential saves after
submission; retake submission is not assumed atomic. Explore tests verify the
criteria-driven request while allowing the independent ordinary catalogue request.

### Privacy and history

Two partial-profile omission strict XFAILs were converted to ordinary regression
because the latest backend omits sensitive keys. Updated tests cover privacy
transitions, member/owner/admin boundaries, no-store responses, failed commits,
search exclusion of hidden fields and fresh public readers.

**23 new backend regression cases** add 19 marketplace/search/privacy/ranking
boundaries and four history cases. History compares purchases before/after a
rename through buyer, counsellor and administrator readers, receipts, actual mail
rendering, commissions, withdrawal and legacy null-title fallback. Frozen titles
are asserted normally. The separate meeting-area-history assertion remains strict
XFAIL because that value is still read from the edited listing.

The browser additionally creates and pays a real isolated order, edits title and
price, withdraws the listing and verifies the original order across all three
roles. Existing onboarding, verification, reviews, bookings/rescheduling, reset,
admin and shared authentication/payment regression remain in the full executions.

## 4. Newly reproduced and retained defects

| Finding | Reproduction and recorded outcome | QA mapping |
| --- | --- | --- |
| `S3-DIAGNOSIS-HOME-READ-RECOVERY` | First owned-diagnosis GET returns injected 503. Home remains a spinner and exposes no error/retry. Shared/iOS/Android components and Chromium reproduce it; browser request counters and unchanged API record are attached. | #162, #168 |
| `S3-DIAGNOSIS-RETAKE-ERROR` | A submitted retake PUT receives 503. The catch path refreshes confirmed progress and clears the error; the final question lacks failure feedback. All three component presets fail the intended visible-error assertion. | #165, #168 |

These ordinary correctness assertions remain intact in the existing advisory
selection. They are not skipped, inverted or described as passes. Moving the
confirmed browser recovery defect out of regression changes its gate category,
not its observed behavior; the original failure is retained alongside the final
advisory result.

Other retained findings include missing Web radio checked state, rounded money,
negative-price conversion, confirmation integrity, an old admin order beyond 200
rows, unrated-profile wording, stale/false-empty admin/workspace views, privacy
selection rollback, meeting-area history and review concurrency/aggregation.
The per-case reports contain the complete current list; counts across platforms
must not be interpreted as distinct underlying product defects.

## 5. Environment and evidence provenance

[Environment](evidence/20261017-final/environment.json): Node 20.20.2, npm 10.8.2,
Python 3.12.14, PostgreSQL 16.15. Existing prepared dependencies were reused;
lockfiles are unchanged. The tests use owned loopback databases:

- full backend: `yoir_sprint3_final_test`, dedicated PostgreSQL instance on 55437;
- live clients: separate `yoir_sprint3_live_test`, API on 43137;
- Chromium: new temporary SQLite API on 43117, fresh exported Web build;
- mail/Stripe disabled or explicitly mocked; payment journeys use the implemented
  stub/controlled provider boundary, not real money movement.

The merge was completed during early preparation. Some build/live records identify
the pre-merge QA HEAD; their product/source fingerprints record the actual merged
working tree. Full regression executions identify merge `0ed3215` plus the QA
overlay. Concurrent authoring only changed unrelated tests or documentation during
some early checks; the final source manifest and execution differences make this
visible. Product sources did not change during execution.

Published logs remove trailing whitespace/extra EOF blank lines and redact JWT-like
test-authentication fragments where present. Original/published hashes and byte
sizes are retained in the [manifest](evidence/20261017-final/manifest.json).
Selected original screenshots and JSON readbacks are included. Regenerable HTML,
trace archives and full raw reports remain in local artifacts and are explicitly
listed as omissions. Packaging is not another test run.

Initial authoring SQLite checks found stale expectations and fixed-XFAIL XPASSs;
they are retained under `authoring/` and do not replace the final PostgreSQL result.
Focused component checks passed 51 cases; their two new defect failures were then
reproduced in the full advisory presets. Focused and full counts are not summed.

## 6. Issue reconciliation and hand-off

The [current matrix](qa-matrix.md) covers all 23 QA tasks and the
[17 October snapshot](issue-snapshot-20261017.json) records all 23 QA tasks closed,
with all 23 parents open. This update did not change issue states. Their closure
records QA evidence delivery, not complete parent acceptance.

The selected completed outcomes from the **16 October** Expo Go simulator/emulator
executions on `cdcc44e` are **15 PASS / 8 FAIL across 23 case/platform outcomes**.
Supplementary tester confirmations retain their original attribution.

This is the QA package for the recorded `dev` revision. Ordinary automated
regression passes; documented advisory/strict-XFAIL findings retain their actual
outcomes. [PR #241](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/241)
links the separate completed remote CI executions for tested commit `1e01d25`.
