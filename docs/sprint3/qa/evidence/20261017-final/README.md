# Final Sprint 3 QA evidence — 17 October 2026

Product baseline: `0df4068f846b1a8346621af1c7584734980e7178`.
See the [execution report](../../test-results-final-20261017.md),
[QA matrix](../../qa-matrix.md) and [repeatable plan](../../test-plan.md).

- [Executions](executions.json): exact commands, UTC timestamps, exit codes and
  source differences from the final snapshot.
- [Source manifest](source-manifest.json): actual product/test/config fingerprints;
  product, dependencies and workflows match recorded `dev`.
- [Environment](environment.json): runtime and isolated database boundaries.
- [Packaging manifest](manifest.json): original/published hashes, transformations
  and explicitly omitted regenerable artifacts.
- `frontend-regression.json`, `ios-regression.json`, `android-regression.json`,
  `backend-postgres.json`, `browser-final.json`, `httpx-live.json` and
  `typescript-live.json`: per-case ordinary results.
- `*-defects.json`: separate actual advisory outcomes; failures remain failures.
- `browser-regression.json`: initial 38 PASS / 1 FAIL discovery run, retained separately
  from the final regression and advisory classification.
- `*-coverage.json`: total and per-file measured coverage; no native/browser
  coverage percentage is presented.
- `logs/`, `attachments/`, `authoring/`: normalized original logs, selected original
  screenshots/readbacks and authoring results. Original local artifacts remain
  under `artifacts/qa/sprint3-final-20261017/` and the named authoring paths.

This package contains recorded component, PostgreSQL, Chromium and live-client
executions on 17 October. Exact statuses and commands identify each result.

The runner is retained as `runner.py` for provenance; use the repository test plan
for portable commands and provide a newly owned database/output directory. No
application tests were rerun merely to package these files.
