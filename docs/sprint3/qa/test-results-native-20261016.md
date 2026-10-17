# Sprint 3 native device results — 16 October 2026

**Completed: 4 case/platform executions passed.** This report covers D02/D03
on iOS and Android within the local diagnosis boundary of the stated baseline.
Independent API readback, evidence packaging and cleanup are complete.

## Scope and baseline

This run executes the local diagnosis procedures D02 and D03 from the
[device acceptance plan](device-acceptance.md), using actual simulator/emulator UI.
Android is operated through **IntelliJ IDEA Running Devices**, as requested.
iOS is operated through Xcode Device Hub. Codex controls the UI and records the
observations at Wilson's request; this is assisted device execution, not a claim
that a human tester manually performed every action.

Product baseline is `cdcc44e66d647a9c5993736b797312b495715a3f`, branch
`sprint3-qa`, with the existing local QA overlay. Final verification matched
all 346 recorded source hashes to the working files. No product fix or weakened
acceptance assertion is part of this device run. Previous automated results
remain historical evidence in the
[gap follow-up report](test-results-gap-followup-20261016.md).

## Environment and fixtures

| Boundary | Recorded environment |
| --- | --- |
| iOS | iPhone 18 Pro simulator, iOS 27.0 runtime build `24A434`, Xcode/Device Hub 27.0 |
| Android | Yoir QA Android API 36.0 AVD, Android 16 / API 36, `emulator-5554`, embedded in IDEA Running Devices |
| Native host | Expo Go 57.0.9; project Expo `~57.0.20`, React Native `0.86.3` |
| JavaScript delivery | Owned Metro at `exp://127.0.0.1:8099`; demo API disabled |
| API | Owned `http://127.0.0.1:43189/api/v1`, health HTTP 200 |
| Database | Exclusively owned temporary SQLite database created by `frontend/e2e/serve.py` |
| External services | Mail and Stripe disabled for this isolated run |
| Accounts | Two newly registered Job Seekers per platform; registration 201 and login 200; email unverified |
| Test time | 16 October Melbourne, AEDT / UTC+11; timestamped evidence uses the evening of 15 October UTC |

The account and source details are in the packaged
[environment record](evidence/20261016-native/services/environment.json).
Before UI execution, independent authenticated reads returned HTTP 404,
`Diagnosis not found`, for all four accounts. The
[baseline readback](evidence/20261016-native/services/diagnosis-baseline.json)
establishes that no server diagnosis had been prepared for them. This is a
precondition, not a final persistence result.

## Execution results

| Case and boundary | iOS | Android |
| --- | --- | --- |
| D02 / #162 #165 #168: local choices, required validation, Back, Skip, process restart and account isolation | **PASS** | **PASS** |
| D03 / #171 #174: completed direction, Explore/no-results, retake, abandoned retake and completed-result restart | **PASS** | **PASS** |

Case-level totals are **4 passed**. The two D02/D03 source procedures produce
four platform executions. Screenshot counts, repeated
checkpoints and prior Jest preset executions are not additional native cases.

### iOS D02

The first account reached an empty Step 1. Continue without a selection stayed on
Step 1 and displayed the required-choice message. The account entered
`Something else` with the note `ios persistence check`, selected `Find a job`,
and reached Step 3. Back restored the selections and exact note.

After the Expo Go process was terminated and reopened through the device UI,
the account remained authenticated and Home reported saved Step 3 of 6. Back
again restored the choices and exact note. Skip returned Home with that saved
progress. Signing out and entering the second account showed empty Step 1;
returning to the first restored its saved Step 3. The operator also observed the
original note when later entering the first retake; that specific observation
is in the CUA interaction transcript, without a separate screenshot checkpoint.

Decisive packaged captures:
[answers after restart](evidence/20261016-native/screens/ios-06-restart-retains-answers.png),
[empty second account](evidence/20261016-native/screens/ios-08-second-account-empty.png),
and [first account restored](evidence/20261016-native/screens/ios-09-first-account-restored.png).

### iOS D03

Completing diagnosis with Interview as the main challenge showed `Interview
skills` and suggested actions. Explore retained that direction. Searching
`zzznativeresults` showed `0 of 9` and an explicit no-results message, with no
fabricated service cards. A completed retake changing the challenge to Resume
updated the result to `Resume and applications`.

A second retake changed the first choice and advanced to Step 2, then was
abandoned with Skip for now. Home retained the previous completed result.
After a second actual Expo Go process termination and UI relaunch, Home and the
full Step 6 direction screen still displayed `Resume and applications` with
suggested actions.

