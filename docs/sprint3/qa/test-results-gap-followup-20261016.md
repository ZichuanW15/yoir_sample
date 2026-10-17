# Sprint 3 gap follow-up — 16 October 2026

## Scope and baseline

This report covers completed automated test cases on the stated product baseline.

This increment adds **6 regression cases and 7 advisory acceptance cases**:
3 component assertions for refresh failures and 4 real-browser assertions for
diagnosis integration and unrated profiles. The local QA overlay now adds
**245 regression cases and 17 defect cases relative to dev**, counting each
source case once. Repeated platform executions are not additional cases or
independent defect root causes.

Product baseline remains `cdcc44e66d647a9c5993736b797312b495715a3f`, branch
`sprint3-qa`. Product code, dependencies and CI policy are unchanged.
The earlier [completion report](test-results-completion-20261016.md) and evidence
packages retain their historical execution outcomes.

## Execution results

| Check executed in this increment | Result | Boundary |
| --- | --- | --- |
| Full shared Jest regression with coverage | **568 passed, 64 suites** | Component/API mocks |
| Focused refresh regression, shared / iOS / Android presets | **15 passed per preset**, including 6 new cases | Same mounted components, controlled focus and session replacement |
| New refresh acceptance suite, shared / iOS / Android presets | **3 failed per preset**, 0 runtime-error suites, 0 skipped | Ordinary assertions retained as failures |
| New Chromium integration acceptance suite | **4 failed**, 0 skipped, 0 flaky, no global errors | Real isolated API and browser; failures reviewed individually |
| TypeScript and ESLint for the three changed test sources | **Passed** | Final test sources checked |
| Web export | **Passed** | Current product sources; `/api/v1`, demo mode false |
| Defect report health checks | **Passed** | Reports completed; this does not convert assertions to passes |

Shared frontend coverage remains **94.45% lines / 86.69% branches** over unchanged
source denominators. These tests add sequence/recovery checks, not new product
branches. Earlier results are recorded separately in the completion report:
848 PostgreSQL passes, 21 strict XFAILs, 571 passes per native preset,
32 Chromium passes and 2 passes per live client.

## Added regressions

The six additions in
[`focus-refresh.test.tsx`](../../../frontend/__tests__/screens/focus-refresh.test.tsx)
cover workspace recovery after a failed refocus, reuse of a renewed session token,
both user-directory roles after session replacement, and retry after either of
the two directory reads fails. They retain the mounted component and verify
subsequent calls and displayed records.

Session replacement goes through the real AuthProvider `adoptSession` bridge;
it does not exercise the HTTP refresh endpoint. Focus events invoke controlled
test callbacks. A focus witness in the missing-refresh case proves the simulated
event was actually delivered.

## Unmet acceptance assertions

| ID | Observed result | Interpretation |
| --- | --- | --- |
| `S3-WORKSPACE-STALE-STATUS` | A previously verified workspace still displays Verified after its profile reread fails. | Prior status is presented as current during an error. |
| `S3-ADMIN-USERS-FOCUS` | Returning focus to the mounted Users page does not trigger another directory read. | Simulated focus reached the witness, but the page did not refresh. |
| `S3-ADMIN-USERS-STALE-REFRESH` | A session replacement triggers reads, but a partial failure leaves the prior actionable directory rows. | Old rows are retained while the new read is unsuccessful. |
| `S3-DIAGNOSIS-SERVER-ACK` | Continue advances the UI with **0 save requests**; independent API readback remains revision 0 / Step 1. | Server acknowledgement is not connected to advancement; the case fails at its missing-request guard. |
| `S3-DIAGNOSIS-SAVE-RECOVERY` | **0 intercepted requests**, `injectedFailureReached:false`; server record remains unchanged. | The completed assertion fails at the missing-integration guard with no diagnosis save request. |
| `S3-DIAGNOSIS-SERVER-RESUME` | An independently saved server record is revision 1 / Step 2; the same account in empty browser storage displays Step 1. | The UI does not resume the server-confirmed record. |
| `S3-PROFILE-UNRATED` | Real API reports zero reviews and no rating; profile and its name load with no star badge, but no explicit unrated text appears. | Missing neutral rating state; verification status is not rating information. |

The three component assertions are in
[`sprint3-refresh-acceptance.test.tsx`](../../../frontend/__tests__/defects/sprint3-refresh-acceptance.test.tsx).
The four browser assertions are in
[`sprint3-integration-acceptance.spec.ts`](../../../frontend/e2e/sprint3-integration-acceptance.spec.ts).
The two save-related cases share the same missing write-integration boundary;
seven failed assertions do not imply seven independent root causes. No product
behaviour or expected assertion was weakened to manufacture a pass.

Initial authoring failures remain recorded separately: a duration-label expectation
in a refresh test and a public-profile precondition that expected a literal null.
The public endpoint excludes null fields, and the client normalizes omitted ratings
to null; the corrected precondition accepts that actual contract. The final unrated
case fails on its intended UI assertion. Login setup now waits for navigation after
the real login response before opening diagnosis, avoiding a session-persistence
race. A transient typecheck during concurrent authoring is superseded by the final
successful full typecheck.

## Environment and evidence

Node 20.20.2 / npm 10.8.2, Python 3.12.14 and locked Playwright 1.63.0 were reused.
Chromium used an owned loopback API on 43169 with a temporary SQLite database,
fresh QA accounts and real successful HTTP responses. The save-failure test
records zero matching requests, identifying the missing diagnosis save call.

[Packaged evidence](evidence/20261016-gap-followup/README.md) includes exact commands,
UTC times, exits, source hashes, per-case outcomes, API readbacks, screenshots and
service cleanup. Local dates are 16 October Melbourne (UTC+11); UTC records fall
on the evening of 15 October. Packaging and consistency checks are not new test
executions. Original traces and full machine reports remain in ignored artifacts.

[Consistency verification](gap-followup-validation-20261016.json) confirms the
four evidence manifests, 36 current QA source hashes, case totals and unchanged
coverage totals. Repository contract,
JSON/YAML and local Markdown-link checks passed; owned test ports are released.

The [QA matrix](qa-matrix.md) and
[repeatable plan](test-plan.md) link these executed boundaries and preserved
failure results.
