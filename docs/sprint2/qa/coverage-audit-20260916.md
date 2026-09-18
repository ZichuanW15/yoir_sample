# Local test coverage audit — 16 September 2026

The implemented product has substantial automated coverage and completed multi-platform executions, with known defects and specific unmeasured paths remaining. This audit reads the retained results; it does not rerun application or device tests. It updates coverage and issue traceability without changing product code, GitHub issue state, or PR content.

Product baseline: `0ffa565e47d60fc2783a4618e5dce6cfe73a4b08`; local QA HEAD: `3e7f4b348c03504360af04d438202e37a5428e83` on `sprint2-qa`. The [machine-readable audit](coverage-audit-20260916.json) records source hashes, per-file metrics, observed native scope and the fresh issue snapshot.

## Instrumented code coverage

| Measure | Shared frontend Jest regression | PostgreSQL backend pytest |
| --- | --- | --- |
| Lines | **96.14% — 1,221 / 1,270** | **95.15% — 785 / 825** |
| Branches | **87.23% — 820 / 940** | **90.38% — 141 / 156** |
| Statements | 93.70% — 1,428 / 1,524 | Same executable-line measure as above |
| Functions | 89.81% — 441 / 491 | No aggregate function metric collected |
| Combined lines + branches | Not an Istanbul aggregate metric | 94.39% — 926 / 981 |

These frontend figures cover the shared normal Jest run across `app/` and `src/`. Defect suites, iOS/Android presets, Chromium and manual simulator sessions are **not merged** into this coverage. Native presets explicitly disable coverage collection; there is no independent iOS, Android, browser or device coverage percentage. An unhit path in this report may have been exercised in another layer.

The existing frontend 90/80/90/90 gates apply to the named API, marketplace-logic, auth and format groups; they are not whole-UI thresholds. The backend 94.39% figure is a combined measure, not its line coverage.

## Completed executions retained as evidence

The [automated results](test-results-multiplatform.md) record run `20260916T043532.423770Z`, 04:35:32–04:38:36 UTC (14:35–14:38 Melbourne). Counts below are existing results, not new tests executed by this audit.

| Layer | Passing regression | Unresolved defect results |
| --- | --- | --- |
| Shared frontend | 265 | 24 failures |
| iOS component preset | 274 | 25 failures |
| Android component preset | 274 | 25 failures |
| Chromium with isolated API | 14 | 5 failures |
| PostgreSQL backend | 347 | 19 strict expected failures; 12 deselected |
| Separate live clients | HTTPX 2; TypeScript 2 | — |

The 12 backend deselections comprise ten future-contract cases and two live cases executed separately. Expected failures remain unresolved findings. Native presets reuse shared cases, so these counts must not be added to claim unique feature coverage. The recorder completed all 22 checks and returned 1 because the four ordinary defect groups failed; no infrastructure group failed in that run.

## Issue-based assessment

