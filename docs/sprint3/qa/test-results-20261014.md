# Sprint 3 QA results — 14 October 2026

**Baseline:** `dev` commit `98cd8cbb6bab98ea4c9a38e350a443b89cdacd16`.
**Local branch:** `sprint3-qa`; added tests are an uncommitted overlay.
Remote `dev` was rechecked at the end and still points to this product baseline.
**Scope:** implemented boundaries, prioritising US-09–13, plus existing merged
regression. See the [23-task matrix](qa-matrix.md) and [test plan](test-plan.md).

## Outcome

Added **29 cases**: 21 frontend component/storage cases, 3 backend diagnosis
journeys, 3 real-Web diagnosis journeys and 2 explicit defect reproductions.
The 27 new regression cases pass. The two new defect cases remain unresolved.
Platform presets repeat shared cases; their counts must not be added together
as unique user-story coverage.

| Execution | Actual result | Exit |
| --- | --- | --- |
| Shared frontend regression + coverage | 423 passed, 52 suites | 0 |
| iOS component preset | 432 passed, 53 suites | 0 |
| Android component preset | 432 passed, 53 suites | 0 |
| Full PostgreSQL regression | 719 passed, 15 strict XFAIL, 7 deselected | 0 |
| New service-history PostgreSQL delta | 1 strict XFAIL; no passing case | 0 |
| Initial broad Web regression | 17 passed, 1 failed due to an unverified booking fixture | 1 |
| Corrected diagnosis Web journey group | 3 passed | 0 |
| Final combined Web regression | 18 passed | 0 |
| Shared frontend advisory defects | 3 passed, 10 failed | 1 |
| iOS advisory defects | 3 passed, 11 failed | 1 |
| Android advisory defects | 3 passed, 11 failed | 1 |
| Web advisory defects | 5 failed: 4 existing findings plus the new ARIA finding | 1 |
| Repository QA tooling | 36 passed; existing traceability check passed | 0 |

Lint, regenerated-route type checking, Ruff and the exported Web build passed.
The four defect-report integrity checks passed; they validate completed reports,
not correctness of the failed product behavior. CI policy and coverage gates are
unchanged. **No new remote CI execution is claimed.**

The full backend run preceded the service-history test, so its historical total
remains **719 passed / 15 XFAIL**. The additional PostgreSQL XFAIL is separately
recorded. SQLite migration tests within the full backend suite use their own
SQLite engines; PostgreSQL concurrency cases ran against the owned PostgreSQL.
The seven deselected cases were outside `not live and not future_contract`.

## Newly confirmed findings and integration gaps

### S3-WEB-DIAGNOSIS-CHECKED — selected answer lacks accessible state

