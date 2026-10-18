# Sprint 3 QA — latest dev documentation and test refresh

**Review and execution:** 17 October 2026, Australia/Melbourne. **Owner:** Wilson (`Zhouzhny`).

**Dev baseline:** `972caeed8b16603b11580206692909288a83a436`.
**Local QA merge:** `38cd806227453e820838081d6fbea907c6e5ef14`, plus the test overlay
identified in the [source manifest](../evidence/20261017-dev-refresh/source-manifest.json).

## 1. Change boundary

The new dev commit adds seven frontend story documents. Product code, dependencies,
backend tests and browser tests are identical to the earlier `0df4068` execution.
The [retained-evidence check](../evidence/20261017-dev-refresh/retained-evidence.json)
records the upstream file list and exact source/report hashes.

Reviewing those documents against the existing QA overlay identified additional
component boundaries. This refresh adds **20 regression cases and 3 advisory
cases**, counting each source case once. Existing forgot/reset tests also gain
stronger acknowledgement, retry and success-message assertions. Product code,
dependencies and CI gates are unchanged.

## 2. New execution results

| Suite | Actual result | Exit | Evidence |
| --- | --- | --- | --- |
| Shared components + coverage | **597 passed**, 68 suites | 0 | [Cases](../evidence/20261017-dev-refresh/frontend-regression.json) |
| iOS components | **606 passed**, 69 suites | 0 | [Cases](../evidence/20261017-dev-refresh/ios-regression.json) |
| Android components | **606 passed**, 69 suites | 0 | [Cases](../evidence/20261017-dev-refresh/android-regression.json) |
| Shared advisory | 4 passed / **19 failed** | 1 | [Cases](../evidence/20261017-dev-refresh/frontend-defects.json) |
| iOS advisory | 4 passed / **20 failed** | 1 | [Cases](../evidence/20261017-dev-refresh/ios-defects.json) |
| Android advisory | 4 passed / **20 failed** | 1 | [Cases](../evidence/20261017-dev-refresh/android-defects.json) |
| Frontend lint | Passed | 0 | [Log](../evidence/20261017-dev-refresh/logs/frontend-lint.txt) |
| TypeScript check | Passed | 0 | [Log](../evidence/20261017-dev-refresh/logs/frontend-typecheck.txt) |

All six component executions report zero pending cases and zero runtime-error
suites. Advisory assertions retain their actual failures; their separate
[report-health checks](../evidence/20261017-dev-refresh/component-report-health.json)
passed. Component presets are separate executions with controlled HTTP/router/native
seams. Their counts are not unique feature counts or physical-device results.

The complete runs took place at **06:33:04–06:33:53 UTC (17:33 Melbourne)**.
[Execution records](../evidence/20261017-dev-refresh/executions.json) retain commands,
start/end times, exit codes and source fingerprints. Source files remained stable
during every recorded run.

Configured frontend coverage is **2,387/2,521 lines (94.68%)** and
**2,016/2,316 branches (87.04%)**. The configured coverage gates passed.
[Per-file metrics](../evidence/20261017-dev-refresh/frontend-coverage.json) retain
the denominators and scope.

## 3. New cases and task mapping

| QA task | Source | Executed additions |
| --- | --- | --- |
| #183 / US27 | [Privacy settings](../../../../frontend/__tests__/screens/privacy-settings-boundaries.test.tsx) | **10 cases:** stored partial/restricted choices for both member roles; loading; authoritative save response; pending duplicate prevention; fresh-screen reread; failed read; refused-save retry; guest redirect. |
| #180 / US05 | [Onboarding focus](../../../../frontend/__tests__/screens/onboarding-focus.test.tsx) | **1 case:** re-read the same mounted screen after setup steps and open the workspace only once both steps are confirmed. |
| #228 / US70 | [Reset](../../../../frontend/__tests__/screens/reset.test.tsx), [forgot](../../../../frontend/__tests__/screens/forgot.test.tsx) | **1 new case:** server password-field error, corrected retry and acknowledgement. Strengthened existing cases verify toast timing and retrying the retained email. |
| #201 / US36 | [Service/booking recovery](../../../../frontend/__tests__/screens/service-booking-recovery.test.tsx) | **1 case:** a refused service PATCH keeps the edit; retry sends the same body once and waits before navigation/success. |
| #207 / US43 | [Service/booking recovery](../../../../frontend/__tests__/screens/service-booking-recovery.test.tsx) | **3 cases:** address cancellation; blank address to `null` after acknowledgement; failed address save keeps the stored display and retries the trimmed draft. |
| #225 / US69 | [Service/booking recovery](../../../../frontend/__tests__/screens/service-booking-recovery.test.tsx) | **2 cases:** pending move duplicate prevention; 503 recovery reloads booking/slots and requires a new selection before retry. |
| #216 / US54, #219 / US55 | [Feedback response contract](../../../../frontend/__tests__/screens/feedback-response-contract.test.tsx) | **2 cases:** actual API-shaped anonymous review without `authorName`; consistent overall rating on Explore, service detail and profile, kept distinct from the service average. |

