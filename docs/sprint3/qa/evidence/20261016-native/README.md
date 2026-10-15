# Native diagnosis evidence — 16 October 2026

See the [execution report](../../test-results-native-20261016.md) for scope,
results and limitations. Product: `cdcc44e66d647a9c5993736b797312b495715a3f`
with the existing local QA overlay. Android UI was operated in IntelliJ IDEA
Running Devices; iOS UI was operated in Xcode Device Hub.

## Results and counting

D02 and D03 passed on each platform: **4 case/platform executions**. D01 and
D04–D13 remain **NOT RUN** on both platforms (22 combinations). The 32 timestamped
observations and 33 screenshots are checkpoints and setup captures, not extra
test cases. `android-01-launch.png` is a setup capture without an observation row.

- [Summary](summary.json): case totals and the measured boundary.
- [Observations](observations.json): timestamped operator observations, with
  corresponding original screenshots and accessibility snapshots in `screens/`.
  Android accessibility text describes the host window; its screenshots show
  the device state. Accessibility snapshots may be diffs, not full trees.
- [Environment](services/environment.json): account identifiers, baseline,
  commands and source hashes; disposable passwords and session tokens excluded.
- [Final source verification](services/source-verification.json): all 346 hashes
  still match; no product changes during this run.
- [Before](services/diagnosis-baseline.json) and
  [after](services/diagnosis-final.json) independent API reads: all four accounts
  return 404 for their diagnosis. The app's observed persistence is local only.
- [Lifecycle notes](lifecycle-notes.md): explicitly retrospective approximate
  times for the earlier process terminations and recovered setup incidents.
- [Final Android restart](android-final-restart.json): timestamped successful
  force-stop before the final Home and result-detail captures.
- [Service cleanup](services/cleanup.json) and
  [device cleanup](device-cleanup.json): owned API/Metro stopped, temporary
  database removed and the two owned reverse mappings removed. Devices remain
  booted as they were at the beginning; app data was not cleared.
- `ios-preflight/` records read-only runtime/app inventory, not acceptance results.
- Other `services/*.json` files record HTTP health and the recovered Android
  download/reverse-mapping setup issue. They are not product-defect assertions.

## Reproduction boundary

Use the [device procedures](../../device-acceptance.md), provision new disposable
seekers on an isolated API and run the unchanged app with demo mode disabled.
Exercise the actual UI through required validation, partial answers, Back, Skip,
process termination/relaunch, account switching, completion, Explore empty search,
completed retake and abandoned retake. The precise inputs and decisive captures
are recorded in the report and observations. Do not inject stored app state.

The temporary database used here has been cleaned up; its accounts are historical
fixtures, not reusable credentials. Scripts containing the disposable password
are intentionally outside this package. There is no claim of signed-build,
physical-device, PostgreSQL, server-backed resume, provider or client acceptance.

The SHA-256 manifest covers packaged files other than itself. It verifies file
integrity; it does not convert a setup capture into a successful acceptance case.