Decisive packaged captures:
[no-results search](evidence/20261016-native/screens/ios-11-explore-empty-search.png),
[abandoned retake](evidence/20261016-native/screens/ios-13-abandon-retake-keeps-result.png),
and [result detail after restart](evidence/20261016-native/screens/ios-15-result-detail-after-restart.png).

### Android D02

Through IDEA, the first account logged in, reached empty Step 1, and correctly
remained there when Continue was pressed without a choice. It then entered
`Something else` with the note `Android`, selected `Find a job`, and reached
Step 3. Back retained the choices and exact note; Skip returned Home with saved
Step 3. After an actual Expo Go force-stop and UI relaunch, Home remained
authenticated and reported saved Step 3 of 6. Back again showed the original
choices and exact note. Signing out and entering the second account showed empty
Step 1 with no first-account note. Returning to the first account restored Step 3;
Back retained `Something else`, the exact note `Android`, and `Find a job`.

These checkpoints are recorded in
[the observation log](evidence/20261016-native/observations.json), including
[Android restart](evidence/20261016-native/screens/android-08-restart-restores-step.png)
and [answers after account switching](evidence/20261016-native/screens/android-12-first-account-note-restored.png).

### Android D03

Completing diagnosis with Interview as the challenge showed `Interview skills`
and suggested next steps. Explore retained that direction. Searching `Zzzz`
showed `0 of 9 services` and `No services match your search`, with no fabricated
cards. A completed retake changing the challenge to Resume updated Step 6 to
`Resume and applications` with new suggested actions.

A second retake changed Step 1 to `Looking to upskill or study`, advanced to
Step 2, then was abandoned with Skip. Home kept the completed result. After a
further actual Expo Go force-stop and relaunch through IDEA's device UI, both
authenticated Home and the full Step 6 result retained `Resume and applications`
and its three suggested next steps. The timestamped
[final restart record](evidence/20261016-native/android-final-restart.json)
records the successful process stop and test-port mappings before UI relaunch.

Decisive packaged captures:
[no-results search](evidence/20261016-native/screens/android-14-explore-empty-search.png),
[completed retake](evidence/20261016-native/screens/android-15-retake-updates-result.png),
[abandoned retake](evidence/20261016-native/screens/android-16-abandon-retake-keeps-result.png),
and [result detail after restart](evidence/20261016-native/screens/android-18-result-detail-after-restart.png).

## Recovered setup incidents

Metro initially bound only the IPv6 loopback address. Restarting the owned
process with Node's `--dns-result-order=ipv4first` provided IPv4 connectivity.
Android subsequently displayed Expo's remote-update download error. Diagnostic
reads found the two test reverse mappings absent; after restoring TCP 43189 and
8099, Expo Go loaded Yoir and business UI execution proceeded. This is a recovered
setup incident, not a demonstrated Yoir product defect.

An initial Android password mistyped through the on-screen keyboard produced an
incorrect-credentials error; corrected input succeeded. That input incident is
also not recorded as a product failure. The
[lifecycle notes](evidence/20261016-native/lifecycle-notes.md) distinguish
retrospective approximate local times from timestamped UI observations and raw
service diagnostics.

## Evidence and recorded API state

The observed persistence is **same-device native local storage in Expo Go**.
The displayed direction comes from the local rules on this baseline.

The [final authenticated API readback](evidence/20261016-native/services/diagnosis-final.json)
at 08:27:51 AEDT returned HTTP 404, `Diagnosis not found`, for all four accounts.
The two first accounts had completed diagnoses in the UI, so their continued
absence on the server confirms the integration gap within this run. Local
restart and account-isolation passes do not close that gap.

[Final source verification](evidence/20261016-native/services/source-verification.json)
matched all 346 recorded files. [Service cleanup](evidence/20261016-native/services/cleanup.json)
completed at 08:28:17 AEDT: both owned processes exited successfully, ports 43189
and 8099 refused connections, and the temporary database and directory were
absent. [Device cleanup](evidence/20261016-native/device-cleanup.json) terminated
both Expo Go processes, removed the two owned Android reverse mappings and
confirmed the remaining reverse list was empty. Both devices were already
booted and remain booted; app data was not cleared. IDEA hardware input was
restored to off.

The [evidence package](evidence/20261016-native/README.md) contains 32 timestamped
observations and 33 original screenshots, plus source, environment and lifecycle
records. Its [SHA-256 manifest](evidence/20261016-native/manifest.json) covers every
packaged file except itself. Local link, JSON and counting checks are recorded in
[validation](evidence/20261016-native/validation.json). Existing historical
evidence is preserved.
