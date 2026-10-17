# Confirmation and desktop-layout QA evidence — 17 October 2026

Product baseline: `8713b38d63ccb969dcc69a44a02f888fd65caa9a` (`dev`, merged PR #246).
QA HEAD before the pending local merge: `424cf6537372d78aa35cf2b937a7696d4daaba81`.
Owner: Wilson (`Zhouzhny`). Execution timezone: Australia/Melbourne; machine
records use UTC.

See the [human-readable report](../../test-results-confirmation-20261017.md)
for scope, authoring corrections and results, and the [validation](../../confirmation-validation-20261017.json)
for repository/evidence checks.

## Results in this package

- Full shared components: **610 passed**; iOS and Android components: **619 each**.
- Component advisory: **4 passed / 19 failed** shared, **4 / 20** per native preset.
- Second full browser regression: **43 passed / 1 failed** in each project.
  The remaining administrator logout URL assertion was corrected and passed
  in a **separate one-case follow-up per project**.
- Second browser advisory: **1 passed / 9 failed** per project. Initial full and
  advisory runs retain their original outcomes in separate reports.
- Lint, type checking, fresh Web export and five advisory report-health checks passed.
- Configured frontend coverage: **87.77% lines / 69.06% branches**; existing
  core-source coverage gates passed.

The `-final` browser filenames identify the second complete selection, including
its original logout-assertion failure. They do not mean every assertion passed.
The focused follow-up is separate; no combined result is presented as a fresh
full 44-pass execution. No test source changed during an individual run.

## Files and provenance

- [Execution records](executions.json): exact commands, cwd, start/end timestamps,
  exit codes, environment, source scope and changes between execution phases.
- [Source manifest](source-manifest.json): final QA overlay fingerprints and
  product/dependency/workflow equality to `dev`.
- [File manifest](manifest.json): original and published hashes/sizes,
  normalization/redaction and omitted artifacts.
- [Frontend coverage](frontend-coverage.json): configured totals and per-file metrics.
- [Advisory report health](report-health.json): completed assertion/report checks.
- [Assertion comparisons](authoring/index.json): original/corrected matcher on
  the original PR and pre-fix product; selected focused component regressions.
- [Retained backend evidence](retained-backend-evidence.json): hash-verified earlier
  PostgreSQL 916 passes / 18 XFAILs and HTTPX/TypeScript 2 passes each, with their
  original execution times and linked reports.
- [Merge record](merge-record.json): PR #246 head, merge commit and remote checks.

Browser reports retain per-case results, errors, selected original screenshots
and API readbacks. Traces, regenerable HTML reports and screenshots for passed
unchanged cases are omitted; screenshot hashes and references remain recorded.
Logs and text reports redact authentication fragments and normalize whitespace.
These transformations do not alter outcomes.

The Web runs use a fresh Expo export and separately owned local SQLite APIs.
The phone project uses Chromium mobile/touch emulation; responsive and history
cases deliberately resize. Component presets and responsive Web execution have
their own scopes. Payment and mail use isolated test boundaries.

The source runners are included to preserve exact orchestration. The regular
commands and environment setup are documented in the [test plan](../../test-plan.md).
This package records completed local executions; it does not create a QA commit
or new remote CI result.
