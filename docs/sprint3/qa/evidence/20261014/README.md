# 14 October 2026 local execution evidence

These files retain selected outputs from actual local runs against product
`98cd8cbb6bab98ea4c9a38e350a443b89cdacd16` plus the recorded QA test overlay.
Packaging is not a new execution. UTC timestamps are in each execution record;
Melbourne was UTC+11 on this date.

- [Executions](executions.json): exact commands, directories, safe test-environment
  overrides, start/end times and exit codes. A nonzero defect exit remains nonzero.
- [Source manifest](source-manifest.json): unchanged tracked baseline and final
  added-test hashes; each execution references its own added-source overlay.
- [Preflight and environment](preflight.json): dependency checks, Web export,
  route-cache regeneration and authoring failures/corrections.
- [File manifest](manifest.json): retained-file hashes and original-output hashes
  for reduced reports; omitted artifacts are listed explicitly.
- Frontend per-case reports: [shared](frontend-shared.json),
  [iOS preset](frontend-ios.json), [Android preset](frontend-android.json).
- Advisory per-case reports: [shared](frontend-defects.json),
  [iOS](frontend-ios-defects.json), [Android](frontend-android-defects.json),
  [Web](browser-defects.json).
- PostgreSQL: [complete regression JUnit](backend-postgres.xml),
  [service-history defect delta](backend-history-defect.xml).
- Browser: [initial broad run](browser-regression.json),
  [corrected diagnosis run](browser-diagnosis-final.json),
  [final combined regression](browser-regression-final.json).
- Coverage: [frontend per-file metrics](frontend-coverage.json),
  [backend metrics and uncovered lines/branches](backend-coverage.json).
- [Post-completion diagnosis API observation](browser-diagnosis-final-server-diagnosis-observation.json)
  and [selected radio ARIA observation](browser-defects-diagnosis-radio-state.json).
- [Console logs](logs/) and [selected Web screenshots](screens/).

Earlier failed attempts remain visible. The initial browser authoring run found a
real Web ARIA issue and an incorrect button selector. The next broad run correctly
rejected an unverified test account's booking. The final journey supplies the
existing verified seed precondition; no product code or assertion was changed to
bypass that requirement. The ARIA failure remains an independent defect test.

Raw HTML, LCOV and trace archives remain in ignored
`artifacts/qa/sprint3-20261014/` in the local workspace. They are not included in
this selected package. The result report identifies each executed suite and outcome.
