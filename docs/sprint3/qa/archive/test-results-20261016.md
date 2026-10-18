# Sprint 3 QA execution — 16 October 2026

## Baseline

This report covers completed test cases on the stated product baseline.

Product: `cdcc44e66d647a9c5993736b797312b495715a3f`, synchronized from `origin/dev`
onto local `sprint3-qa` by fast-forward, 14 commits after `98cd8cb`. Included:
PR #236 direction/criteria, #238 direct admin details, #239 real reviews/ratings,
#240 remaining availability. Existing QA work was preserved. Changes affect
tests, isolated fixtures and documentation; product, locks and CI gates are unchanged.

All **23 QA tasks** and parent criteria were reviewed. The
[snapshot](issue-snapshot-20261016.json) contains 92 parent/subtask records.
At that snapshot all QA/parent issues were open and all QA tasks were assigned
to `Zhouzhny`.

[Execution timestamps](../evidence/20261016/executions.json) are UTC. The evening of
15 October UTC is **16 October in Melbourne (UTC+11)**. Source hashes identify
the version of tests at each execution. Packaging is not another test run.

## Final executed results

| Suite / record label | Passed | Failed | Other | Exit |
| --- | ---: | ---: | --- | ---: |
| Shared frontend, `frontend-shared` | 479 | 0 | Coverage measured | 0 |
| iOS components, `frontend-ios` | 488 | 0 | Platform preset | 0 |
| Android components, `frontend-android` | 488 | 0 | Platform preset | 0 |
| Shared defects, `frontend-shared-defects-final` | 4 | 11 | Advisory assertions executed | 1 |
| iOS defects, `frontend-ios-defects-final` | 4 | 12 | Advisory assertions executed | 1 |
| Android defects, `frontend-android-defects-final` | 4 | 12 | Advisory assertions executed | 1 |
| PostgreSQL, `backend-postgres-final` | 811 | 0 unexpected | **21 strict XFAIL** | 0 |
| Chromium regression, `browser-regression` | 25 | 0 | No retries/skips | 0 |
| Chromium defects, `browser-defects` | 1 | 5 | No retries/skips | 1 |
| Live HTTPX → PostgreSQL | 2 | 0 | Separate server/database | 0 |
| Live TypeScript client → PostgreSQL | 2 | 0 | Real client/network/database | 0 |
| Python QA tooling | 36 | 0 | Recorder/packager/traceability | 0 |
| Node defect-report tooling | 87 | 0 | Execution/report validation | 0 |

Backend selection: `tests -m 'not live and not future_contract'`; two live cases
were executed separately.
XFAIL means an unresolved, narrowly classified acceptance defect, not a pass or
a skipped test. Unexpected passes fail strictly and require marker review.
Shared/native totals overlap and must not be added as unique coverage.

Lint, TypeScript checks, backend compile/Ruff, Web export and defect-report health
checks passed. The npm production audit met the existing **critical-only gate:
0 critical**, but reported **51 high and 14 moderate advisories**. This is not a
clean security audit; its complete output is retained. Dependencies were not changed.

### Coverage

| Measured set | Lines | Branches | Boundary |
| --- | ---: | ---: | --- |
| Shared frontend configured app/src set | 86.51% | 76.15% | Documented platform/provider seams excluded |
| Backend app | 94.11% | 83.22% | Full PostgreSQL run; combined measure 92.44% |

Admin screen line coverage ranges from 88.88% (`bookings`) to 100%
(`payments`, `verifications`); admin shell is 100%. Native diagnosis storage is
40% in the shared report. Existing frontend thresholds apply to
API/auth/marketplace/format paths. See
[frontend metrics](../evidence/20261016/frontend-coverage.json) and
[backend metrics](../evidence/20261016/backend-coverage.json) for individual files
and backend missing lines/branches.

## Added coverage

The local package adds **112 regression and 10 defect cases relative to dev**,
counting parameterized cases once and excluding repeat platform runs. Oct16 adds
85 regression and 8 defect cases; Oct14's 27 regression and 2 defect cases were
retained and rerun.

| Area | Executed boundary |
| --- | --- |
| Diagnosis | Earlier-answer edits update server direction/criteria and actual service search; stale save rejected; generation failure retains answers and retries. Existing API/session/local-Web resume, retake and account-isolation cases rerun. |
| Privacy/profile | Three visibility levels across guest/seeker/other-professional reads, complete owner read, fresh sessions, separate accounts, invalid/injected fields, non-seeker writes, flushed-write rollback/retry. Value redaction and field omission are separate assertions. |
| Reviews | Three reviews across two services, weighted aggregation and public/participant reads, invalid/ineligible/duplicate rejection, Unicode/length limits, write rollback/retry, three PostgreSQL interleavings. |
| Admin/verification | Reject→resubmit→approve→publish; 34 admin component cases for lists/details/decisions/errors/roles; real Web approval, cancelled confirmation, later rejection and payment-detail retry. |
| Review UI | 14 component cases for eligibility, validation, pending-write and recovery; real Web submission and independent ratings readback. |
| Availability/booking | Hold expiry, free minutes/next start, pay→reschedule→cancel, flushed-SQL failure rollback/retry, real Web modality fallback and held-time consistency. |

