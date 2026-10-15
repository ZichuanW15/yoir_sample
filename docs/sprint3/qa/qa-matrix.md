# Sprint 3 QA traceability

Source review date: **16 October 2026 (Australia/Melbourne)**. Product baseline:
`cdcc44e66d647a9c5993736b797312b495715a3f` (`dev`).
**Test owner: Wilson** (`Zhouzhny` on GitHub).

This matrix maps all **23 Sprint 3 QA tasks** to the parent acceptance criteria,
merged implementation and runnable test sources. **A test listed here is not a
new pass claim.** Use the [initial QA report](test-results-20261016.md) and the
follow-up reports below for dated execution, commands, outcomes and evidence.
The [test plan](test-plan.md) defines the
boundaries and expected outcomes for reruns.

**16 October follow-up:** the [test-completion report](test-results-completion-20261016.md)
records the later coverage update separately from the initial report. The source
mapping below includes the added failure/retry, cross-view refresh and previously
uncovered screen boundaries. Existing defect assertions and acceptance limits
remain unchanged; additional test sources do not imply a product fix.

**16 October gap follow-up:** the [gap-follow-up report](test-results-gap-followup-20261016.md)
records **6 additional passing refresh regressions** and **3 newly reproduced
refresh defects**. The full shared regression is **568 passed**; the focused
refresh suite is **15 passed** on shared, iOS and Android, with **3 failed ordinary
acceptance assertions** in each platform's separate advisory suite. These are
component runs, not three sets of independent user journeys. The four additional
browser assertions finished with **4 failed, 0 skipped and 0 flaky**, without
runtime errors. Their verified failure boundaries are listed below; this result
is separate from the earlier browser regression runs.

**16 October native follow-up:** the [native report](test-results-native-20261016.md)
records D02/D03 passing on iOS and Android: **4 case/platform executions** covering
local diagnosis validation, Back/Skip, restart, account isolation, direction,
no-results search and retakes for #162/#165/#168/#171/#174. Android was operated
through IntelliJ IDEA; iOS used Xcode Device Hub. These are same-device Expo Go
observations, not server diagnosis integration or whole-story signoff. The
[remaining native report](test-results-native-remaining-20261016.md) closes D01 and
D04–D13 with **22 case/platform executions: 11 PASS, 8 FAIL, 3 BLOCKED**. Together,
the two recorded runs contain **26 executions: 15 PASS, 8 FAIL, 3 BLOCKED**, with
no whole case still NOT RUN. The eight failures are D01, D07, D09 and D13 on both
platforms. Unexecuted or blocked substeps remain identified in the reports.

