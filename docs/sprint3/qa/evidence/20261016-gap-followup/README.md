# 16 October 2026 — gap follow-up evidence

See the [result report](../../test-results-gap-followup-20261016.md).
This package records 6 added passing regressions and 7 added failed acceptance
assertions. Dates use 16 October Melbourne / 15 October evening UTC.
Packaging is not another application execution.

1. [Execution commands, times, exits and source hashes](executions.json), plus
   [focused refresh executions](refresh-executions.json).
2. [Current QA source overlay](source-manifest.json) and [case inventory](added-case-inventory.json).
3. [Full shared regression](frontend-shared.json) and [coverage](frontend-coverage.json).
4. Refresh regressions: [shared](refresh-shared-final.json), [iOS](refresh-ios.json),
   [Android](refresh-android.json); defects: [shared](refresh-shared-defects-final.json),
   [iOS](refresh-ios-defects.json), [Android](refresh-android-defects.json).
5. [Final browser assertions](browser-integration-final.json) with extracted API
   readbacks/screenshots. The save-error interception count is zero, so its 503
   and retry branch was not reached. Results retain this missing-integration guard.
6. [Device preflight](device/summary.json), [blocked iOS attempt](device/native-ios-smoke/status.json)
   and [cleanup](device/native-ios-smoke/cleanup.json). Zero native acceptance assertions.
7. [Package hashes and omissions](manifest.json).

The [initial browser run](browser-integration-initial.json) contains a harness
precondition mismatch for an omitted null profile rating. The final run uses the
real client normalization contract and reaches the intended missing-wording
assertion. Initial refresh authoring reports/logs are retained, including the
corrected duration-label expectation. An overlapping authoring typecheck is
superseded by the final successful typecheck; see the result report.

Jest/Playwright reports retain all case outcomes and assertion errors; source
report hashes are in the manifest. Duplicate/blank screenshots, trace ZIPs and
regenerable HTML/LCOV remain under ignored artifacts/qa/sprint3-next-20261016.
No real-provider, inbox, native persistence, deployment or remote CI pass is claimed.
