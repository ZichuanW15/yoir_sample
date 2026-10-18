# Sprint 3 QA — final meeting-area and latest-feature review

**Owner:** Wilson (`Zhouzhny`). **Execution:** 17 October 2026, Australia/Melbourne.
**Product baseline:** `9cce9737ded87c13a7575d7236a051c5db7628f8` (`dev`).

## 1. Integration and scope

[PR #244](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/244)
was merged into `dev` at **06:41:44 UTC** after review and successful checks.
It snapshots `Order.meeting_area` at purchase and uses it in booking responses
and both confirmation emails. Migration `0012` backfills existing orders from the
service area available at upgrade time. The separate exact `Booking.meeting_address`
remains editable. An empty area is a frozen value; legacy `NULL` uses the fallback.

During validation, the local `sprint3-qa` worktree included that baseline through
`git merge --no-commit --no-ff origin/dev`, on top of local HEAD `38cd806`.
Product files, dependencies and CI workflows match `dev`. The QA overlay is
identified by the [source manifest](../evidence/20261017-meeting-area/source-manifest.json).

This final local change set adds **35 regression cases** relative to the already
published QA package: 20 component cases from the earlier document refresh,
14 backend cases and one browser case. It also promotes the resolved meeting-area
assertion from strict XFAIL to normal regression, and adds **4 advisory cases**
(the earlier three plus the confirmation-area case). Cases are counted once per
input/scenario, rather than multiplied by platform executions. The upstream fix's
two added backend tests are separate from the QA additions.

## 2. Fresh executions on the merged product

| Suite | Recorded outcome | Evidence |
| --- | --- | --- |
| Full PostgreSQL suite | **916 passed, 18 strict XFAIL**, 7 deselected | [Cases](../evidence/20261017-meeting-area/backend-postgres.json) |
| Full Chromium regression before the added area case | **38 passed** | [Cases](../evidence/20261017-meeting-area/browser-regression.json) |
| Added Chromium meeting-area case, executed separately | **1 passed** | [Case and screenshots](../evidence/20261017-meeting-area/browser-area-focused.json) |
| Shared component advisory | **4 passed, 20 failed** | [Cases](../evidence/20261017-meeting-area/frontend-defects.json) |
| iOS component advisory | **4 passed, 21 failed** | [Cases](../evidence/20261017-meeting-area/ios-defects.json) |
| Android component advisory | **4 passed, 21 failed** | [Cases](../evidence/20261017-meeting-area/android-defects.json) |
| Chromium advisory | **1 passed, 7 failed** | [Cases](../evidence/20261017-meeting-area/browser-defects.json) |
| Live HTTPX client | **2 passed** | [Cases](../evidence/20261017-meeting-area/httpx-live.json) |
| Live TypeScript client | **2 passed** | [Cases](../evidence/20261017-meeting-area/typescript-live.json) |
| Backend compilation and Ruff; frontend lint/type checking; Web export | **Passed** | [Execution records](../evidence/20261017-meeting-area/executions.json) |

Runs took place at **06:44:05–06:48:09 UTC (17:44–17:48 Melbourne)**.
The browser's 38-case run and added one-case run are separate executions. The
new browser test was added after the full runs completed; execution records retain
that source delta. Source files were stable throughout every individual execution.

PostgreSQL coverage is **3,034/3,199 lines (94.84%)** and
**499/584 branches (85.45%)** for the configured source set.
[Per-file metrics](../evidence/20261017-meeting-area/backend-coverage.json) retain the
scope and denominators. All advisory suites completed with zero skipped/pending
cases or runtime-error suites; [report-health checks](../evidence/20261017-meeting-area/report-health.json)
passed. Their failures remain failures under the existing advisory policy.

The API suite uses a dedicated local PostgreSQL database. The migration tests use
owned random schemas within it. Chromium uses a fresh Expo export and a temporary
SQLite API. Live HTTPX and TypeScript use a separate PostgreSQL database and a
served application. Payment uses the implemented stub; email assertions render
real templates and capture their delivery boundary. Owned servers were stopped
after execution.

## 3. Executed meeting-area coverage

| Source | Cases and asserted behavior |
| --- | --- |
| [Service history](../../../../backend/tests/test_sprint3_service_history_qa.py) | **6 passing cases:** existing bookings retain their area; purchases before/after a move keep distinct areas in both parties' views and rendered emails; each party can reschedule without changing the purchased area or exact address; empty snapshots remain empty; legacy null snapshots retain readable fallback behavior. |
| [Migration QA](../../../../backend/tests/test_sprint3_meeting_area_migration_qa.py) | **9 passing cases:** six combinations of full/missing/empty location fields, repeated startup with nonempty and empty saved snapshots, and downgrade/re-upgrade. Existing rows and unrelated fields are preserved. These cases ran on PostgreSQL in the full suite. |
| [Chromium area history](../../../../frontend/e2e/sprint3-meeting-area.spec.ts) | **1 passing case:** real authenticated buyers and professionals view Melbourne after the listing moves to Geelong and again after withdrawal. Real API readbacks and both browser screenshots are retained. |
| [Confirmation advisory](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/424cf6537372d78aa35cf2b937a7696d4daaba81/frontend/__tests__/defects/sprint3-confirmation-history.test.tsx) | **1 failed case on each component preset:** the real client receives booked `Melbourne, VIC`, but the confirmation screen renders live `Geelong, VIC`. The intended snapshot assertion stays active as `S3-CONFIRMATION-AREA` / QA #201. |

The former `S3-BE-SERVICE-HISTORY` area XFAIL is now a passing regression. Historical
reports retain their original XFAIL totals. The confirmation-screen finding is a
separate existing consumer gap. Migration can preserve only the service area
available when it runs; it cannot reconstruct an earlier, unrecorded location.

## 4. Retained component regression evidence

The **06:33 UTC** executions remain **597 shared / 606 iOS / 606 Android passing
regressions**, with **94.68% line / 87.04% branch** frontend coverage.
[Retained-source verification](../evidence/20261017-meeting-area/retained-component-evidence.json)
checks the frontend product, regression tests, configurations and prior reports.
The only added frontend files are the separate advisory case and browser case;
neither belongs to those Jest regression suites. The current advisory suites,
lint and type checking were freshly executed as recorded above.

The [previous refresh](test-results-dev-refresh-20261017.md) retains the 20 new
component cases and three advisory cases for privacy, onboarding, password
recovery, service edits, booking recovery and feedback responses. The
[23-task matrix](../qa-matrix.md), [procedures](../test-plan.md) and story documents link
the applicable execution evidence. Dated simulator observations remain in their
own reports and are not combined with component or browser counts.

## 5. Evidence and publication

The [evidence package](../evidence/20261017-meeting-area/README.md) includes per-case
results, logs, coverage, selected screenshots, commands, source fingerprints and
file hashes. Publication copies normalize whitespace and redact authentication
fragments where present, with original and published hashes recorded. Focused
authoring records distinguish the corrected selector setup from final assertions.

The merged `dev` Application CI, Mermaid rendering and deployment workflows
completed successfully; [remote records](../evidence/20261017-meeting-area/remote-ci.json)
identify their commit and runs. They do not include the local QA overlay.

[Final validation](meeting-area-validation-20261017.json) checks all evidence
manifests, 23 QA mappings, links, source boundaries and whitespace.
[Approved submission](../submission-draft.md) records the commit message and scope
confirmed on 17 October 2026. Validation records retain their pre-publication state;
publication does not represent another local application test run.