The authoring checks recorded **27 passing auth/privacy cases** (including the
existing auth cases) and **8 passing service/feedback cases**. These focused
executions are retained in the evidence package and are not added to the full
suite totals. The [23-task matrix](../qa-matrix.md) keeps the complete QA mapping.

## 4. Newly reproduced findings

| Finding | Reproduction and outcome | Tasks |
| --- | --- | --- |
| `S3-PRIVACY-MATCH-CRASH` | BestMatches receives a partial or restricted professional profile with private arrays omitted. It reads `.length` from an absent value and fails to render. Two cases fail on each component preset. Fixtures are checked against the actual backend mapper and route serialization. | #174, #186 |
| `S3-RESCHEDULE-SLOTS-READ` | A slot GET returns 503. The reschedule picker shows “No open times right now” instead of the read error. One case fails on each component preset. | #225 |

[Sparse-profile assertions](../../../../frontend/__tests__/defects/sprint3-private-matches.test.tsx)
capture the render exception and fail the intended no-crash assertion.
[Slot-read assertion](../../../../frontend/__tests__/defects/sprint3-reschedule-acceptance.test.tsx)
rejects the false empty state. Assertions remain active under the existing advisory
policy. The new three failures describe two underlying findings; they are not passes.

The [fixture provenance](../evidence/20261017-dev-refresh/authoring/privacy-fixture-provenance.json)
and [reproduction script](../evidence/20261017-dev-refresh/authoring/check_privacy_fixture.py)
verify the partial/restricted HTTP payloads using the production mapper, with
synthetic users and the route's `exclude_none`/`exclude_unset` serialization.

## 5. Retained dated executions

| Evidence date and source | Actual result |
| --- | --- |
| [17 October PostgreSQL](../evidence/20261017-final/backend-postgres.json) | 899 passed, 19 strict XFAIL |
| [17 October Chromium regression](../evidence/20261017-final/browser-final.json) | 38 passed |
| [17 October Chromium advisory](../evidence/20261017-final/browser-defects.json) | 1 passed / 7 failed |
| [17 October live HTTPX](../evidence/20261017-final/httpx-live.json) / [TypeScript](../evidence/20261017-final/typescript-live.json) | 2 passed each |
| [17 October backend coverage](../evidence/20261017-final/backend-coverage.json) | 94.83% lines / 85.40% branches |
| [16 October completed Expo Go cases](completed-native-cases-20261016.json) | 23 case/platform outcomes: 15 PASS / 8 FAIL, product `cdcc44e` |

The retained source check verifies **146 product files**, **128 backend files**,
**15 browser files**, the live-client test/configuration, and dependency/workflow
files against the earlier execution. Those recorded suites remain tied to their
own execution times and environments. Native observations retain their older
product revision. Supplementary tester confirmations remain separately attributed.

The already published commit `15e4143` completed **16/16 remote checks** across
push/PR workflows; the [remote snapshot](../evidence/20261017-dev-refresh/published-ci.json)
records those exact runs. Current changes are local and awaiting review.

## 6. Documentation and publication review

All seven new frontend story documents now point to executed QA coverage and
distinguish original dev-only counts from the QA overlay. Current procedures and
task mappings point to this refresh, while historical reports retain their dates
and outcomes. The Chinese matrix remains removed.

The [evidence index](../evidence/20261017-dev-refresh/README.md) contains case results,
logs, source hashes, coverage and provenance. The
[validation record](dev-refresh-validation-20261017.json) checks the package,
relative links, task mappings, unchanged product boundary and whitespace.

This is a local review package. The proposed commit text is available in the
[submission draft](../submission-draft.md); publication waits for user confirmation.