**Supplementary confirmations:** Wilson confirmed PASS for real-email delivery,
password reset, payment-provider flows, offline recovery and Android photo-permission
denial on 16 October. This is the confirmation date; execution dates, builds,
environments and supporting captures were not supplied. These five workflow groups
are recorded in [Execution information](test-results-native-remaining-20261016.md#execution-information),
not added to the frozen native totals. They do not establish every detailed token,
session-policy or provider substep, or resolve the recorded failures.

## Issue status and evidence rules

The [16 October issue snapshot](issue-snapshot-20261016.json) contains the full
parent and subtask text used for this review. All 23 QA tasks and all 23 parent
stories were open; the 23 frontend subtasks were closed, while 3 backend subtasks
were closed and 20 were open. These are workflow states, not acceptance results.
All 23 QA tasks are assigned to Wilson. No issue state was changed for this
QA update. Issue descriptions may predate merged code; implemented boundaries
below are checked against the recorded commit, not inferred from issue status.

- **Component** means rendered React Native components with mocked network/native
  boundaries. iOS/Android Jest presets do not establish device acceptance.
  `focus-refresh.test.tsx` invokes controlled router callbacks on the same mounted
  screen. `adoptSession` updates the real AuthProvider after a simulated renewal;
  the API is mocked, so this is not an HTTP refresh-token exchange or device focus.
- **API** means the real FastAPI application with an isolated test database.
  PostgreSQL concurrency tests and temporary-SQLite migration/browser tests are
  distinct evidence.
- **Web journey** means a served Web build and real isolated API unless a test
  explicitly injects a response for a failure case.
- **Pending integration** means the complete parent journey cannot yet be
  accepted on this baseline. It does not erase the implemented boundary tests.
- Existing advisory defect failures and strict expected failures remain visible;
  neither is a passing acceptance case. A green CI workflow is not story sign-off.

## Priority: diagnosis and discovery — US-09–13

The September descriptions on QA #162–174 are historical. The current frontend
now saves unfinished answers locally, displays a missing-answer alert, and carries
`match=1` into Explore for local service ranking. Separately, the merged backend
now provides private, revision-controlled diagnosis progress APIs. The frontend
still uses `useDiagnosis` and device/browser storage; it has no diagnosis API
methods in `src/api/client.ts`. These two implementations are not an integrated
server-confirmed app journey.

Current implementation references:

- [Diagnosis screen](../../../frontend/app/job-seeker/diagnosis.tsx),
  [home entry](../../../frontend/app/job-seeker/index.tsx),
  [storage hook and matches](../../../frontend/src/diagnosis/view.tsx),
  [Web storage](../../../frontend/src/diagnosis/storage.web.ts),
  [native storage](../../../frontend/src/diagnosis/storage.ts).
- [Diagnosis API](../../../backend/app/routers/diagnosis.py),
  [versioned questionnaire](../../../backend/app/diagnosis.py),
  [backend handoff and remaining integration](../backend/us09-us11-diagnosis.md).
- [Direction/ranking rules](../../../frontend/src/diagnosis/model.ts),
  [Explore](../../../frontend/app/marketplace/index.tsx).

### New QA sources in this update

Includes the retained 14 October diagnosis sources and the 16 October additions.
Every row identifies a runnable boundary; it does not certify all parent criteria.

| Source | New coverage boundary | Related QA |
| --- | --- | --- |
| [`screens/diagnosis.test.tsx`](../../../frontend/__tests__/screens/diagnosis.test.tsx) | Rendered screen entry/role/loading, required choices, local progress, Back/Skip, optional text, completion/retake, Explore navigation and professional-load retry; mocked router/storage/network. | #162, #165, #168, #171, #174 |
| [`diagnosis/useDiagnosis.test.tsx`](../../../frontend/__tests__/diagnosis/useDiagnosis.test.tsx) | Account change, late previous-account read, immediate logout hiding and unreadable JSON; mocked storage. | #162, #168 |
| [`diagnosis/storage.web.test.ts`](../../../frontend/__tests__/diagnosis/storage.web.test.ts) | Per-key writes, blocked storage and quota behavior through a controlled Storage object. Failure cases characterize current swallowed errors, not successful durable saves. | #162, #165, #168 |
| [`test_diagnosis_qa_journeys.py`](../../../backend/tests/test_diagnosis_qa_journeys.py) | Real API login/save/logout/account-isolation/resume journey with database reads; lost final-save acknowledgement and stale replay; failed final commit then same-revision retry. | #162, #165, #168 |
| [`sprint3-diagnosis.spec.ts`](../../../frontend/e2e/sprint3-diagnosis.spec.ts) | Real served Web local diagnosis, required choice/relogin/resume/account isolation, result→professional→service→stub booking, abandoned/completed retake. Browser storage and API persistence remain distinct. | #162, #165, #168, #171, #174 |
| [`sprint3-accessibility.spec.ts`](../../../frontend/e2e/sprint3-accessibility.spec.ts) | Advisory assertion that a visibly selected Web radio exposes its checked state through DOM ARIA. React Native component checked-state assertions cannot establish this Web property. | #165, #168 |
| [`test_sprint3_api_journeys_qa.py`](../../../backend/tests/test_sprint3_api_journeys_qa.py) | Revised diagnosis/criteria/catalog, review weighting and transactional recovery, verification resubmission/publish eligibility, availability lifecycle, admin order consistency and failed-reschedule rollback. | #165, #171, #174, #192, #195, #198, #210, #213, #216, #219, #222, #225; adjacent US-40/41 regression |
| [`test_sprint3_review_concurrency_qa.py`](../../../backend/tests/test_sprint3_review_concurrency_qa.py) | PostgreSQL duplicate-review conflict and simultaneous distinct-review aggregation; barriers coordinate real transactions. Narrow strict expected failures retain the reproduced races. | #213, #216, #219 |
| [`test_sprint3_privacy_profile_qa.py`](../../../backend/tests/test_sprint3_privacy_profile_qa.py) | All visibility values, viewer/owner boundaries, account isolation, invalid payloads, profile session changes and flushed-write rollback/retry. | #183, #186, #189 |
| [`test_sprint3_privacy_contract_qa.py`](../../../backend/tests/test_sprint3_privacy_contract_qa.py) | Guest/other-seeker partial-profile reads require private fields to be omitted. Value leakage remains a blocking assertion; empty placeholders produce narrow strict expected failures. | #186 |
| [`admin-payments.test.tsx`](../../../frontend/__tests__/screens/admin-payments.test.tsx) | List/detail amounts, participants, navigation, missing/no-booking states, pending reads and retry; rendered components with mocked API. | #210 |
| [`admin-overview-users.test.tsx`](../../../frontend/__tests__/screens/admin-overview-users.test.tsx) | Owner shell, role redirects, dashboard, both user directories, role deep links and incomplete/error reads; mocked API. | #210, #231; adjacent administration Bookings view |
| [`admin-verifications.test.tsx`](../../../frontend/__tests__/screens/admin-verifications.test.tsx) | Queue filters, evidence link call, confirmation/cancel, leave pending, rejection/redecision and write/read recovery; mocked API and external link. | #195, #198, #222 |
| [`review-boundaries.test.tsx`](../../../frontend/__tests__/screens/review-boundaries.test.tsx) | Role/state eligibility, stored review, validation, pending/duplicate-submit control, refusal and draft retry; real client with controlled HTTP. | #213 |
| [`defects/sprint3-admin-acceptance.test.tsx`](../../../frontend/__tests__/defects/sprint3-admin-acceptance.test.tsx) | Advisory assertion that a failed admin booking read must not establish an empty platform. | #210, adjacent Bookings view |
| [`defects/sprint3-privacy-acceptance.test.tsx`](../../../frontend/__tests__/defects/sprint3-privacy-acceptance.test.tsx) | Advisory US-27 AC3 assertion that a failed privacy update restores the last backend-confirmed selection; real rendered component/client with controlled HTTP. Shared/iOS/Android presets remain component evidence. | #183 |
| [`sprint3-workflows.spec.ts`](../../../frontend/e2e/sprint3-workflows.spec.ts) and [`sprint3_fixtures.py`](../../../frontend/e2e/sprint3_fixtures.py) | Owned SQLite fixtures plus real Web/API review persistence, invalid/foreign review refusal, admin decisions/payment recovery and buyer/counsellor availability. Includes an advisory old-order detail probe beyond the first 200 rows. Explicit network aborts exercise failure only; successful responses remain real. | #195, #198, #210, #213, #216, #219, #222; adjacent US-40/41 regression |
| [`test_sprint3_recovery_boundaries_qa.py`](../../../backend/tests/test_sprint3_recovery_boundaries_qa.py) | Provider-intent metadata fallback, ignored/unrelated signed events, payment-failure ordering, webhook claim/booking transaction rollback and same-event retry, expiry/payout peer progress after provider errors, and stale Connect redelivery. Recording provider stubs; real HMAC verification, not provider delivery/transfer acceptance. | Adjacent implemented payment/integration regression |
| [`test_sprint3_completion_qa.py`](../../../backend/tests/test_sprint3_completion_qa.py) | Flushed-write failure/retry for verification decisions/submission, service edits/withdrawal, counsellor privacy/profile; unchanged readers and no decision email before commit; upcoming/completed/paid-out booking, order, receipt and admin history after withdrawal; privacy transitions, invalid queue filters and nonprofessional public-profile IDs. Historical completion/payout and mail remain explicit fixtures/mocks. | #180, #183, #186, #192, #195, #198, #201, #204, #207, #210, #222, #231 |
| [`sprint3-completion.spec.ts`](../../../frontend/e2e/sprint3-completion.spec.ts) | Real Web/API Pending/Verified/Rejected propagation across profile, My Services, verification and admin users; actual 409 on stale resubmission; public-profile reload after privacy changes; unrated service/list states; no-result search followed by diagnosis return/reload with original answers. No successful API response is mocked. | #162, #171, #174, #183, #186, #192, #195, #198, #216, #219, #231 |
| [`job-seeker-home.test.tsx`](../../../frontend/__tests__/screens/job-seeker-home.test.tsx) | Guest/role/loading entry, skipped/incomplete/completed local records, result/retake/Explore navigation, catalogue retry and empty catalogue without losing the direction; real hook/client with controlled storage/HTTP. | #162, #174 |
| [`professional-detail.test.tsx`](../../../frontend/__tests__/screens/professional-detail.test.tsx) | Loading both resources, returned profile/rating and own-service filtering, failed-read retry, restricted/sparse profiles, external-link request and no fabricated unrated score. Explicit unrated-profile copy and OS handoff are not established. | #186, #219 |
| [`focus-refresh.test.tsx`](../../../frontend/__tests__/screens/focus-refresh.test.tsx) | Existing same-mounted status/profile/payment cases plus 6 regressions: workspace failure→next-focus recovery; all workspace dependencies use an adopted new token; both Users role views replace data after adoption; either directory read can fail and retry both lists with the new token. Real AuthProvider, mocked API, simulated focus; no HTTP token exchange or device-focus claim. | #195, #198, #210, #231 |
| [`defects/sprint3-refresh-acceptance.test.tsx`](../../../frontend/__tests__/defects/sprint3-refresh-acceptance.test.tsx) | Three ordinary advisory assertions: failed workspace refresh must withhold the old verification; mounted Users must reread after focus; failed adopted-session directory refresh must withhold stale rows/actions. API/error assertions or an independent focus witness establish the trigger before checking the defect. | #195, #198, #231 |
| [`sprint3-integration-acceptance.spec.ts`](../../../frontend/e2e/sprint3-integration-acceptance.spec.ts) | Four `@defect` browser assertions: server acknowledgement before diagnosis advancement; refused-save retention/retry; fresh-browser resume from API-confirmed answers; explicit neutral wording for a real unrated professional. Real API setup/readback; acknowledgement delay and 503 interception apply only if the app sends a diagnosis request. | #162, #165, #168, #219 |
| [`diagnosis/storage.native.test.ts`](../../../frontend/__tests__/diagnosis/storage.native.test.ts) | Native wrapper forwards per-account keys and serialized answers; unavailable reads return no record and failed writes characterize swallowed errors. Mocked SecureStore does not prove persistence or device restart behavior. | #162, #165, #168 |
| [`verify-email.test.tsx`](../../../frontend/__tests__/screens/verify-email.test.tsx) | Token confirmation before session adoption, invalid/missing token and network errors, resend validation/pending/retry, enumeration-safe copy and email-prerequisite banners; controlled HTTP. | Adjacent implemented email-verification UI; publishing/booking prerequisites |
| [`receipt.test.tsx`](../../../frontend/__tests__/screens/receipt.test.tsx) | Authenticated receipt rendering, exact cents, supplier/buyer/tax fields, pending/error/guest/missing-ID states and Back behavior; controlled HTTP. | Adjacent receipt UI; historical receipt data also covered by the API completion source |
| [`counsellor-payouts.test.tsx`](../../../frontend/__tests__/screens/counsellor-payouts.test.tsx) | Role gate, initial/readiness/error states, polling-result handling and unmount cancellation wiring (helper mocked; retry limits/timing are separately covered by [`payments/waitForPayouts.test.ts`](../../../frontend/__tests__/payments/waitForPayouts.test.ts)), onboarding-link request and retry, ABN/GST validation, tax-save pending/errors and navigation. Network/browser are controlled; no Stripe transaction or legal/tax validation is claimed. | Adjacent implemented payout-setup UI, US-47 |
| [`notifications-panel.test.tsx`](../../../frontend/__tests__/screens/notifications-panel.test.tsx) | Guest/account/pending/empty states, read/unread rows, individual/bulk local marking, navigation, reopening and logout; controlled HTTP includes missing-endpoint fallback. The notification backend is absent on this baseline, so server persistence/delivery is not accepted. | Adjacent implemented notification UI only |

These are source mappings. Counts and outcomes belong to the dated execution
report; adding a file or documenting a scenario does not execute it.

### New browser acceptance outcomes — 16 October gap follow-up

| Ordinary `@defect` assertion | Confirmed observation | Boundary still not accepted |
| --- | --- | --- |
| `S3-DIAGNOSIS-SERVER-ACK` — #165 | The UI advances, but diagnosis save requests = 0; real API readback stays at revision 0 / step 1. | Server-confirmed advancement is absent. No acknowledgement response was held or consumed. |
| `S3-DIAGNOSIS-SAVE-RECOVERY` — #165 | Intercepted save requests = 0; the injected 503 was not delivered. | Missing app-to-API integration reproduces; retained-answer error UI and successful retry after server refusal were **not reached**. |
| `S3-DIAGNOSIS-SERVER-RESUME` — #162/#168 | The real server record is revision 1 / step 2; a fresh browser context displays step 1. | Server-confirmed resume across fresh browser contexts fails. This does not invalidate the separately tested same-device local resume. |
| `S3-PROFILE-UNRATED` — #219 | Real API has 0 reviews and omits the null rating field; the client normalizes it to null. Profile name and absence of a star score pass before the neutral-text assertion fails. | The public professional profile has no explicit unrated wording. No fabricated rating is a separate passing precondition. |

See the [gap-follow-up report](test-results-gap-followup-20261016.md) for requests,
readback attachments, screenshots, command outcomes and report-health checks.

### US-09 — entry, resume and account isolation

Parent [#81](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/81)
· QA [#162](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/162)
· owner Wilson.

| Parent AC | Implemented boundary and expected outcome | Acceptance limit |
| --- | --- | --- |
| AC1: start/resume from the main journey | Home routes a new Job Seeker into diagnosis; an unfinished local record offers Continue; completed records offer View/Retake. The API start operation resumes an existing owned record without resetting it. | App entry is driven by local storage, not the API record. |
| AC2: persisted incomplete progress resumes | Frontend stores an answered step and next position locally. API saves survive a new authenticated session. | Same-device local resume and API persistence must be reported separately; cross-device app resume is pending integration. |
| AC3: login required; no private data to guests | The screen redirects guests to login; all diagnosis API routes require an authenticated Job Seeker. | UI redirect alone does not prove API authorization. |
| AC4: another account cannot request the record | API foreign-record reads/writes return the same 404 boundary as an unknown ID; per-user local keys separate stored records. | Local key separation is not server authorization. |

Existing API selectors: `test_start_is_safe_to_repeat_and_read_has_no_creation_side_effect`,
`test_each_successful_step_persists_before_advancing_and_resumes_in_new_session`,
`test_all_diagnosis_routes_require_a_job_seeker`, and
`test_another_job_seeker_cannot_read_or_modify_a_foreign_diagnosis` in
[`test_diagnosis.py`](../../../backend/tests/test_diagnosis.py).

### US-10 — question order, saved answers and rejected saves

Parent [#78](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/78)
· QA [#165](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/165)
· owner Wilson.

| Parent AC | Implemented boundary and expected outcome | Acceptance limit |
| --- | --- | --- |
| AC1: six agreed steps in order | Five input questions (`now`, `goal`, `tried`, `stuck`, `barriers`) then a sixth result screen. API publishes five input steps and a result boundary. | This tests the current versioned questionnaire; it does not approve missing PO topic-bank/conditional-question policy. |
| AC2: store answers and advance after backend confirmation | API validates and atomically saves each ordered step with `expectedRevision`. | The app waits for a local-storage call, not a backend response. Server-confirmed app advancement is pending. |
| AC3: saved responses shown on return | Frontend Back/local reopen preserves saved choices; API reads return confirmed answers and resume position. | No frontend retrieval of server answers yet. |
| AC4: failed submission must not claim saved | API invalid payload, stale revision and commit-failure tests require unchanged data and no successful save response. | Storage modules swallow local write errors; there is no server-save error UI to accept. |

Test sources: [`test_diagnosis.py`](../../../backend/tests/test_diagnosis.py),
[`test_diagnosis_contract.py`](../../../backend/tests/test_diagnosis_contract.py),
[`test_diagnosis_migration.py`](../../../backend/tests/test_diagnosis_migration.py).
Migration tests establish schema/data preservation in their own temporary SQLite
engines, not a shared-production migration rehearsal.

### US-11 — validation and safe progress

Parent [#80](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/80)
· QA [#168](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/168)
· owner Wilson.

| Parent AC | Implemented boundary and expected outcome | Acceptance limit |
| --- | --- | --- |
| AC1: invalid answer shows feedback and cannot advance | Missing required single-choice answer shows `Choose an option to continue.` Optional multi-choice answers may be empty. API rejects invalid shape/options/metadata without mutation. | Do not invent required multi-select rules; app/API failure handling is not integrated. |
| AC2: reopening keeps backend-confirmed progress | API sessions can retrieve the same saved record; local screen resumes its own persisted draft. | Backend-confirmed app reopen and cross-device behavior remain pending. |
| AC3: Back retains editable saved answers | Local Back keeps answers; editing an earlier API step retains later saved answers and the resume position. | Current rules are linear; conditional branch invalidation is not implemented. |
| AC4: unauthorized reads/updates rejected | API role/auth/ownership and revoked-session tests cover the server boundary. | D02 separately observes same-device diagnosis persistence and account isolation after process restart in Expo Go on both platforms. This is not a storage security audit or proof of server authorization. |

Relevant API selectors include
`test_invalid_answers_return_field_errors_without_mutating_saved_progress`,
`test_editing_an_earlier_step_retains_later_answers_and_resume_position`,
`test_old_or_revoked_credentials_cannot_reopen_or_modify_private_progress`,
`test_simultaneous_start_requests_create_only_one_record`, and
`test_simultaneous_saves_allow_only_one_revision_to_win`.
The two diagnosis concurrency cases execute on SQLite as well as PostgreSQL.
SQLite results do not establish PostgreSQL transaction behavior; the current
report records their PostgreSQL execution separately.

### US-12 — direction rules and generation failures

Parent [#79](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/79)
· QA [#171](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/171)
· owner Wilson.

| Parent AC | Implemented boundary and expected outcome | Acceptance limit |
| --- | --- | --- |
| AC1: completed triage produces a backend result tied to responses | Merged PR #236 adds `/diagnoses/{id}/direction`, derived from persisted answers, revision, questionnaire and rules version. Tests cover earlier-answer changes, consistent criteria and rejected stale saves. | The app still computes its own local result and does not call this endpoint. |
| AC2: explain a confirmed direction and next steps | Direction API returns deterministic explanation/next steps; `DirectionCard` separately renders local rules. | Rules are implementation evidence, not approval of a future PO topic bank. App display is not server-confirmed. |
| AC3: incomplete triage rejected by backend | Direction/criteria endpoint tests reject incomplete records and enforce owner/auth/role boundaries. | Does not establish an integrated frontend rejection flow. |
| AC4: generation failure shows error and no fabricated match | Backend failure injection verifies no fabricated direction/criteria; new API journey verifies recovery without corrupting saved answers. Component tests cover catalogue-load error/retry. | The app has no server-result error path until API integration. |

Current rule/ranking tests:
[`frontend/__tests__/diagnosis.test.ts`](../../../frontend/__tests__/diagnosis.test.ts).
API sources: `backend/tests/test_diagnosis_direction.py`,
`test_diagnosis_marketplace_criteria.py` and `test_sprint3_api_journeys_qa.py`.
The remaining gap is app-to-API integration, rather than an absent endpoint.
`sprint3-integration-acceptance.spec.ts` now gives that missing app boundary
explicit browser assertions. If the app advances without a save request, the
acknowledgement and refused-save cases fail at the missing-request assertion;
the injected 503, retained-answer error UI and successful retry were **not
reached**. An API-confirmed record in a fresh browser tests server resume, not
copying a prior browser's local storage.

### US-13 — diagnosis to Explore and return

Parent [#76](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/76)
· QA [#174](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/174)
· owner Wilson.

| Parent AC | Implemented boundary and expected outcome | Acceptance limit |
| --- | --- | --- |
| AC1: apply or suggest supported criteria | Result opens `/marketplace?match=1`; Explore ranks locally. The new criteria API independently derives supported `query` parameters and reports unsupported signals; API journey submits them to the real services endpoint. | Frontend still sends no diagnosis criteria to Marketplace API; passing server boundary tests do not establish this app integration. |
| AC2: return without repeating triage | Explore links to diagnosis with `result=1`; the Web completion source returns after a no-result search, reloads the result and reuses the original answers during a retake. | This is local restoration, not server-confirmed/cross-device result restoration. |
| AC3: empty results retain diagnosis | Web completion exercises an actual no-result search and return; the home component source separately covers an empty catalogue while keeping result/retake actions. | Dated execution belongs to the follow-up report. These local flows do not establish frontend consumption of backend diagnosis criteria. |
| AC4: do not claim unsupported criteria applied | Criteria API explicitly reports unsupported signals and does not invent a modality filter. Local no-fit text preserves normal ordering; model tests mark nonmatching services as not matched. | The complete UI must consume this contract before server-supported filtering can be claimed for the app. |

Test sources: [`diagnosis.test.ts`](../../../frontend/__tests__/diagnosis.test.ts),
[`marketplace.test.tsx`](../../../frontend/__tests__/screens/marketplace.test.tsx),
and [`filters.test.ts`](../../../frontend/__tests__/marketplace/filters.test.ts).

## Remaining 18 QA tasks

AC numbers below refer to the parent text in the issue snapshot. All rows are
**open QA / partial evidence until the current execution and outstanding criteria
are reviewed**. Paths are repository-relative. A mocked API success in a component
test is never evidence that the corresponding endpoint exists or persisted data.

| Story / parent / QA | Parent acceptance to verify | Current merged implementation and test sources | Remaining acceptance boundary |
| --- | --- | --- | --- |
| US-05 [#8](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/8) / [#180](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/180) | AC1–5: first-login setup, missing-step/publish gate, real incomplete/complete state, loading before routing. | API `backend/tests/test_onboarding.py`; component `frontend/__tests__/screens/counsellor-onboarding.test.tsx`, `counsellor-dashboard.test.tsx`, `login.test.tsx`; first-login/profile/submission state and loading/publish controls are mapped separately. `test_sprint3_completion_qa.py` additionally checks that a failed counsellor-profile transaction leaves onboarding and review inputs unchanged before retry. | Existing dashboard characterization records a failed onboarding check opening the workspace; it does not establish a fail-closed gate. Parent assumptions leave publishing while pending versus verified-only eligibility to agreement. D01 is FAIL on both devices: first-login setup, loading, restart and relogin checkpoints executed, but an onboarding GET 503 still opened the incomplete workspace. |
| US-27 [#22](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/22) / [#183](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/183) | AC1–5: three visibility levels, save/reopen, rejection preserves stored value, auth/value/ownership guards. | `/me/profile-visibility`; `backend/tests/test_profile_visibility.py`, new `test_sprint3_privacy_profile_qa.py`: all three values, fresh login, both member roles, account isolation, malformed/unknown fields and flushed-write rollback/retry. Component `frontend/__tests__/screens/privacy-reviews.test.tsx` covers loading/saving a choice. `test_sprint3_completion_qa.py` adds counsellor privacy rollback and repeated public-reader transitions; `sprint3-completion.spec.ts` changes settings through the real Web UI and reloads the already-open visitor profile. | **S3-PRIVACY-ROLLBACK:** new `defects/sprint3-privacy-acceptance.test.tsx` checks AC3 restoration of the last saved selection after a failed write; the screen retains its edited selection. API transaction rollback is a separate boundary and does not resolve this component defect. D04 is PASS on both devices for the named privacy transitions, failed write/retry, confirmed reopen and other-account reads; the retained unsaved selection remains a separate defect. The agreed default/field map remains separate; PR #237 is unmerged. Platform Owner privacy exclusion is an assumption, not established by the member-role cases. |
| US-28 [#23](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/23) / [#186](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/186) | AC1–5: public/partial/restricted responses, owner exception, changes visible without stale-field leakage. | Counsellor profile filtering in `backend/app/routers/counsellor.py`; `test_profile_visibility.py` and `test_sprint3_privacy_profile_qa.py` cover public/partial/restricted detail/list reads by guests and other member roles, owner `/me` full reads and fresh-session settings. Restricted-profile component case: `privacy-reviews.test.tsx`. `test_sprint3_completion_qa.py` compares refreshed public detail/list and full owner reads through repeated transitions; `sprint3-completion.spec.ts` checks the same visitor page after reload. `professional-detail.test.tsx` covers restricted/sparse rendering and read recovery. | **S3-BE-PRIVACY-FIELD-OMISSION:** `test_sprint3_privacy_contract_qa.py` separately checks AC2 key omission for guest/other-seeker reads; current responses retain empty private keys. Redaction/refresh coverage does not resolve this strict XFAIL. The Web source covers explicit reload, not automatic updates in an untouched page. D04 is PASS on both devices for the named professional visibility transitions and visitor/other-account rereads; it does not establish automatic propagation to an untouched page. Public Job Seeker profile access and the agreed field mapping remain separate. |
| US-29 [#82](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/82) / [#189](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/189) | AC1–4: backend read, confirmed save, retained edits on error, own-role/owner writes only. | `/me/job-seeker-profile`; API `test_job_seeker_profile.py` plus `test_sprint3_privacy_profile_qa.py` cover saved fields across logout/account switch/relogin, protected email/owner fields, wrong-role writes and transaction rollback/retry. `frontend/__tests__/screens/job-seeker-profile.test.tsx` exercises the real client with controlled HTTP. | Current dev has direct API recovery/isolation coverage despite unmerged PR #237. D05 recorded PASS on iOS and BLOCKED on Android only for the unavailable permission-denial branch. Both devices executed profile save/failure/retry, text restoration after restart, account isolation and synthetic-image selection/save; iOS also executed denial. Wilson subsequently confirmed Android denial PASS in the linked execution information, without changing the recorded-run status. A stored data URI is not an upload-service test; the agreed core-field set and full image lifecycle remain separate. |
| US-31 [#25](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/25) / [#192](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/192) | AC1–5: Pending after confirmed LinkedIn submission, frontend/server URL rejection, role/auth guards, no Pending on error. | `/me/verification-submissions`; `backend/tests/test_admin.py`; new `test_sprint3_api_journeys_qa.py` joins submit, rejection, corrected resubmission, approval and actual publish permission. Components: `frontend/__tests__/verification.test.ts`, `screens/counsellor-verification.test.tsx`. `test_sprint3_completion_qa.py` injects a flushed submission commit failure and verifies old URL/status/queue until retry. `sprint3-completion.spec.ts` obtains a real 409 for a stale resubmission without false Pending feedback. | URL validation is syntactic, with no live LinkedIn identity check. The API journey exercises the implemented resubmission policy; it is not PO approval of that policy. D06 is PASS on both devices for native URL validation, failed submission with retained input, retry to Pending and subsequent owner decisions. Backend transaction failure and real Web 409 handling remain separate sources. Wilson confirmed real-email delivery as a workflow group; no specific verification-message or live LinkedIn identity-check evidence was supplied. |
| US-32 [#26](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/26) / [#195](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/195) | AC1–5: consistent Pending/Verified/Rejected across profile/services, no guessed status after error, own-role reads. | Status/profile APIs and shared display; `backend/tests/test_admin.py`, `test_counsellor_profile_details.py`, `test_sprint3_api_journeys_qa.py`; components `counsellor-verification.test.tsx`, `counsellor-profile.test.tsx`, `counsellor-dashboard.test.tsx`, new `admin-verifications.test.tsx`; `e2e/sprint3-workflows.spec.ts` joins admin approval/rejection and persisted reload. `sprint3-completion.spec.ts` propagates all three real backend states to profile, My Services, verification and admin user views. `focus-refresh.test.tsx` keeps profile/workspace mounted for controlled focus changes and checks failed profile refresh/recovery; API completion compares all status readers after rollback/retry. | All three successful cross-view status refreshes now have real Web/API sources, plus mounted component focus tests. A profile refresh failure has an explicit unavailable/recovery assertion. **S3-WORKSPACE-STALE-STATUS** now reproduces the failed-refocus defect: the error is displayed but the prior Verified badge remains. The added recovery and adopted-session regressions pass without resolving that defect. D06 is PASS on both devices for the named successful status transitions and focus/return rereads. That successful native path does not rerun or resolve the failed same-mounted component refresh assertion. |
| US-33 [#27](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/27) / [#198](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/198) | AC1–5: redecision persisted, both counsellor views refreshed, invalid/wrong-role updates rejected, failure retains old status. | Admin decision API accepts pending/verified/rejected; `backend/tests/test_admin.py` covers return-to-pending and invalid outcomes. New `admin-verifications.test.tsx` covers redecision, confirmation, retained reason/status on write failure and retry; `sprint3-workflows.spec.ts` uses real approval, reasoned reinvestigation and reload. `test_sprint3_completion_qa.py` flushes then rejects decision commits, checking all readers and no email before success. The completion Web source checks both counsellor views after all three API decisions; focus components cover same-mounted successful refresh. | UI offers verified/rejected changes and Keep this outcome; API support for pending does not establish a UI return-to-pending action. Counsellor cross-view refresh and backend transaction rollback now have separate sources. **S3-WORKSPACE-STALE-STATUS** separately fails for the retained badge after a confirmed failed refocus. Recovery on a later focus and AuthProvider adoption pass, but do not repair that failure or establish HTTP token renewal. D06 is PASS on both devices for cancellation, reason validation, failed decision/retry, rejection/approval and successful native return rereads. It does not resolve the separate failed same-mounted refresh assertion; unagreed reinvestigation policy remains separate. |
| US-36 [#31](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/31) / [#201](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/201) | AC1–5: confirmed edit/removal, inactive listing, historical booking/order data retained, owner guard, failure keeps listing. | API edit/soft-delete in `backend/tests/test_counsellor.py`, `test_sprint2_counsellor_acceptance.py`; components `counsellor-edit-service.test.tsx`, `counsellor-dashboard.test.tsx`; `backend/tests/test_sprint3_service_history_qa.py` creates a real stub-paid booking before editing its service. `test_sprint3_completion_qa.py` additionally withdraws online/in-person services with upcoming/completed/paid-out paid bookings, preserving participant details/lists/receipts, orders and admin history while blocking new purchases; it also checks edit/withdrawal rollback/retry. | **S3-BE-SERVICE-HISTORY:** the existing edit probe expects original title/meeting area in order, detail and participant-list views; current reads use edited listing values. Its strict XFAIL remains unresolved AC3. The new withdrawal cases retain existing paid records without editing their booked title/area; they do not repair that defect. Completed/paid-out rows are explicit fixtures, not provider or scheduler evidence. D07 is FAIL on both devices: native stub-paid booking, service edit and withdrawal executed, but the existing booking and receipt adopted the edited title. Original amount/time/identities survived; withdrawal blocked new booking and preserved the existing record. These checkpoints do not resolve the history defect. |
| US-42 [#37](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/37) / [#204](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/204) | AC1–5: upcoming details/timezone/brief, past separation, empty state, caller isolation, network error distinct from empty. | `/me/bookings`; `backend/tests/test_my_bookings.py`, `test_payments.py`; `frontend/__tests__/screens/counsellor-bookings.test.tsx`. New API review journeys also check both participants' list/detail responses against stored reviews. API completion additionally checks both participant lists/details after service withdrawal for upcoming and historical fixtures. | The API serves each participant's own list, including Job Seekers, with no other-counsellor selector. This contract must be reconciled explicitly with the parent wrong-role wording; own-seeker access is not foreign-counsellor access. D08 is PASS on both devices for the named upcoming/past/empty lists, Melbourne times, briefs, participant isolation and delivery details against API readbacks. Historical completion states remain explicit fixtures; other timezones and physical devices are not established. |
| US-43 [#38](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/38) / [#207](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/207) | AC1–4: online link opens externally, in-person address, participant-only delivery details, absent-details message. | Booking detail/address API; `backend/tests/test_booking_detail.py`, `test_my_bookings.py`; `frontend/__tests__/screens/booking-detail.test.tsx` checks delivery details, missing state and external-link request. API completion preserves online delivery or the recorded in-person address after service withdrawal; receipt component coverage is recorded separately. | Link opening is mocked in component tests. D08 is PASS on both devices for synthetic example.com handoff/return through Safari or Chrome, exact in-person address and missing-address feedback. This is OS browser handoff, not a real meeting-provider session; agreed per-service/per-booking delivery policy remains separate. |
| US-48 [#45](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/45) / [#210](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/210) | AC1–5: owner order/payment list and detail, participants/amounts/progress, refresh after transitions, role restriction, no stale data on error. | Merged direct `/admin/payments/{orderId}` API in `test_admin.py`; new `test_sprint3_api_journeys_qa.py` compares detail after reschedule/cancel and rollback. New component `admin-payments.test.tsx` and `admin-overview-users.test.tsx` cover amounts, parties, navigation, loading, retry and incomplete reads. `sprint3-workflows.spec.ts` uses real detail and transport-failure recovery. `focus-refresh.test.tsx` checks that a failed refresh removes previously loaded payment rows before retry; API completion compares admin order/booking history after service withdrawal and rollback. | **S3-WEB-ADMIN-OLD-ORDER:** the screen searches the first 200 list rows; the Web defect expects an older existing order to open through its direct ID despite absence from that list. `S3-ADMIN-BOOKINGS-EMPTY` separately records the adjacent admin Bookings page displaying an empty-state claim after a failed request. D09 is FAIL on both devices because an admin Bookings 503 produces a false empty-platform claim; payment list/detail, failed Payments refresh/retry and changed-order readbacks passed their named checkpoints. Android has no retained pre-failure Bookings UI checkpoint. Wilson’s payment-provider workflow confirmation is separate from these local stub/fixture results and does not resolve either defect. |
| US-53 [#52](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/52) / [#213](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/213) | AC1–5: completed-buyer review form; confirmed persistence; valid rating; reject incomplete orders and nonbuyers. | Merged `POST /bookings/{id}/review`; `backend/tests/test_reviews.py` covers completed/paid-out buyers, role/ownership, validation and duplicates. New `test_sprint3_api_journeys_qa.py` adds atomic rollback/retry, metadata boundaries and Unicode; `test_sprint3_review_concurrency_qa.py` covers races. Components `review-boundaries.test.tsx`; real Web `sprint3-workflows.spec.ts` covers draft retry, persistence and ineligible/foreign bookings. | **S3-BE-REVIEW-DUPLICATE-RACE:** duplicate concurrent submissions store one review but return 201/500 instead of 201/409. Strict XFAIL retains this failure. Completed sessions are explicit fixtures for these journeys, not proof of the completion scheduler or live payment. D10 is PASS on both devices for the named local review validation, failed submission/retry, duplicate-submit control and persisted public rating. The native double-tap result does not establish concurrent multi-client safety or resolve the database race. |
| US-54 [#53](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/53) / [#216](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/216) | AC1–5: exact service aggregates/list/comments, update after review, no-review state, rejected review leaves totals unchanged. | Merged service-detail review list and aggregate recalculation; `test_reviews.py` plus new API journey cover public reads, rejected/failed writes, service separation, exact multi-session averages and fresh views. `service-detail.test.tsx` covers rendering; `sprint3-workflows.spec.ts` submits a real review and checks the updated public detail. `sprint3-completion.spec.ts` reads a real zero-review service and checks New/empty-review states in marketplace and detail. | **S3-BE-REVIEW-AGGREGATE-RACE:** two accepted concurrent reviews on one service can leave its cached count/average reflecting only one review. Source checks of sequential consistency do not resolve this strict XFAIL. D10 is PASS on both devices: native post-review service/profile values match API 5.0/one review, while the never-reviewed service retains its unrated state. This sequential path does not resolve the race; reviewer-attribution privacy and agreed display precision remain separate. |
| US-55 [#54](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/54) / [#219](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/219) | AC1–4: profile/listing rating consistency, recalculation after review, explicit unrated state, both device displays equal API value. | Merged backend recomputes overall rating from all stored reviews. New `test_sprint3_api_journeys_qa.py` checks unequal session counts across two services, service/list/profile equality and unrelated-owner isolation; concurrency file covers same-service and cross-service writes. Web review journey reloads the professional profile against a fresh API rating. `professional-detail.test.tsx` checks no fabricated score for a null rating; the completion Web source checks New in listings, no reviews in service detail and absence of a fabricated public-profile score. | **S3-BE-REVIEW-AGGREGATE-RACE:** concurrent accepted reviews can leave counsellor totals stale even across different services. Tests pin the implemented plain mean per review, not PO approval of the formula/rounding. Listings/detail now have dedicated zero-review sources, but the public professional profile still lacks explicit unrated text. **S3-PROFILE-UNRATED** now fails that exact browser assertion after real zero-review API and rendered-profile preconditions; absence of a fabricated badge is not that acceptance. D10 is PASS on both devices for the named 5.0/one-review API/display comparison and never-reviewed service state. The professional still has one review in that fixture, so this does not cover the zero-review professional wording defect or concurrent aggregates. |
| US-58 [#28](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/28) / [#222](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/222) | AC1–6: pending queue/URL, confirmed approve/reject/reason, leave pending, wrong-role rejection, failure retains pending. | Admin queue/direct detail/decision APIs in `test_admin.py`; new API journey joins corrected resubmission with publish eligibility. New `admin-verifications.test.tsx` covers filters, links, confirmation/cancel, leave-pending, rejection reason, redecision and failures. `sprint3-workflows.spec.ts` covers real confirmation/cancel, approval/rejection, reload and removal from the pending queue. API completion verifies decision rollback/retry and no email after a refused commit, plus explicit errors for invalid queue filters. | The LinkedIn-opening test checks a mocked external-link call, not OS behavior or manual identity verification. Email calls do not prove inbox receipt. D06 is PASS on both devices for leave-pending, cancellation, rejection validation, decision failure/retry, approval and persisted status rereads. Backend decision-write rollback remains a separate API boundary. Wilson’s real-email confirmation does not identify an approval/rejection message; identity checks and team approval/rejection policy remain separate. |
| US-69 [#40](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/40) / [#225](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/225) | AC1–5: own counsellor open slots, same booking/order after move, old slot released, conflict/partial failure safe, invalid state/nonparticipant rejected. | `backend/tests/test_reschedule.py` includes competing PostgreSQL moves. New `test_sprint3_api_journeys_qa.py` injects failure after booking/order SQL updates but before commit, re-reads booking/order/admin/calendar, then retries; its lifecycle journey checks old/new availability and unchanged order identity. Component `frontend/__tests__/screens/reschedule.test.tsx` covers the form. | AC4 now has a direct transaction-rollback source. Execution must still be read from the dated report; SQLite is not PostgreSQL concurrency evidence. D11 is PASS on both devices for failed move retention, real product conflict, successful retry, unchanged booking/order identities and amount, released old time, participant agreement and foreign-account refusal. The new-slot selection cleared on failure. Near-session/fee limits and unagreed reschedule policy remain outside these checks. |
| US-70 [#12](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/12) / [#228](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/228) | AC1–5: generic reset response/email, account-enumeration protection, confirmed password/hash change, expired/used/altered token rejection, pending/network failure UI. | API token lifecycle in `backend/tests/test_verification.py`; mail tests in `test_mail.py`, `test_mail_messages.py`; components `frontend/__tests__/screens/forgot.test.tsx`, `reset.test.tsx`; client envelope tests cover pending/error states and reset outcomes. | The API/component mail tests intercept delivery. D12 remains BLOCKED in the frozen run on both devices beyond invalid/known/unknown request and HTTP 503/retry checks; actual inbox/link and password-changing token lifecycle were not executed, and true offline submission was NOT RUN. Wilson subsequently confirmed real email, password reset and offline recovery PASS as workflow groups in the linked execution information. No platform/build, token-boundary or received-link detail was supplied, so those confirmations do not prove every expired/reused/altered-token or session-policy substep. Indistinguishable bodies are not a measured timing-security guarantee. Token lifetime/password rules and post-reset session invalidation need the recorded team policy; unspecified policy is not invented by QA. |
| US-71 [#77](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/77) / [#231](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/231) | AC1–4: owner sees both user roles/status, consistent counsellor verification, wrong-role denial/no navigation, error without stale list. | `backend/tests/test_admin.py` covers admin list/role guards; `screens/admin-overview-users.test.tsx` covers shell, redirects, both directories/deep links, fields, verification navigation and partial-read retry; `verification-admin-client.test.ts` pins verification URL/auth. `sprint3-completion.spec.ts` reloads real administrator users after all three status changes; API completion checks unchanged readers after rollback. `focus-refresh.test.tsx` adds both-role data replacement and retry with an adopted token. | The new `focus-refresh.test.tsx` regressions cover both role lists after AuthProvider adoption and retry either failed directory read with the new token. **S3-ADMIN-USERS-FOCUS** and **S3-ADMIN-USERS-STALE-REFRESH** in the advisory refresh source reproduce no reread on simulated focus and retained rows/actions after a failed adopted-session read. D06 is PASS on both devices for native owner decision→Users return with refreshed Rejected/Verified rows and recorded fresh reads. That path does not resolve either separate simulated-focus/failed-adoption assertion. Real HTTP token renewal and the complete native role/error matrix remain separate. |

## Integration queue and baseline changes

- [PR #236](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/236)
  is now merged and included. Backend direction/criteria acceptance can be tested;
  frontend consumption remains absent.
- [PR #237](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/237)
  adds profile/privacy hardening; it was open at the audit. Existing `dev`
  profile/privacy implementation is still eligible for current boundary tests.
- PR #239 is merged: real reviews and aggregation are included, with migration
  `0010_reviews` following `0009_diagnosis_progress`. The earlier revision
  collision is resolved. Migration tests run on the current combined chain.
- PR #238 adds direct admin order/submission lookup. Current UI detail pages
  still fetch a list and find the requested ID; the direct backend route alone
  does not fix the UI's 200-order list boundary.
- PR #240 corrects open minutes and next availability. Existing acceptance
  assertions are rerun; repaired assertions are reported as passes separately
  from the remaining advisory failures.
- Native observations are split between the [D02/D03 report](test-results-native-20261016.md)
  and [remaining-case report](test-results-native-remaining-20261016.md): **26 recorded
  case/platform executions, 15 PASS / 8 FAIL / 3 BLOCKED**. The D01/D07/D09/D13
  failures remain open on both devices. The [five supplementary workflow confirmations](test-results-native-remaining-20261016.md#execution-information)
  are PASS on Wilson’s confirmation, with execution details still unspecified;
  they do not alter the frozen observations/totals or prove every detailed
  inbox/link, token or provider boundary. Signed standalone builds, deployed
  environments, physical devices and unapproved diagnosis policy remain outside
  these recorded local runs.
