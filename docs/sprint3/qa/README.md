# Sprint 3 QA — latest dev review

**Reviewed and executed:** 17 October 2026 (Australia/Melbourne).

**Current dev baseline:** `9cce9737ded87c13a7575d7236a051c5db7628f8`.

**QA branch:** `sprint3-qa`. **Owner:** Wilson (`Zhouzhny`).

This edition incorporates the upstream meeting-area snapshot change from
[PR #244](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/244).
It extends QA for purchased-location history, booking readers, rendered emails
and migration `0012`, and records the confirmation screen's remaining live-location
finding. The earlier dev-document refresh added 20 component regression cases and
3 advisory cases. Product changes come from the merged `dev` baseline; QA changes
are limited to tests, fixtures and evidence/documentation.

## Read first

1. [Latest meeting-area report](test-results-meeting-area-20261017.md): API, migration,
   browser and advisory execution records for `9cce973`, plus dated retained components.
2. [All 23 QA tasks](qa-matrix.md): parent criteria, executed sources and recorded
   findings, reconciled with the [latest issue snapshot](issue-snapshot-20261017.json).
3. [Repeatable test plan](test-plan.md): commands, isolated databases, environments
   and expected outcomes.
4. [Latest evidence](evidence/20261017-meeting-area/README.md): per-case outcomes,
   logs, coverage, source hashes and packaging manifest.
5. [Executed simulator procedures and results](device-acceptance.md): completed
   native cases and their dated observations.
6. [Latest validation](meeting-area-validation-20261017.json): source/evidence
   hashes, report health, task mappings and repository checks for this edition.
7. [Approved submission](submission-draft.md): confirmed commit text, scope and
   validation summary.

## Automated results and execution boundaries

The [meeting-area report](test-results-meeting-area-20261017.md) records the new
backend, migration, browser and advisory executions on `9cce973`. Results from
different revisions and times remain separate.

The new full PostgreSQL execution passed **916 cases**, with **18 strict XFAILs**
and 7 deselected cases. Backend line/branch coverage is **94.84% / 85.45%**.
The new full component advisory suites recorded **4 passed / 20 failed** on the
shared preset and **4 passed / 21 failed** on each native preset. All three had
zero pending cases and zero runtime-error suites; their report-health checks passed.

The original full Chromium regression selection passed **38 cases**. The later
new `sprint3-meeting-area.spec.ts` case passed in a separate focused execution,
with buyer/counsellor screenshots and API readbacks. These are separate executions,
not a 39-case full-suite run. Browser advisory recorded **1 passed / 7 failed**
and passed its report-health check. New live HTTPX and TypeScript executions passed
**2 cases each**. Final frontend lint and type checking also passed.

The frontend regression source and tested frontend product are unchanged from the
**17 October 06:33 UTC** dev-document refresh. Its retained full runs are:

| Suite | Retained result |
| --- | --- |
| Shared frontend components | 597 passed |
| iOS components | 606 passed |
| Android components | 606 passed |

Retained frontend line/branch coverage is **94.68% / 87.04%**. Coverage gates, lint
and type checking passed in that execution. The [dev refresh report](test-results-dev-refresh-20261017.md)
and [source records](evidence/20261017-dev-refresh/source-manifest.json) preserve
its commands, timing and hashes. These component results do not establish the
outcome of the changed backend or the new confirmation advisory case.

The earlier PostgreSQL result (**899 passed / 19 strict XFAIL**), Chromium result
(**38 passed**) and HTTPX/TypeScript client results (**2 passed each**) remain
records of the prior product execution in the [full review](test-results-final-20261017.md).
Its backend coverage was **94.83% / 85.40%**. They are not relabelled as `9cce973`
results. Failed assertions and strict XFAILs remain visible; passing required
gates do not mean every product defect is repaired.

## What changed in this edition

Relative to the previously published QA branch, the two refreshes add **35
regression cases**: 20 component, 14 backend and 1 browser, plus **4 advisory
cases**. One existing strict-XFAIL case is also restored to ordinary regression;
it is not counted as a new case. Upstream PR #244 contributes two backend tests
separately.

- Added 14 backend regression cases for meeting-area history and migration;
  the former API meeting-area XFAIL now passes as an ordinary regression.
- Added a real in-person browser journey: both parties retain Melbourne in booking
  detail after the listing moves to Geelong and after withdrawal. Screenshots and
  API readbacks accompany the separate one-case passing execution.
- Added `S3-CONFIRMATION-AREA`: the real frontend client receives the booked
  Melbourne area, but the confirmation screen still shows the live listing
  location, Geelong. This remains an advisory failure for QA #201.
- The preceding dev-document refresh added 20 component regression cases and
  strengthened existing reset/forgot assertions for confirmed state, retry,
  duplicate prevention and feedback data.
- That refresh reproduced two additional findings through three active advisory cases:
  privacy-filtered BestMatches rendering crashes, and failed reschedule slot reads
  produce a false empty state.
- Reconciled all seven frontend story documents and the backend service-history
  document with the latest baseline and dated evidence.

The [earlier full review](test-results-final-20261017.md) established these retained boundaries:

- Replaced tests for removed local diagnosis storage/rules with server-backed
  questionnaire, save/revision, resume, ownership, result, retake and Explore tests.
- Promoted the three repaired browser diagnosis-integration assertions to normal
  regression. Two repaired API private-field-omission assertions are also ordinary
  regression tests now.
- Added API coverage for privacy-safe search, readiness/ranking and per-order
  history across edits, receipts, emails, commissions and withdrawal. Frozen-title
  correctness was separated from the then-open meeting-area history defect.
  PR #244 now freezes the general area too; the confirmation-screen finding above
  remains separate from backend persistence.
- Recorded two newly reproduced diagnosis error-state defects: initial progress
  read failure leaves an endless home spinner; failed retake submission loses its
  error message after refresh. Assertions remain intact in advisory suites.
- Updated all 23 task mappings and procedures; removed obsolete source links and
  preserved historical reports with their original outcomes.

## Executed scope and evidence

The [issue snapshot](issue-snapshot-20261017.json) records 23 closed QA tasks and
23 open parent stories. Their previous closure records QA delivery, not full
parent-story acceptance. This review did not change remote issue states.

The retained component tests were run at 06:33 UTC on the recorded frontend
product plus the hashed QA source overlay. [PR #241](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/241)
contains the earlier published work; commit `15e4143` has 16 successful remote
checks. This refresh remains local for review.

The [first native run](test-results-native-20261016.md) and
[remaining native run](test-results-native-remaining-20261016.md)
contain **23 completed case/platform outcomes: 15 PASS / 8 FAIL**, selected from
the dated **16 October** Expo Go simulator/emulator executions on `cdcc44e`.
The procedures and results identify the product revision for each execution.

Wilson's supplementary mail/reset/payment/offline/permission confirmations remain
attributed separately in the native report. Known concurrency, error-state,
accessibility and other executed failures remain documented.

## Historical reports

- [17 October dev-document refresh](test-results-dev-refresh-20261017.md) and
  [its evidence](evidence/20261017-dev-refresh/README.md) and
  [its validation](dev-refresh-validation-20261017.json)
- [17 October full review](test-results-final-20261017.md) and
  [its evidence](evidence/20261017-final/README.md)
- [14 October baseline](test-results-20261014.md)
- [16 October initial run](test-results-20261016.md)
- [16 October completion run](test-results-completion-20261016.md)
- [16 October focused follow-up](test-results-gap-followup-20261016.md)

These reports remain valid records of their dated executions. Their old claims
about missing diagnosis integration, privacy key omission and mutable order
titles and backend meeting areas are superseded by the corresponding current
regression results. Historical failures are not erased or relabelled as passes.
