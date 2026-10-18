# Sprint 3 QA — Approved submission

PR #246 is merged into `dev` at `8713b38d63ccb969dcc69a44a02f888fd65caa9a`.
This local update incorporates that baseline, including the desktop layout,
into `sprint3-qa` after published QA commit
`424cf6537372d78aa35cf2b937a7696d4daaba81`.
The changes and exact commit text below were approved for commit and push on
17 October 2026. Dated validation records retain the pre-publication preparation
state; Git history identifies the resulting publication commit.

## Approved commit

```text
update test for the latest features

Sync QA with the latest desktop layout and confirmation snapshot fix.
Replace the resolved confirmation advisory with eight regression scenarios.
Add responsive browser coverage and extend purchase-history checks.
Correct location matchers, navigation selectors and logout expectations.
Update QA mappings, procedures, story documents and execution evidence.
```

## Scope

- Eight ordinary confirmation component scenarios using the real screen, auth
  provider and API client with controlled HTTP responses.
- Purchased title/area, response ordering, empty/omitted areas, unavailable
  listings, initial booking-read failure fallback and the returned online link.
- The original location scenario now uses regex assertions against the complete
  delivery note. Its short-string matcher was over-strict; corrected comparisons
  fail with Geelong on `bad7a8b` and pass with Melbourne on the PR #246 product.
- Five responsive browser cases cover registration draft/role preservation,
  role-specific sidebar navigation and session-revoking logout, and service
  deletion cancellation/confirmation. The existing purchase-history browser
  case also checks confirmation after listing edit/withdrawal at two widths.
- Two responsive accessibility advisory cases check selected-radio and current-link
  semantics separately. Initial authoring failures are preserved; correcting the
  old navigation assertion does not change product behavior.
- Current QA index, procedures, 23-task matrix, service/booking documentation and
  reviewed execution evidence.
- Product changes come from merged `dev`; QA changes do not alter product code,
  dependencies or CI gates.

## Validation and evidence

- Shared components: 610 passed in 70 suites; iOS and Android: 619 passed each.
  These totals include the eight confirmation scenarios.
- Component advisory: shared 4 passed / 19 failed; iOS and Android each 4 / 20.
  All had zero pending cases and zero runtime-error suites.
- Current frontend coverage: 87.77% lines / 69.06% branches. Existing core-source
  coverage gates passed; new desktop branches expand the measured source set.
- Frontend lint, type checking and fresh Web export passed.
- Full desktop and phone-configured browser regression runs: 43 passed / 1 failed
  each. The remaining failure was the author's logout URL expectation; the admin
  guard correctly returned to `/auth/login`. The recorded full runs retain that
  outcome. After correction, the focused administrator case passed separately
  in each project. No full 44-pass run is claimed.
- Latest browser advisory: 1 passed / 9 failed per project. All five advisory
  report-health checks passed.
- Retained PostgreSQL evidence: 916 passed / 18 strict XFAILs, 7 deselected;
  94.84% lines / 85.45% branches. Retained live HTTPX and TypeScript results:
  2 passes each, with their original execution timestamps.

The [confirmation report](archive/test-results-confirmation-20261017.md) and
[execution package](evidence/20261017-confirmation/README.md) record the actual
commands, results, source boundaries and retained evidence for this edition.
Historical application outcomes retain their original execution dates and are
not relabelled as current frontend verification. Published CI results belong to
the exact published commit and are reviewed separately.
