# Sprint 3 test results — current

**This is the one current results page for Sprint 3.** The dated execution reports it draws on, and their validation records, are kept unchanged in [`archive/`](archive/).

| | |
|---|---|
| Build tested | `dev` at `8713b38` (merge of PR #246, 17 October 2026). No application code changed after it; later commits are documentation, tests and evidence only |
| CI on the tested build | Application CI passed on `8713b38` ([run 39014178047](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/runs/39014178047)), and the deploy to FastAPI Cloud succeeded on the same push |
| CI on `main` | Application CI passed on `main` at `7fe85df`, 18 October 2026 ([run 39098173135](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/runs/39098173135)). `main` holds the same application code as `8713b38` |
| QA lead | Zhenyang (Wilson, `Zhouzhny`) |

## Results

| Check | Result | Detailed record |
|---|---|---|
| Shared component regression | 610 passed in 70 suites | [Confirmation report, 17 Oct](archive/test-results-confirmation-20261017.md) |
| iOS and Android component regression | 619 passed each | [Confirmation report](archive/test-results-confirmation-20261017.md) |
| Component advisory (known defects) | 4 passed / 19 failed shared; 4 passed / 20 failed on iOS and on Android | [Confirmation report](archive/test-results-confirmation-20261017.md) |
| Lint, type checking and fresh Web export | Passed | [Confirmation report](archive/test-results-confirmation-20261017.md) |
| Chromium regression, desktop and phone-configured | 43 passed / 1 failed in each full run. The failure was the test's expected address after administrator logout; the corrected case then passed in a separate one-case run in each project. Not a full 44-pass run | [Confirmation report](archive/test-results-confirmation-20261017.md) |
| Chromium advisory | 1 passed / 9 failed in each project, including two new accessibility findings | [Confirmation report](archive/test-results-confirmation-20261017.md) |
| Front-end coverage | 87.77% lines / 69.06% branches (85.68% statements / 76.01% functions); the core-source 90/80/90/90 gates passed | [Confirmation report](archive/test-results-confirmation-20261017.md) |
| PostgreSQL API, on `9cce973` | 916 passed, 18 strict expected failures, 7 deselected; back-end coverage 94.84% lines / 85.45% branches | [Meeting-area report, 17 Oct](archive/test-results-meeting-area-20261017.md) |
| Live HTTPX and TypeScript client journeys | 2 passed each | [Meeting-area report](archive/test-results-meeting-area-20261017.md) |
| Native, Expo Go on an iOS simulator and an Android emulator, 16 Oct on `cdcc44e` | 23 case/platform outcomes: 15 PASS, 8 FAIL | [First native run](archive/test-results-native-20261016.md), [remaining native run](archive/test-results-native-remaining-20261016.md), [procedures](device-acceptance.md) |
| Production dependency audit, on `0df4068` | 0 critical; 51 high and 14 moderate findings | [Full review, 17 Oct](archive/test-results-final-20261017.md) |

**Reading these results.** Advisory failures and strict expected failures are real, reproduced failures kept visible under the CI policy; passing the required gates does not mean every product defect is fixed. Results from different revisions and times are kept separate, as the [Sprint 3 Test Approach](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Test-Approach) requires. Native results come from simulators and an emulator in Expo Go on an earlier revision; they do not establish physical-device or release-build acceptance.

## Where to look next

- [QA matrix](qa-matrix.md): all 23 QA tasks, their criteria, executed sources and recorded findings.
- [Test plan](test-plan.md): the commands, isolated databases and environments to repeat these runs.
- [Latest evidence](evidence/20261017-confirmation/README.md): per-case outcomes, logs, coverage and source hashes.
- [QA overview](README.md): what changed in each edition and how the results were produced.
- [Archive](archive/): every dated report from 14 to 17 October 2026, with its validation record and issue snapshot, kept as executed.
