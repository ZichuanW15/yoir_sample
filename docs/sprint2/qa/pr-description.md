## Purpose and scope

Add repeatable tests and reviewable evidence for currently implemented Sprint 2 Web, iOS/Android components and shared API, plus separately recorded limited Expo Go simulator smoke. Product baseline: `0ffa565e47d60fc2783a4618e5dce6cfe73a4b08`. The 16 September local execution used QA HEAD `3e7f4b348c03504360af04d438202e37a5428e83` with its recorded test overlay; all 49 recorded product files still match.

Tests, tooling, CI and evidence only; no product fix. Full verification/LinkedIn review stays in Sprint 3. Missing profile persistence, provider payment, backend-driven search and other unimplemented parent criteria are excluded, not counted as passed.

This updates the existing QA branch and PR #155 into `dev`. Source tests, failure assertions, procedures, issue mappings and selected original execution artifacts are included for team review.

## Evidence — retained, not rerun

- [16 September original evidence and manifest](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/tree/sprint2-qa/docs/sprint2/qa/evidence/20260916-multiplatform): reviewed per-case results, logs, coverage and selected Web failure evidence, with original hashes and explicit omissions. Packaging these files does not create a new test execution.
- [Local coverage audit](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/sprint2-qa/docs/sprint2/qa/coverage-audit-20260916.md): shared frontend lines/branches 96.14%/87.23%; backend 95.15%/90.38%. Per-file gaps are mapped to QA issues; all 49 recorded product files match the retained run. Native/browser coverage percentages were not collected. The refreshed 20-QA/20-parent snapshot has no status changes.
- [16 September automated results](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/sprint2-qa/docs/sprint2/qa/test-results-multiplatform.md): shared components 265 pass / 24 defect failures; each native preset 274 pass / 25 defect failures; Chromium 14 pass / 5 defect failures; PostgreSQL 347 pass / 19 strict xfails. HTTPX and TypeScript live clients each 2 pass. These are existing run outcomes, not new execution.
- [Measured simulator evidence](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/sprint2-qa/docs/sprint2/qa/native-device-results-20260916.md): both platforms completed limited guest/login/stub-booking/workspace/logout smoke with independently checked bookings. Android picker cancel was observed. This is not complete device or release-build acceptance.
- [Issue reconciliation](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/sprint2-qa/docs/sprint2/qa/qa-matrix.md): all 20 QA tasks mapped to passing boundaries, known defects, excluded parent criteria and remaining native cells. Snapshot state: #87/#94/#97 closed, other 17 open; no remote state was changed.
- [Delta-only verification](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/sprint2-qa/docs/sprint2/qa/reconciliation-results-20260916.md): new traceability checks only; no existing application suite repeated.
- [Remaining native scenarios](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/sprint2-qa/docs/sprint2/qa/native-acceptance-delta.md): NOT RUN plan, not additional passes.

The original automated recorder returned 1; known defect checks remain blocking. Strict xfails are unresolved defects, not successes. The selected original 16 September evidence is now included in this branch; the manifest records omitted regenerable reports and trace archives. Tracked `evidence/latest/` remains the historical **15 September** run. Native observations are documented separately; no saved native screenshots or full device sign-off are claimed.

## Review focus

- Negative-price publication, rounded cents, forged/stale confirmations, profile false-save and availability/booking integrity remain real findings.
- A passed local-filter test is not US45 backend query integration. Mocked profiles/edits and native presets do not prove absent APIs or device behavior.
- Review QA scope and evidence separately from product readiness. No blanket `Closes`; close a QA task only under the team's agreed definition of done with linked evidence and clearly tracked remaining defects.
- Push/PR workflows produce their own dated results. The local results above are not a prediction of remote success; inspect the checks for the current commit before any merge decision.

Refs #87, #94, #97, #91, #100, #103, #106, #130, #133, #136, #139, #142, #145, #118, #121, #109, #112, #115, #124, #127.
