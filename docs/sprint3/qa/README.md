# Sprint 3 QA — final dev review

**Reviewed and executed:** 17 October 2026 (Australia/Melbourne).

**Product baseline:** `0df4068f846b1a8346621af1c7584734980e7178` (`dev`).

**QA branch:** `sprint3-qa`. **Owner:** Wilson (`Zhouzhny`).

This edition documents existing tests with recorded execution for merged diagnosis integration,
privacy hardening and frozen order titles. Product files, dependencies and CI
workflows match the recorded `dev` baseline. QA changes affect tests, fixtures
and evidence/documentation.

## Read first

1. [Final execution report](test-results-final-20261017.md): actual run results,
   coverage, repaired boundaries and unresolved findings.
2. [All 23 QA tasks](qa-matrix.md): parent criteria, executed sources and recorded
   findings, reconciled with the [latest issue snapshot](issue-snapshot-20261017.json).
3. [Repeatable test plan](test-plan.md): commands, isolated databases, environments
   and expected outcomes.
4. [17 October evidence](evidence/20261017-final/README.md): per-case outcomes,
   original-log provenance, coverage, source hashes and packaging manifest.
5. [Executed simulator procedures and results](device-acceptance.md): completed
   native cases and their dated observations.
6. [Final package validation](final-validation-20261017.json): source and evidence
   hashes, task counts, report health and repository metadata checks. The
   [documentation scope check](documentation-scope-validation-20261017.json)
   verifies the completed-case selection against original execution records.

## Current automated results

| Suite | Result |
| --- | --- |
| Shared frontend components | 577 passed |
| iOS components | 586 passed |
| Android components | 586 passed |
| PostgreSQL API | 899 passed, 19 strict XFAIL |
| Chromium regression | 38 passed; no retry or skip |
| Real HTTPX / TypeScript clients | 2 passed each |

Measured lines/branches: **94.52% / 86.61% frontend** and
**94.83% / 85.40% backend**, for the configured source sets. Existing coverage
gates, lint, type checking, Web export, backend compilation and test tooling
checks passed. Coverage is not whole-story or device acceptance.

Separate component advisory suites recorded **4 passed / 16 failed** on the shared
preset and **4 passed / 17 failed** on each native preset. The browser advisory suite recorded **1 passed / 7 failed**. Failed assertions and strict XFAILs remain
visible; passing required gates do not mean all product defects are repaired.

## What changed in this edition

- Replaced tests for removed local diagnosis storage/rules with server-backed
  questionnaire, save/revision, resume, ownership, result, retake and Explore tests.
- Promoted the three repaired browser diagnosis-integration assertions to normal
  regression. Two repaired API private-field-omission assertions are also ordinary
  regression tests now.
- Added API coverage for privacy-safe search, readiness/ranking and per-order
  history across edits, receipts, emails, commissions and withdrawal. Frozen-title
  correctness is separated from the remaining meeting-area history defect.
- Recorded two newly reproduced diagnosis error-state defects: initial progress
  read failure leaves an endless home spinner; failed retake submission loses its
  error message after refresh. Assertions remain intact in advisory suites.
- Updated all 23 task mappings and procedures; removed obsolete source links and
  preserved historical reports with their original outcomes.

## Executed scope and evidence

The [issue snapshot](issue-snapshot-20261017.json) records 23 closed QA tasks and
23 open parent stories. Their previous closure records QA delivery, not full
parent-story acceptance. This review did not change remote issue states.

The current automated tests were run on the recorded product plus the hashed QA
source overlay. [PR #241](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/241)
links the completed remote CI executions for tested commit `1e01d25`.

The [first native run](test-results-native-20261016.md) and
[remaining native run](test-results-native-remaining-20261016.md) recorded
contain **23 completed case/platform outcomes: 15 PASS / 8 FAIL**, selected from
the dated **16 October** Expo Go simulator/emulator executions on `cdcc44e`.
The procedures and results identify the product revision for each execution.

Wilson's supplementary mail/reset/payment/offline/permission confirmations remain
attributed separately in the native report. Known concurrency, error-state,
accessibility and other executed failures remain documented.

## Historical reports

- [14 October baseline](test-results-20261014.md)
- [16 October initial run](test-results-20261016.md)
- [16 October completion run](test-results-completion-20261016.md)
- [16 October focused follow-up](test-results-gap-followup-20261016.md)

These reports remain valid records of their dated executions. Their old claims
about missing diagnosis integration, privacy key omission and mutable order
titles are superseded for the current product by this edition's tests. Historical
failures are not erased or relabelled as passes.
