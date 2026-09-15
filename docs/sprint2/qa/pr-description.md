## Summary

Add repeatable QA for the implemented Sprint 2 Web/API flows at `0ffa565`, including browser publication recovery and availability CRUD, PostgreSQL concurrency, and real HTTPX/TypeScript client journeys. Keep unimplemented features and undecided policies outside the current test result.

QA-only change: tests, test tooling, CI and timestamped evidence; no business source changes. Existing correctness defects remain visible as real frontend/browser failures and narrow strict backend xfails.

## Evidence

See [QA index](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/sprint2-qa/docs/sprint2/qa/README.md), [results](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/sprint2-qa/docs/sprint2/qa/test-results.md), [defect register](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/sprint2-qa/docs/sprint2/qa/defects.md) and [all 20 QA task mappings](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/blob/sprint2-qa/docs/sprint2/qa/qa-matrix.md). Executed 2026-09-15T08:06:21.058+00:00 to 2026-09-15T08:08:15.456+00:00 (UTC), with stable source hashes.

- Frontend: 256 passed; 18 current defect assertions failed.
- PostgreSQL: 347 passed, 19 narrow strict xfails, 12 deselected.
- Chromium + real API: 13 passed; 2 current defect assertions failed.
- Live PostgreSQL journeys: HTTPX 2 passed and real TypeScript client 2 passed.
- QA tooling 21 passed, Board 49 passed; lint/typecheck/build/metadata/workflow lint passed.
- Full app/src coverage: lines 96.14%, statements 93.70%, branches 87.23%, functions 89.81%. Backend combined coverage: 94.39%.
- Production dependency audit: 0 critical, 1 high, 16 moderate; existing critical gate passed.

Recorder exits 1 only for the two defect groups. Xfails and duplicate browser manifestations are not counted as passed tests or separate unique defects.

## Review status

Draft QA review: known defect checks remain blocking; this does not claim product readiness, provider payment, mobile-device acceptance or completion of every parent story. Remote CI for this change has not yet run.

Refs #87, #94, #97, #91, #100, #103, #106, #130, #133, #136, #139, #142, #145, #118, #121, #109, #112, #115, #124, #127.
