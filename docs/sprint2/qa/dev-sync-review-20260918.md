# Review fixes against dev — 18 September 2026

The reviewed QA head was `c9762ce291be59088598e972d2bd28b208a760f2`. This update merges `dev` at `776899c8e59669c831b8608513c0567921cb339f` and resolves all nine conflicting files. Production behavior from dev is preserved. The only production-file difference is removal of a trailing blank line in `backend/app/payments/service.py`, required by the whitespace CI gate; all other changes on top concern QA, CI and this evidence. The 15/16 September reports remain historical and do not certify this merge.

## Review requests addressed

- **Backend collection and current contracts:** both Sprint 2 suites use counsellor-owned `AvailabilityWindow` fixtures, derived bookable starts, `startsAt` order requests, service durations, window modality restrictions and order/booking holds. Coverage includes cross-service contention, elapsed starts, ownership, window merging, changes around bookings and payment retries. Former slot-model defects fixed by dev are now positive regressions. The two suites collect 94 cases.
- **Frontend compatibility:** service drafts include `durationMinutes`; API, planner, screen, native, live-client and browser tests use the current window APIs and booking types. Auth mocks handle asynchronous stored-session restoration and refresh. Deleted demo APIs/tests are not restored. Current profile and resource-error behavior is covered by normal regression tests. The generated, ignored `.expo/types/router.d.ts` from the pre-merge route set was removed locally; no app routes were edited to accommodate it.
- **HTTP mocks:** both shared helpers expose case-insensitive JSON Content-Type headers. Dedicated regression cases establish a session through the real client and exercise successful bodyless 204/205 responses. The two `DEF-PROFILE-PROVENANCE` cases now reach their intended assertions and pass in the resource-safety suite.
- **CI/harness:** live database checks count availability windows, which remain present when a booking consumes time. Live booking journeys assert the new-user email-verification gate and use verified seed buyers for payment. QA teardown drops Alembic's version table along with ORM tables, allowing repeated PostgreSQL runs. Defect-report validation now blocks recognizable runtime/setup/transport exceptions, including the reported undefined-session TypeError, while preserving advisory assertion failures.

## Fresh local validation

Executed on the conflict-resolved working tree, with Node 20.20.2, npm 10.8.2, Python 3.12.14, PostgreSQL 16.15 and locked dependencies. Source fingerprints and exact failure names are recorded in [the machine-readable results](dev-sync-validation-20260918.json). Local raw logs/reports are under `artifacts/qa/review-20260918/`; they are not the historical checked-in evidence directories.

| Check | Result |
| --- | --- |
| Two Sprint 2 backend suites, collection | 94 collected |
| Full backend, isolated PostgreSQL + coverage | 564 passed, 15 xfailed, 7 deselected |
| Repeat Sprint 2 run on the same PostgreSQL database | 90 passed, 4 xfailed; migrations successfully recreated the schema |
| Full backend, temporary SQLite fallback | 559 passed, 5 skipped, 15 xfailed, 7 deselected |
| Frontend regression + coverage | 37 suites / 298 tests passed; existing coverage thresholds passed |
| iOS preset components | 38 suites / 307 tests passed |
| Android preset components | 38 suites / 307 tests passed |
| Chromium with fresh web export + isolated API/SQLite | 15 passed |
| Real PostgreSQL HTTPX / TypeScript client | 2 / 2 passed |
| Live database effects and served web/API routes | Passed: +4 users, +1 service, +2 orders, +2 bookings, unchanged window count |
| Frontend lint, TypeScript, web export | Passed |
| Backend compile and Ruff (production + tests) | Passed |
| QA Python tooling / Board tooling / defect-report tooling | 36 / 49 / 87 passed |
| actionlint, repository metadata, QA traceability, whitespace | Passed |
| Production dependency audit, critical gate | Passed; 0 critical, 1 high and 15 moderate advisories remain |

Coverage thresholds were not lowered. Whole-frontend coverage is broader than its gated core directories: 71.66% lines and 61.07% branches, including unexercised new admin screens. Component tests do not certify native devices. PostgreSQL evidence is separate from the SQLite browser server. Provider card payments, delivered email and new device acceptance were not exercised.

## Remaining product defects are visible

The separate advisory suites completed: shared frontend **10 failed / 3 passed**, iOS **11 failed / 3 passed**, Android **11 failed / 3 passed**, Chromium **4 failed**. All four report-health checks passed; these results contain ordinary acceptance assertions rather than the review's login/setup failure. Remaining failures cover amount rounding, negative price normalization, malformed API bodies, confirmation trusting route data, empty-availability feedback, swallowed calendar network feedback, DST recurrence and font-failure recovery. The native presets also assert splash recovery.

The old demo-only findings are retired with the deleted demo feature. Old slot-overlap and profile-fallback findings must not be presented as current failures; current dev behavior has separate passing regression coverage. Backend xfails and frontend advisory failures are not passes or a product-acceptance sign-off.

## Remote checks

The local checks above use the updated sources. The GitHub CLI and in-app browser were not authenticated for this private repository during validation, so this report does not claim a new green remote CI run or a confirmed GitHub mergeability result. Pushing the updated `sprint2-qa` branch triggers the existing required Application CI workflow; its result must be read against that new head, not the 16 September runs.