Related QA: [#165](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/165),
[#168](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/168).

1. Sign in as a new Job Seeker and open diagnosis.
2. Choose **Something else**. The optional text field appears, proving selection.
3. Inspect that radio's accessible state.

Expected `aria-checked="true"`; actual `aria-checked` and `aria-selected` were
absent. Native component assertions inspect React Native props and do not detect
this exported-Web issue. The source forwards `accessibilityState`, which the
installed React Native Web boundary does not translate into the expected DOM
attributes. No product fix was made.

Evidence: [ARIA observation](evidence/20261014/browser-defects-diagnosis-radio-state.json),
[Web failures](evidence/20261014/browser-defects.json), and
[`sprint3-accessibility.spec.ts`](../../../frontend/e2e/sprint3-accessibility.spec.ts).
This case uses the existing advisory `@defect` group.

### S3-BE-SERVICE-HISTORY — editing a listing changes historical booking details

Related QA: [#201](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/201),
US-36 AC3; also affects the booking read boundaries of US-42/43.

1. Create and stub-pay an in-person booking for a service in Melbourne.
2. Edit that service's title and location to a different offering in Geelong.
3. Read the order's booking plus both parties' booking detail and list.

All five views return the **edited title and meeting area** instead of the
original booked values. Amounts, booked times and references remain unchanged.
Reproduced on owned temporary SQLite and PostgreSQL. The isolated unmasked
SQLite run exited 1 with the actual assertion failure; the normal narrow strict
XFAIL catches only `KnownAcceptanceDefect`. A setup error still fails normally,
and a future fix produces XPASS until the marker is reviewed/removed.

Evidence: [PostgreSQL delta](evidence/20261014/backend-history-defect.xml),
[unmasked failure](evidence/20261014/logs/backend-history-unmasked-sqlite.txt), and
[`test_sprint3_service_history_qa.py`](../../../backend/tests/test_sprint3_service_history_qa.py).

### Diagnosis completion is still local to the frontend

After completing the actual Web questionnaire and a stub booking, an independent
same-account `GET /api/v1/me/diagnosis` returned **404 / `NOT_FOUND`**. This agrees
with source review: `useDiagnosis` writes local storage and the API client has no
diagnosis methods. Backend durable-save tests and frontend local-resume tests
pass independently; they do not establish integrated or cross-device acceptance.

This is recorded as an integration gap, not an assertion that a missing save
must remain missing. The browser report attaches the observation without making
404 a required regression outcome. [Original observation](evidence/20261014/browser-diagnosis-final-server-diagnosis-observation.json).

US-12/13 matching is client-side; unmerged direction backend PR #236 is outside
this baseline. Merged `dev` also lacks review submission/aggregation endpoints,
so mocked review UI tests do not complete US-53–55 acceptance. The matrix records
these and the remaining native/admin/recovery acceptance limits.

## Measured coverage

| Configured source set | Lines | Branches |
| --- | ---: | ---: |
| Frontend shared coverage | 76.39% | 65.07% |
| Diagnosis screen | 100% | 98.43% |
| Diagnosis rules/model | 100% | 90.90% |
| Diagnosis hook/result/matches view | 100% | 74.00% |
| Web diagnosis storage | 100% | 100% |
| Backend `app` source | 93.75% | 82.89% |
| Backend diagnosis validation/schema | 100% | 100% |
| Backend diagnosis router | 94.62% | 75.00% |

The backend coverage tool's combined line-and-branch percentage is **92.09%**;
it is different from its line percentage. The frontend gates apply to configured
API/marketplace/auth/format paths, not every new Sprint 3 screen. Admin screens
have substantial uncovered paths. Native diagnosis storage is only 40% line
coverage in the shared report; component/platform runs do not certify the OS
storage lifecycle. Browser and native-device coverage percentages were not collected.

These values cannot be compared directly with September's narrower source set.
[Frontend per-file metrics](evidence/20261014/frontend-coverage.json) and
[backend metrics/gaps](evidence/20261014/backend-coverage.json) retain the measured
scope rather than presenting a single percentage as whole-story acceptance.

## Reproduction and provenance

- Full procedures and expected outcomes: [test plan](test-plan.md).
- Exact per-run commands, source overlays, UTC start/end and exits:
  [execution records](evidence/20261014/executions.json).
- Selected original outputs and hashes: [evidence index](evidence/20261014/README.md).
- Node 20 / npm 10, Python 3.12, locked frontend install; existing backend
  environment matched all applicable lockfile versions. Missing `colorama` and
  `greenlet` are excluded by this machine's platform markers. No fresh `uv sync`
  is claimed because `uv` was unavailable.
- Dedicated loopback PostgreSQL cluster and fresh browser SQLite database. Real
  mail/payment providers disabled; booking used the implemented stub payment.
- Old generated Expo route types were refreshed before the passing typecheck.
  Initial browser authoring failures and the booking-fixture correction are
  retained rather than rewritten as successful executions.
- Final Web combination is repeated because the corrected diagnosis journey now
  creates a booking and can affect later tests sharing the same seeded database.
- Later diagnosis component source edits clarify comments only; no assertions
  changed after the passing runs. Source hashes preserve each actual run overlay.

## Handoff

All 23 Sprint 3 QA issues were open in the 14 October snapshot. The tests and
current report support review of implemented boundaries; they do not justify
closing every story. Prioritise diagnosis API wiring, the two new defects, and
review API integration before complete acceptance. Then run the native/device
and remaining acceptance scenarios listed in the matrix against the integrated
build and update this evidence with that run's commit and date.

This is a local QA change set. **No commit, push, PR publication, merge or issue
state change has been performed.**
