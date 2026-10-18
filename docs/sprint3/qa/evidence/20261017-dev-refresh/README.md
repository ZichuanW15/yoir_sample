# Latest dev refresh evidence — 17 October 2026

Dev baseline `972caeed8b16603b11580206692909288a83a436`; local QA merge
`38cd806227453e820838081d6fbea907c6e5ef14` plus the recorded test overlay.

The [execution report](../../archive/test-results-dev-refresh-20261017.md) records the
scope and outcomes. Full component runs at 06:33 UTC recorded 597 shared passes,
606 iOS passes and 606 Android passes. Separate advisory runs recorded 4/19,
4/20 and 4/20 pass/fail outcomes. Lint, type checking and report-health checks passed.

- [Executions](executions.json): exact commands, UTC times, source changes and exit codes.
- [Source manifest](source-manifest.json): hashed final source overlay.
- [Shared](frontend-regression.json), [iOS](ios-regression.json),
  [Android](android-regression.json): per-case results.
- [Shared advisory](frontend-defects.json), [iOS advisory](ios-defects.json),
  [Android advisory](android-defects.json): original failed assertions and diagnostics.
- [Coverage](frontend-coverage.json): configured total and per-file metrics.
- [Report-health checks](component-report-health.json).
- [Retained source/evidence check](retained-evidence.json): unchanged product,
  backend, browser and live-client boundaries with original report hashes.
- [Prior published CI](published-ci.json): completed checks for `15e4143`.
- [Fixture provenance](authoring/privacy-fixture-provenance.json) and
  [fixture check](authoring/check_privacy_fixture.py).
- [Manifest](manifest.json): source/published hashes and transformations.

Logs under `logs/` and focused authoring outputs under `authoring/` preserve the
actual outcomes. Publication copies normalize trailing whitespace and redact
test-authentication fragments if present. Full raw reports and regenerable
HTML/LCOV outputs remain under `artifacts/qa/sprint3-dev-refresh-20261017/`.

To reproduce the sparse-profile fixture check from the repository root:

```bash
DATABASE_URL=sqlite:///:memory: SEED_ON_STARTUP=false backend/.venv/bin/python \
  docs/sprint3/qa/evidence/20261017-dev-refresh/authoring/check_privacy_fixture.py
```

This checks synthetic inputs against the actual production mapper; it does not
connect to a database or provider. Packaging is separate from execution.