The [matrix](../qa-matrix.md) maps all 23 tasks to exact sources and limits;
the [plan](../test-plan.md) gives commands and expected outcomes.

## Sprint 3 failures retained

| Finding | Actual behavior / required outcome | QA / source |
| --- | --- | --- |
| `S3-BE-REVIEW-DUPLICATE-RACE` | Same-booking concurrent reviews return 201/500 instead of 201/409. One review persists. XFAIL requires actual PostgreSQL `23505` on the introspected `reviews.booking_id` unique constraint; other 500s fail normally. | #213; `test_sprint3_review_concurrency_qa.py` |
| `S3-BE-REVIEW-AGGREGATE-RACE` | Two successful 1/5-star reviews persist, but professional cache counts 1 instead of 2 and returns the last score instead of 3.0. Same-service cache also fails; two-service case verifies both individual caches. | #216/#219; same file, 2 cases |
| `S3-BE-PRIVACY-FIELD-OMISSION` | Partial response redacts values but retains `background`, `experience`, `qualifications` keys; US28 AC2 requires absence. This is a response-contract discrepancy, not original-value leakage. | #186; `test_sprint3_privacy_contract_qa.py`, 2 cases |
| `S3-PRIVACY-ROLLBACK` | Public→Restricted write returns 503; error appears and no success is claimed, but Restricted stays selected. AC3 requires previous stored Public selection. | #183; `sprint3-privacy-acceptance.test.tsx`, controlled HTTP |
| `S3-WEB-ADMIN-OLD-ORDER` | Direct admin detail returns 200 for an order beyond first 200 rows; Web page says “This order could not be found.” | #210; `sprint3-workflows.spec.ts`, attached API proof/screenshot |
| `S3-ADMIN-BOOKINGS-EMPTY` | Failed 503 read also displays “Nothing has been booked yet.” An error does not establish emptiness. | US48 adjacent oversight view / #210; `sprint3-admin-acceptance.test.tsx` |
| `S3-BE-SERVICE-HISTORY` | Service edits change title/meeting area returned for an already paid booking in five views; amount/time/reference stay unchanged. | #201; retained `test_sprint3_service_history_qa.py` |
| `S3-WEB-DIAGNOSIS-CHECKED` | Selected diagnosis radio does not expose Web DOM checked state. | #165/#168; retained `sprint3-accessibility.spec.ts` |

Raw discovery runs retain three review-race failures and two omission failures
without XFAIL masking. The concurrency cause log records both requests reaching
the barriers and the wrong cache values. Future strict XPASS requires review;
it alone does not prove a permanent race fix. Ordinary setup/runtime assertions
remain blocking.

Sprint 2 defects remain in full reports. Repaired empty-availability feedback now
passes in the advisory Web group. Other Web failures still include rounded cents,
negative-price conversion and forged booking confirmation.

## Environment and evidence

- macOS 26.6.2 ARM64; Node 20.20.2/npm 10.8.2; Python 3.12.14;
  PostgreSQL 16.15; pinned Playwright 1.63.0/Chromium.
- Dependency locks match Oct14 preparation. Installed backend versions match
  `uv.lock`; platform-excluded `colorama`/`greenlet` are absent. Dependencies were
  reused.
- Fresh owned loopback PostgreSQL on 55439: `sprint3_qa_test` (regression),
  `sprint3_live_test` (live clients), `sprint3_review_concurrency_test` (focused
  interleavings). No shared DB is used. Temporary services are stopped after testing.
- Normal/defect Chromium runs each use a separate temporary SQLite API. Completed
  bookings and 201 cancelled archive orders are explicit fixtures. Tagged
  transport faults are deliberate; recovery and persistence use real routes.
- Same-origin Web export uses `/api/v1`, demo mode false. Live static checks verify
  shell/deep link and JSON API 404. Independent PostgreSQL reads after live clients
  confirm +4 users, +1 service, +2 orders, +2 bookings and unchanged window count.

[Execution records](../evidence/20261016/executions.json) contain exact argv, cwd,
UTC times, exit code and source overlays. Originals remain in ignored
`artifacts/qa/sprint3-20261016/`; selected evidence is copied under
[evidence/20261016](../evidence/20261016/README.md) with SHA-256 hashes.

Authoring mistakes are retained separately: initial privacy-list tests lacked an
active-service fixture; browser drafts used wrong selectors and assumed OrderOut
contained modality. These were corrected and final combined suites passed. They
are not product defects. The final backend rerun includes the later omission
tests and stricter concurrency-cause classification; earlier totals are historical.

An admin overview suite's requirement-label text changed during broad frontend
execution. A final 11-case targeted run on each of shared/iOS/Android verifies
the final source (`frontend-admin-title-final-*`). These are repeats within the
479/488/488 totals, not additional cases; product source and assertions were unchanged.

## Historical records

[Oct14 results](test-results-20261014.md) and original evidence retain their
dated execution outcomes. These results describe the implementation available
on the baseline stated above.
