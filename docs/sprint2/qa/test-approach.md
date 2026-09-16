# Scope, cases and expected outcomes

## Baseline

The reviewed product baseline is backend PR #152 (`0ffa565`), following frontend PR #154, authentication PR #153 and registration PR #151. The QA branch adds tests on top of that product code; it is not identical to `origin/dev`. The actual API exposes 15 operations, enumerated in [scope.json](scope.json); `backend/tests/test_contract.py` detects a runtime operation change requiring scope review.

In scope: registration/login/logout; service catalogue and detail; current local frontend filters/sort and independent API query/modality parameters; slot selection; orders and stub payment; counsellor service creation/listing; availability creation/listing/edit/deletion; current profile/edit screen behavior at a clearly mocked boundary; demo functions; startup, formatting and error handling.

Platform scope is Web, iOS and Android. Web has Chromium/API journeys; iOS/Android use separate Expo platform presets with platform/module-resolution guards and shared regressions. Device services remain mocked at component boundaries. Later [manual Expo Go simulator smoke results](native-device-results-20260916.md) are recorded separately from those component runs. See the [platform matrix](platform-test-matrix.md) for measured scope and remaining simulator/device checks.

The team discussion defers the full verification/LinkedIn workflow to Sprint 3. It does not itself change the implemented backend gate: pending counsellors currently receive 403 on service creation. Preserve that regression as an implementation characterization, not a settled acceptance policy. Distinguish this from the independent defect where a missing profile API fabricates a Pending profile for an actually verified account.

Excluded: missing diagnosis/admin/directory destinations; missing profile/upload and service update/delete APIs; provider payment/commission/webhooks; absent language/category/duration/brief fields; weekly calendar; unapproved persistence/expiry/validation-presentation policies. Archived frontend proposals are excluded by Jest and Playwright configuration. Ten backend `future_contract` checks are excluded explicitly. See [backend scope](../../../backend/tests/README.md) and [archived frontend probes](../../../frontend/__tests__/planned/README.md).

## Repeatable case groups

Test files contain the detailed executable steps, input values, setup and assertions. Parameterized cases are separate assertions in machine results. Every group starts from independent fixtures or a dedicated server/database.

| Case group | Procedure and expected outcome | Exact suite boundary |
| --- | --- | --- |
| REG / AUTH | Register both roles, retry duplicate email and invalid fields; verify persisted role/hash and safe rejection. Login valid/invalid credentials, enforce role guards, logout then replay the revoked token; reject replay. | `backend/tests/test_account_creation.py`, `test_duplicate_email.py`, `test_login_sessions.py`, `test_logout_sessions.py`; frontend `__tests__/screens/register.test.tsx`, `screens/login.test.tsx`, `auth/AuthContext.test.tsx`; browser registration/login/logout cases |
| MARKET | Load actual active services and detail; filter backend query/modality, handle missing IDs; separately test the UI's implemented local keyword/filter/sort controls and recovery from network failure. | `backend/tests/test_api.py`; frontend `api/client.test.ts`, `screens/marketplace.test.tsx`, `screens/service-detail.test.tsx`; browser catalogue/search/retry cases |
| SERVICE | Login verified counsellor, create supported fields including both delivery modes and conditional area; assert one persisted service visible to owner/public. Reject invalid fields, wrong roles and unverified counsellors without mutation. Browser transport failure retains the draft and retry creates exactly one record. | `backend/tests/test_counsellor.py`, `test_sprint2_counsellor_acceptance.py`; frontend `counsellor/ServiceForm.test.tsx`, `screens/counsellor-dashboard.test.tsx`, `screens/counsellor-availability.test.tsx`; browser publish cases |
| AVAILABILITY | Create, list, edit and delete future slots; read back records. Check ownership/non-disclosure, overlap, booked/held immutability, timezone offsets, and atomicity under conflicting writes. Browser checks UI times and API persistence after every edit. | Backend counsellor suites and PostgreSQL concurrency cases; frontend planner/workspace tests; browser real CRUD case |
| PURCHASE | Read open slots, select service/time/modality, create order, pay via stub, retry payment, assert one booking and expected slot state. Reject anonymous/foreign requests. Test PostgreSQL simultaneous reservation and commit failures. | `backend/tests/test_api.py`, `test_sprint2_acceptance_regressions.py`; frontend public screens; HTTPX and TypeScript live suites; browser stub receipt case |
| COMPONENT BOUNDARIES | Render existing profile/edit/dashboard controls, validate current fields, preserve drafts on rejection and inspect calls through mocked seams. A missing backend route cannot provide persistence evidence. | Frontend `screens/` and `api/counsellor-client.test.ts`; true false-success fallbacks remain defect probes |
| ROBUSTNESS | Exercise malformed responses, unavailable network, nonzero cents, negative prices, empty slots, DST transitions, confirmation forgery and font startup errors. | Frontend `__tests__/defects/`, backend strict defect cases, browser `@defect` cases |
| HARNESS / STATIC | Check recorder timestamps/source drift/failure retention, archive safety, database reset guard, types, lint, build and repository metadata. | `scripts/tests/`, `backend/tests/test_database_safety.py`, CI and recorder commands |

Use [historical results](test-results.md), [16 September results](test-results-multiplatform.md) and their JSON/XML for exact case names; file links above describe suites rather than a blanket story acceptance claim.

## Parent requirements versus current implementation

The [dated parent-AC audit](qa-issue-audit-20260916.json) preserves original
requirements; [issue evidence](issue-evidence.json) separates passing boundaries,
unresolved defects, exclusions and remaining device work for all 20 QA issues.
US45 requires backend query/control mapping: local filter tests do not replace
that requirement. US01 inline field feedback and US06 native secure storage are
not certified by current global banners or in-memory auth. Missing capabilities
remain excluded from this implemented-only run, not redefined as unnecessary.

For the reconciliation increment, reuse existing results and run only
`python3 -B scripts/check_sprint2_qa_traceability.py --verify-local-artifacts`
and the new `test_qa_traceability.py` QA-tooling cases. This is not another
application test run. [Native delta cases](native-acceptance-delta.md) specify
unmeasured cells only and retain NOT RUN until actually observed.

## Evidence semantics

- Normal Jest and Chromium tests use ordinary assertions. Current defect probes also use ordinary assertions and genuinely fail while the product is incorrect. They run separately so the failure list remains readable.
- Each native preset runs its own ordinary and defect suites. Platform-specific assertions (such as native splash release) are registered only for explicit native runs. Jest does not launch a simulator, exercise real system permissions, or prove a signed native build works.
- Backend known defects are `strict=True` xfails restricted to `KnownAcceptanceDefect`. A fixture error fails normally; a corrected behavior becomes a strict XPASS requiring marker review. Xfails are unresolved defects, never counted as passes.
- Dependency/network failures, timeouts, missing browsers and stale Web builds are harness failures. The recorder returns nonzero and preserves them; a failed build blocks browser execution.
- The runner records start/end UTC, command, duration, exit code, Git base and SHA-256 of application/tests/config before and after. Changed sources invalidate the run.
- Unit/component seams, real HTTP clients, real browser+API, and PostgreSQL checks prove different boundaries. Their totals must not be summed into distinct product features or compared as one coverage denominator.

Known defect gates remain blocking in the proposed CI. A local QA change can be reviewable while the product is not ready for sign-off; use a Draft PR and review the unresolved findings explicitly.
