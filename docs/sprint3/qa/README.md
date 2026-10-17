# Sprint 3 QA — latest dev review

**Reviewed and executed:** 17 October 2026 (Australia/Melbourne).

**Current dev baseline:** `8713b38d63ccb969dcc69a44a02f888fd65caa9a`.

**QA branch:** `sprint3-qa`. **Owner:** Wilson (`Zhouzhny`).

This edition incorporates the desktop layout update and the confirmation snapshot
fix from [PR #246](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/246).
After a successful booking read, confirmation now uses the purchased title and
general meeting area. Eight ordinary component scenarios replace the earlier
single confirmation advisory assertion. Product changes come from merged `dev`;
QA changes are limited to tests, fixtures and evidence/documentation.

## Read first

1. [Latest confirmation report](test-results-confirmation-20261017.md): confirmation
   snapshot and desktop-layout verification for `8713b38`, with dated retained evidence.
2. [All 23 QA tasks](qa-matrix.md): parent criteria, executed sources and recorded
   findings, reconciled with the [latest issue snapshot](issue-snapshot-20261017.json).
3. [Repeatable test plan](test-plan.md): commands, isolated databases, environments
   and expected outcomes.
4. [Latest evidence](evidence/20261017-confirmation/README.md): per-case outcomes,
   logs, coverage, source hashes and packaging manifest.
5. [Executed simulator procedures and results](device-acceptance.md): completed
   native cases and their dated observations.
6. [Latest validation](confirmation-validation-20261017.json): source/evidence
   hashes, report health, task mappings and repository checks for this edition.
7. [Approved submission](submission-draft.md): commit text, scope and validation
   summary approved for publication on 17 October 2026.

## Automated results and execution boundaries

The [confirmation report](test-results-confirmation-20261017.md) records this
edition's executions. The full shared component run passed **610 cases in 70
suites**; full iOS and Android component runs passed **619 cases each**. The eight
confirmation scenarios are already included in these totals. Frontend lint, type
checking and the fresh Web export also passed. Results from different revisions
and times remain separate.

Full component advisory executions recorded **4 passed / 19 failed** on the
shared preset and **4 passed / 20 failed** on each native preset, with zero pending
cases and zero runtime-error suites. These failed assertions retain their real
outcomes under the existing advisory CI policy.

The full desktop and phone-configured Chromium regression executions each
recorded **43 passed / 1 failed**. The remaining failure was the test expecting
`/` after administrator logout; `/auth/login` is a supported result of the admin
auth guard. The original result is retained with its assertion-authoring
correction. The corrected administrator case then passed in a **separate one-case
follow-up in each project**, including token revocation and guest access checks.
These are not reported as full 44-pass executions.

The latest browser advisory executions each recorded **1 passed / 9 failed**,
including the two new responsive accessibility findings. All five
[advisory report-health checks](evidence/20261017-confirmation/report-health.json)
passed. Their success validates completed reports; it does not resolve the failed
assertions.

Current configured frontend coverage is **87.77% lines / 69.06% branches**
(**85.68% statements / 76.01% functions**). The desktop update changed 48 product
files, adding desktop branches to the measured source set. Ordinary component
presets do not exercise the rendered Web desktop layout; browser execution is
recorded separately and does not contribute to these Jest percentages. The
existing core-source 90% statements / 80% branches / 90% functions / 90% lines
gates passed. The earlier 94.68% / 87.04% figures belong to the previous source
set and are not current coverage.

The [meeting-area report](test-results-meeting-area-20261017.md) retains the earlier
`9cce973` PostgreSQL execution: **916 passed, 18 strict XFAILs**, 7 deselected,
and **94.84% lines / 85.45% branches**. Its browser results were a 38-case full
selection and a later separate one-case run. Its HTTPX and TypeScript runs passed
2 cases each. Those outcomes retain their original execution dates and source
boundaries; they are not fresh frontend verification of the desktop update.

The earlier **17 October 06:33 UTC** component results—597 shared and 606 per
native preset—remain in the [dev refresh report](test-results-dev-refresh-20261017.md)
and [source records](evidence/20261017-dev-refresh/source-manifest.json). Earlier
advisory counts include the then-failing confirmation assertion. Its matcher
correction and promotion are documented separately below. Failed assertions and
strict XFAILs remain visible; passing required gates do not mean every product
defect is repaired.

## What changed in this edition

The new [`screens/confirmation-history.test.tsx`](../../../frontend/__tests__/screens/confirmation-history.test.tsx)
uses the real screen, auth provider and API client with controlled HTTP responses.
Its eight cases cover purchased title/area, both response orders, empty or omitted
booked area, unavailable listings, a settled failed booking read, and the returned
online meeting link. These are component scenarios, not device or real-provider
acceptance.

The new [`sprint3-responsive.spec.ts`](../../../frontend/e2e/sprint3-responsive.spec.ts)
adds five browser scenarios: registration drafts across the 1024px breakpoint,
sidebar navigation and account-menu logout for each of the three roles, and
service-deletion cancellation/confirmation. The existing
[`sprint3-meeting-area.spec.ts`](../../../frontend/e2e/sprint3-meeting-area.spec.ts)
also checks confirmation's purchased title/area after a real listing edit and
withdrawal, at desktop and phone widths. The responsive scenarios deliberately
resize; a run launched with a phone viewport is not entirely phone-sized.

The initial responsive authoring runs stopped four functional journeys at
accessibility assertions. Those outputs are retained. Registration role selection
is checked through the actual submitted role; sidebar navigation is checked
through the reached route and session behavior. Separate advisory cases now
exercise radio `aria-checked` and the active link's `aria-current`. The initial
sidebar assertion incorrectly asked a navigation link for `aria-selected`;
correcting that test expectation is distinct from evaluating the current-link
semantics. This separation does not repair product accessibility.
The subsequent full runs reached the administrator logout URL assertion described
above; the real purchase-history confirmation journey passed in those runs.

The old `S3-CONFIRMATION-AREA` string matcher incorrectly required the entire
delivery note to equal its short location fragment. The corrected regex fails
against pre-fix `bad7a8b` with actual Geelong and passes against PR #246 with
Melbourne. The original Geelong observation remains valid; the historical failed
result is preserved with this assertion-authoring correction explained separately.

Confirmation still uses the current listing before its initial booking read
finishes or if that read fails. The tests distinguish this implemented fallback
from a successfully consumed purchase snapshot.

### Earlier published refreshes

The preceding two refreshes added **35
regression cases**: 20 component, 14 backend and 1 browser, plus **4 advisory
cases**. One existing strict-XFAIL case is also restored to ordinary regression;
it is not counted as a new case. Upstream PR #244 contributes two backend tests
separately.

- Added 14 backend regression cases for meeting-area history and migration;
  the former API meeting-area XFAIL now passes as an ordinary regression.
- Added a real in-person browser journey: both parties retain Melbourne in booking
  detail after the listing moves to Geelong and after withdrawal. Screenshots and
  API readbacks accompany the separate one-case passing execution.
- Added `S3-CONFIRMATION-AREA`, whose original run showed Geelong after the real
  frontend client received Melbourne. PR #246 now consumes the booking snapshot;
  the corrected scenario belongs to ordinary regression coverage for QA #201.
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
  PR #244 freezes the general area too; PR #246 subsequently makes confirmation
  consume the successfully read booking snapshot.
- Recorded two newly reproduced diagnosis error-state defects: initial progress
  read failure leaves an endless home spinner; failed retake submission loses its
  error message after refresh. Assertions remain intact in advisory suites.
- Updated all 23 task mappings and procedures; removed obsolete source links and
  preserved historical reports with their original outcomes.

## Executed scope and evidence

The [issue snapshot](issue-snapshot-20261017.json) records 23 closed QA tasks and
23 open parent stories. Their previous closure records QA delivery, not full
parent-story acceptance. This review did not change remote issue states.

The preceding QA package was published at `424cf6537372d78aa35cf2b937a7696d4daaba81`.
This update incorporates `dev` at `8713b38`; its commit and push were approved on
17 October 2026. Dated validation records describe the pre-publication preparation
state. Git history identifies the resulting publication commit. Published CI
belongs to its exact commit; local results do not establish a new remote CI outcome.

The [first native run](test-results-native-20261016.md) and
[remaining native run](test-results-native-remaining-20261016.md)
contain **23 completed case/platform outcomes: 15 PASS / 8 FAIL**, selected from
the dated **16 October** Expo Go simulator/emulator executions on `cdcc44e`.
The procedures and results identify the product revision for each execution.

Wilson's supplementary mail/reset/payment/offline/permission confirmations remain
attributed separately in the native report. Known concurrency, error-state,
accessibility and other executed failures remain documented.

## Historical reports

- [17 October meeting-area review](test-results-meeting-area-20261017.md) and
  [its evidence](evidence/20261017-meeting-area/README.md) and
  [its validation](meeting-area-validation-20261017.json)
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
