# Sprint 3 QA — approved submission

PR #244 is merged into `dev` at `9cce973`. This submission incorporates that baseline
into `sprint3-qa`, following prior local HEAD `38cd806`. The test and documentation
changes and the commit message below were approved for commit and push on
17 October 2026.

## Approved commit

```text
update test for the latest features

Sync QA with dev after the order meeting-area snapshot fix.
Add 35 regression cases and 4 advisory cases for latest feature boundaries.
Promote the resolved meeting-area assertion to normal regression coverage.

Cover purchase history, rescheduling, address updates and migration 0012.
Update all 23 QA mappings, story documents and dated execution evidence.
```

## Scope

- 20 component regression cases from the earlier document refresh.
- 14 backend regression cases and one new Chromium case for meeting-area history.
- One existing backend strict XFAIL promoted to passing regression.
- Four advisory cases across the two local updates, preserving actual failures.
- Current QA index, procedures, 23-task matrix, seven frontend story documents,
  backend service-history document, and reviewed evidence packages.
- Product code, dependencies and CI workflows match the merged `dev` baseline.

## Validation

- PostgreSQL: 916 passed, 18 strict XFAIL; coverage 94.84% lines / 85.45% branches.
- Chromium: 38 full-suite passes plus one separately executed new case passed.
- Live HTTPX and TypeScript: two passed each.
- Retained matching-source component regressions: 597 shared / 606 iOS / 606 Android.
- Advisory: shared 4 passed / 20 failed; iOS and Android each 4 / 21;
  Chromium 1 / 7. Report-health checks passed.
- Compilation, Ruff, frontend lint/type checking and fresh Web export passed.
- [Full report](test-results-meeting-area-20261017.md) and
  [validation](meeting-area-validation-20261017.json) retain scope and provenance.

The validation records describe the preparation state before publication.
Publication does not change the recorded test outcomes; remote CI results belong
to the published commit and are reviewed separately.