GitHub was read at **2026-09-16T06:40:30.446Z**. The [issue/parent snapshot](qa-issue-audit-20260916.json) has no field changes from the preceding audit: **3 closed QA tasks (#87, #94, #97), 17 open**, and all 20 parent stories open. No remote state was changed.

All **20 / 20 QA tasks** have explicit test-file and evidence mappings in the [QA matrix](qa-matrix.md) and [structured evidence](issue-evidence.json). This is mapping completeness, not a 100% acceptance result:

| Local assessment of the implemented boundary | QA tasks | Interpretation |
| --- | --- | --- |
| Implemented scope covered | 11 | Named regression boundary has evidence; remaining parent/native criteria still apply |
| Partial with defects | 8 | Passing paths and reproducible unresolved failures coexist |
| Component and native UI evidence only | 1 (#130) | Profile UI and Android picker launch/cancel observed; backend profile persistence is absent |

The 20 parent bodies contain 94 acceptance checkboxes, all unchecked remotely. Checkbox state is not a measured pass rate. This audit does not invent a per-criterion percentage or claim full acceptance for any task. Opening the existing counsellor workspace under #133 is not evidence of service creation; a successful booking under #121 is not concurrency evidence.

## Gaps within implemented code

The shared frontend run leaves **49 lines, 120 branches and 50 functions** unhit. Availability and marketplace screens account for 27 of those lines and 29 of those functions. Prioritize meaningful behavior over decorative coverage.

| Priority / QA tasks | Source | Lines / branches | Targeted gap in retained shared instrumentation |
| --- | --- | --- | --- |
| 1 — #145 | `frontend/app/counsellor/availability.tsx` | 91.78% / 77.41% | Edit with missing/inactive service or past time; update/delete failure feedback; remove added time, duration choices and calendar navigation |
| 2 — #109, #112 | `frontend/app/marketplace/index.tsx` | 86.66% / 80.00% | Individual modality/location/price/rating resets, guest login callback, response after unmount; some misses are decorative shimmer |
| 3 — #121, #124 | `frontend/app/bookings/checkout.tsx` | 95.34% / 77.27% | Existing countdown reaching zero, disabled payment state, choosing another time and failed initial service load; do not invent backend hold-expiry behavior |
| 4 — #130 | `frontend/app/counsellor/profile.tsx` | 96.15% / 92.00% | Successful picker asset selection and preview; Android launch/cancel alone does not cover these paths or backend upload/save |
| 5 — #100, #106 | `frontend/src/chrome.tsx` | 97.95% / 73.07% | Counsellor account-menu workspace callback and closing paths |

The machine-readable audit includes metrics for all measured files and exact unhit statement/function locations for seven prioritized business files. Some guards may be unreachable through disabled controls; inspect that boundary before adding artificial tests.

Backend coverage leaves **40 executable lines** unhit; 28 are in the development launcher `backend/app/dev.py`. More useful business-path follow-ups are the missing service/slot rejection during booking payment (`backend/app/routers/bookings.py:93`, #121/#124), and empty availability PATCH rejection (`backend/app/routers/counsellor.py:236`, #145). The PostgreSQL run also leaves SQLite-specific auth branches unhit; that does not mean they have never been exercised by the separate SQLite browser layer.

High coverage does not resolve existing failures: `format.ts` has 100% line/branch coverage while 7050 minor units displays as $71; `availabilityPlanner.ts` has 100% while booked-slot, cross-service and DST cases fail; the confirmation screen has 100% line coverage while forged anonymous confirmation remains reproducible. Keep these findings visible in the [defect register](defects.md).

## Native scope already measured

The [native report](native-device-results-20260916.md) documents limited manual Expo Go smoke on the dedicated iPhone 17 simulator and Android API 36 emulator. The iOS UI window is approximately 15:27–15:34 Melbourne; later database queries are separate checkpoints.

- iOS: seven observed journey-summary rows. Android: ten observed rows, plus post-payment Back **not verified** and protected deep links **not tested**. Rows summarize actions; they are not counts of accepted test cases.
- Both runs recorded one persisted stub booking. This audit independently re-read the retained Android database: one consistent order/booking, 9500 AUD minor units, confirmed/paid, one booked slot and no held slots. This read is not another UI test. The owned iOS database was already removed; its dated report retains the earlier verification.
- Each platform has observations linked to 11 QA tasks, with remaining cases for all 20. The actual subsets differ by platform. Ten source/configuration hashes in the manual report still match.
- Android system Photo Picker opening/cancellation is now explicitly reflected in #130. Actual selection, permissions, persistence and the remaining navigation/registration/publishing/availability scenarios stay unmeasured as listed in the [remaining-only native plan](native-acceptance-delta.md). Its N01–N10 groups remain **NOT RUN**.

No native screenshot/video files were available for this audit; UI observations were recorded in the task conversation and measured report. Browser screenshots must not be presented as native evidence. The [platform matrix](platform-test-matrix.md) retains these limits.

## Freshness and reproducibility

All **49 recorded product files** match the automated run. Of its 157 total recorded input fingerprints, 152 match and five differ: the CI workflow, QA scope, recorder, packager and registration test. Reconstructing the registration file with its earlier comment reproduces the recorded SHA-256; that change is comment-only. The other four are later QA tooling/metadata changes. The original run therefore remains evidence for unchanged product behavior, but is not a new execution of the entire current working tree.

The original summary SHA-256 remains:

`94f1d8707fbb3bd75aa99c1d41b0b22153ba5f2f50d81880dda63e61eba5a8de`

At the time of this audit, raw multi-platform logs, coverage, JSON/XML and browser artifacts were local under ignored `artifacts/qa/sprint2/20260916-multiplatform-final/`. The audit preserves derived metrics and source hashes. **Later publication:** the [reviewed original evidence](evidence/20260916-multiplatform/README.md) is included in this QA branch with retained-file hashes and explicit omissions. Tracked `evidence/latest/` remains the historical 15 September run. Publication does not change either run's results or timestamps.

For repeatable procedures, use [reproduction](reproduction.md), [test approach](test-approach.md), and the exact test files in the issue mapping. Verification of this documentation increment is recorded separately in [coverage audit validation](coverage-audit-validation-20260916.json); its QA-tooling checks are not extra application passes.
