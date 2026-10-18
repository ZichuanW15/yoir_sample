# Sprint 3 QA — confirmation snapshots and desktop layouts

**Owner:** Wilson (`Zhouzhny`). **Execution:** 17 October 2026, Australia/Melbourne.
**Product baseline:** `8713b38d63ccb969dcc69a44a02f888fd65caa9a` (`dev`).

## 1. Integration and executed scope

[PR #246](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/246)
was reviewed and merged after its 16 push/pull-request checks succeeded. It makes
confirmation consume the booking's purchased title and general meeting area.
The integrated baseline also contains the preceding desktop layout update.
The [merge record](../evidence/20261017-confirmation/merge-record.json) identifies the
PR head, merge commit and remote checks.

Publication preparation integrated this baseline into `sprint3-qa` using
`git merge --no-commit --no-ff origin/dev`, after published QA HEAD
`424cf6537372d78aa35cf2b937a7696d4daaba81`. Product, dependency and workflow files
match `dev`. Commit and push were approved on 17 October 2026. The dated validation
records retain the pre-publication preparation state; Git history identifies the
resulting publication commit. The QA overlay's actual source hashes are recorded
in the [source manifest](../evidence/20261017-confirmation/source-manifest.json).

Changes in this edition:

- Replace the one confirmation advisory case with **8 ordinary component cases**:
  one promoted scenario and seven additional boundaries.
- Add **5 ordinary responsive browser cases** and **2 accessibility advisory cases**.
- Extend the existing real-API purchase-history browser case to confirmation at
  desktop and phone widths, after service edit and withdrawal. This remains one
  source case, rather than four additional cases.
- Correct the existing administrator verification journey's desktop navigation
  selector, and the new logout test's allowed anonymous destination.
- Update the 23-task matrix, procedures, story documents and current evidence.

The upstream desktop component tests are included in the full component totals,
separately from these QA additions.

## 2. Fresh component and quality results

| Execution | Result | Evidence |
| --- | --- | --- |
| Full shared components | **610 passed**, 70 suites | [Cases](../evidence/20261017-confirmation/frontend-regression.json) |
| Full iOS components | **619 passed** | [Cases](../evidence/20261017-confirmation/ios-regression.json) |
| Full Android components | **619 passed** | [Cases](../evidence/20261017-confirmation/android-regression.json) |
| Shared advisory | **4 passed / 19 failed** | [Cases](../evidence/20261017-confirmation/frontend-defects.json) |
| iOS advisory | **4 passed / 20 failed** | [Cases](../evidence/20261017-confirmation/ios-defects.json) |
| Android advisory | **4 passed / 20 failed** | [Cases](../evidence/20261017-confirmation/android-defects.json) |
| Lint, type checking and fresh Web export | **Passed** | [Commands and timings](../evidence/20261017-confirmation/executions.json) |

The eight confirmation cases are included in each full component regression
total. Every component report has zero pending cases and zero runtime-error
suites. The final lint/type checks also cover the last browser-source correction.

Configured frontend coverage is **87.77% lines / 69.06% branches**,
**85.68% statements / 76.01% functions**. The existing core-source gates
(90% statements, 80% branches, 90% functions, 90% lines) passed. The desktop
update adds branches across 48 product files to the configured source set;
ordinary component presets do not execute the real Web desktop layout. Browser
results do not contribute to Jest coverage. The [per-file metrics](../evidence/20261017-confirmation/frontend-coverage.json)
retain the measured denominators; earlier coverage percentages remain historical.

## 3. Browser results and test-authoring corrections

Each project uses a fresh Web export and its own isolated SQLite API. The phone
project starts at 390 × 844 with touch/mobile emulation. Responsive cases
deliberately resize to desktop or breakpoint widths; the purchase-history case
explicitly checks both 1440 × 1000 and 390 × 844. These are responsive Chromium
Web executions.

| Execution phase | Desktop | Phone-configured | Evidence |
| --- | --- | --- | --- |
| Initial full regression | 39 passed / 5 failed | 40 passed / 4 failed | [Desktop](../evidence/20261017-confirmation/browser-desktop-regression.json), [phone](../evidence/20261017-confirmation/browser-phone-regression.json) |
| Initial advisory | 1 passed / 7 failed | 1 passed / 7 failed | [Desktop](../evidence/20261017-confirmation/browser-desktop-defects.json), [phone](../evidence/20261017-confirmation/browser-phone-defects.json) |
| Second full regression | **43 passed / 1 failed** | **43 passed / 1 failed** | [Desktop](../evidence/20261017-confirmation/browser-desktop-regression-final.json), [phone](../evidence/20261017-confirmation/browser-phone-regression-final.json) |
| Corrected admin logout, focused follow-up | **1 passed** | **1 passed** | [Desktop](../evidence/20261017-confirmation/browser-desktop-admin-followup.json), [phone](../evidence/20261017-confirmation/browser-phone-admin-followup.json) |
| Second advisory | **1 passed / 9 failed** | **1 passed / 9 failed** | [Desktop](../evidence/20261017-confirmation/browser-desktop-defects-final.json), [phone](../evidence/20261017-confirmation/browser-phone-defects-final.json) |

All browser executions have zero skipped or flaky cases. No full 44-pass run is
claimed: the last administrator case passed in a separate focused execution.
Together the second full runs and focused follow-ups provide passing evidence
for every one of the 44 current regression cases in each project. Their source
differences and original outcomes remain explicit in the execution records.

The authoring corrections were:

1. Initial functional registration/sidebar journeys stopped at accessibility
   assertions. The functional cases now assert the submitted registration role,
   reached routes and session revocation. Separate advisory cases retain the
   missing selected-radio `aria-checked` and active-link `aria-current` findings.
   The original sidebar check incorrectly expected `aria-selected` on a link;
   its correction is distinguished from the still-failing current-page assertion.
2. The existing admin verification journey used a mobile `Verify` tab at desktop
   width. It now uses the actual sidebar `Verifications` link on desktop and the
   tab on mobile. Both executions then passed that journey.
3. The second full runs stopped the administrator logout case at an overly narrow
   `/` URL assertion. [US08 AC1](../../../sprint2/frontend/us08-logout.md) permits the
   public entry or login screen; `AdminShell` redirects a cleared session to
   `/auth/login`. The focused follow-up accepts those two destinations and
   verifies session DELETE `204`, account-control removal, old-token rejection
   with `401`, and fresh guest marketplace access.

The purchase-history journey passed in both full-run phases. It verifies actual
booked title/area after listing edit and withdrawal, consumes real booking/API
responses, and records screenshots and API readbacks. Advisory failures remain
failures under the existing policy. All five [advisory report-health checks](../evidence/20261017-confirmation/report-health.json)
passed.

## 4. Confirmation assertion and regression promotion

[`confirmation-history.test.tsx`](../../../../frontend/__tests__/screens/confirmation-history.test.tsx)
uses the real screen, auth provider and API client with controlled HTTP responses.
It covers the purchased title/area, both response orders, empty/omitted booked
area, an unavailable listing, settled booking-read failure fallback, and the
returned online meeting link.

The old RNTL string matcher required the entire delivery note to equal a short
location fragment. Regex assertions now check that fragment within the note,
including a meaningful negative check for Geelong. Three recorded comparisons
establish both the authoring correction and product fix:

| Assertion / product | Observed result |
| --- | --- |
| Original exact-string assertion / PR #246 | Failed despite correct Melbourne plus explanatory suffix |
| Corrected regex / pre-fix `bad7a8b` | Failed with actual Geelong |
| Corrected regex / PR #246 | Passed with Melbourne |

The [comparison records](../evidence/20261017-confirmation/authoring/index.json)
retain these executions separately from full-suite totals. The original Geelong
observation stays valid. The dated meeting-area report now links its deleted
advisory source to the previously published commit; its historical outcome is unchanged.

Before the initial booking read completes, or if that read fails, the product
still uses the live listing fallback. The component cases explicitly establish
that boundary. Once the booking is read, its empty or missing area is not replaced
with the listing's newer location.

## 5. Retained backend evidence and publication checks

The earlier [meeting-area package](../evidence/20261017-meeting-area/README.md)
retains **916 PostgreSQL passes / 18 strict XFAILs**, 7 deselected, and
**2 passes each** for live HTTPX and TypeScript. Backend coverage remains
**94.84% lines / 85.45% branches** for that dated execution.
[Retained-input verification](../evidence/20261017-confirmation/retained-backend-evidence.json)
checks backend source/tests/migrations/configuration/dependencies and the relevant
TypeScript client/test/configuration hashes against the previous execution.
These unchanged suites retain their original timestamps.

The [evidence package](../evidence/20261017-confirmation/README.md) includes per-case
results, commands, UTC timings, logs, coverage, selected screenshots/readbacks
and original/published hashes. Publication copies normalize whitespace and redact
authentication fragments. The manifest records omitted regenerable reports and
duplicate screenshots. Packaging creates no additional execution.

[Final validation](confirmation-validation-20261017.json) checks source hashes,
all retained evidence manifests, the 23 task mappings, report health, repository
links/metadata and whitespace. The [submission draft](../submission-draft.md)
contains the exact commit text approved for publication on 17 October 2026.
The dated validation records describe preparation before publication. The merged
PR's remote CI results apply to that product commit; subsequent QA CI results
belong to the actual publication commit identified in Git history.
