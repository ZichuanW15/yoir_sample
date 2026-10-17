# Sprint 3 executed native acceptance procedures

This page describes the native procedures that produced recorded **PASS or FAIL**
results on **16 October 2026**, with product baseline
`cdcc44e66d647a9c5993736b797312b495715a3f` and the recorded QA overlay.
**Test owner: Wilson.**

The [completed-case projection](completed-native-cases-20261016.json) records
**23 case/platform outcomes: 15 PASS and 8 FAIL** in the retained scope.
The [first native report](test-results-native-20261016.md) contributes four
D02/D03 passes. The [follow-up report](test-results-native-remaining-20261016.md)
contributes eleven passes and eight failures. This scoped summary counts the
listed PASS/FAIL results; original execution artifacts retain their collected
records. Repeated screenshots and API readbacks are supporting evidence rather
than additional native cases.

The [17 October automated report](test-results-final-20261017.md) records the
later `dev@0df4068` API, component and browser executions. Native observations
below remain attached to their 16 October source revision.

## Recorded environment

| Boundary | Environment |
| --- | --- |
| iOS | iPhone 18 Pro simulator, iOS 27.0 runtime build `24A434`, Xcode Device Hub |
| Android | Android 16 / API 36 emulator, `emulator-5554`, IntelliJ IDEA Running Devices |
| App host | Expo Go 57.0.9 |
| JavaScript delivery | Owned Metro at port 8099; demo API disabled |
| API and database | Owned local API at port 43189 and isolated temporary SQLite database |
| Accounts and fixtures | Separate platform-specific seekers, counsellors and owner; labelled verification, payment and completed-session fixture states |
| Failure injection | Selected method, path and account requests rejected by a test-only ASGI layer; matched request records and restored API readbacks retained |

The evidence packages record environment details, source hashes, timestamps,
observed UI, selected accessibility snapshots and independent persisted-state
readbacks. Native test-payment cases use the explicitly labelled development
stub. Image persistence uses the observed JPEG data URI boundary. Controlled
HTTP 503 responses identify the network-failure boundary of those cases.

## Executed procedures and results

Each procedure below is limited to the observed steps supporting its recorded
outcome. “Both” means one iOS execution and one Android execution.

| Case / QA | Platforms | Executed procedure and result boundary | Recorded outcome |
| --- | --- | --- | --- |
| D01 / #180 | Both | Complete counsellor setup; restart and sign in again; inspect a delayed onboarding read; inject a failed onboarding read for an incomplete account. Setup/restoration succeeded, but the failed read exposed the full workspace while stored completion remained false. | 2 FAIL |
| D02 / #162 #165 #168 | Both | Enter local diagnosis answers, validate a required choice, use Back and Skip, restart Expo Go, switch to a second seeker and return. Saved choices and step were restored for the owning account; the second account had separate answers. | 2 PASS |
| D03 / #171 #174 | Both | Complete the local diagnosis, open direction and Explore, search for no matches, complete a retake, abandon another retake and restart. Local direction and completed-result persistence behaved as recorded. | 2 PASS |
| D04 / #183 #186 | Both | Save Public, Partial and Restricted settings, inspect other-account views, restore Public, restart, inject a rejected write and retry. Confirmed visibility and rereads agreed with the API. The observed unsaved selection remaining selected after failure is retained separately. | 2 PASS |
| D05 / #189 | iOS | Edit the seeker profile; inject a failed save and retry; restart; deny photo access, cancel the picker, save the synthetic QA image and switch accounts. Text/image persistence and account isolation matched independent readbacks. | 1 PASS |
| D06 / #192 #195 #198 #222 #231 | Both | Submit verification details; exercise required URL/reason validation, failed submission/decision and retry; leave pending, cancel, reject and approve; return to candidate and owner views. Confirmed decisions and rereads agreed with stored state. | 2 PASS |
| D07 / #201 | Both | Create a native stub-paid booking, open the receipt, edit the service title/price, withdraw the service and reopen history. Amount, time and identity remained stable, but the existing booking/receipt title changed with the service edit on this baseline. | 2 FAIL |
| D08 / #204 #207 | Both | Inspect upcoming, past and empty booking lists; compare online/in-person details and timezone display with the API; follow the external meeting link and return. Recorded participant, delivery and display checks passed. | 2 PASS |
| D09 / #210 | Both | Read owner order/payment information, perform supported transitions, inject a subsequent read failure and recover. Successful reads matched stored records; the failed Bookings read incorrectly displayed an empty state. | 2 FAIL |
| D10 / #213 #216 #219 | Both | Exercise review validation, failed submission/retry and duplicate control; submit as the eligible buyer and inspect service/profile ratings and an unrated service. Confirmed review and rating readbacks matched the recorded UI boundary. | 2 PASS |
| D11 / #225 | Both | Reschedule an owned booking, exercise conflict and failed-move recovery, inspect booking/calendar state and open a foreign participant's booking. Identity/amount remained stable and rejected moves preserved the confirmed booking. | 2 PASS |
| D13 / additional implemented UI | Both | Read the native receipt, payout-status display and notification fallback; delay verification-email resend and double-tap the action. Receipt/status displays matched API values, but two resend requests were issued while the first was pending. | 2 FAIL |

## Observed findings

- **Onboarding failed-read gate:** the incomplete counsellor workspace became
  accessible after an injected onboarding-state read failure.
- **Historical title mutation:** the paid booking and receipt adopted an edited
  service title on the 16 October baseline. The later automated report records
  frozen-title assertions passing against `dev@0df4068`.
- **False empty admin Bookings:** a failed read produced an empty-state claim.
- **Duplicate email resend:** actual double taps issued two requests while the
  first was pending on both platforms.
- **Display precision:** native service/session cards rounded an AUD 84.50 value
  while the receipt retained the exact cents; persisted amounts were unchanged.

These observed failures remain attached to their recorded source and environment.
The [QA matrix](qa-matrix.md) maps current automated assertions and findings to
all 23 QA tasks.

## Supplementary tester confirmations

On 16 October 2026, Wilson reported the following workflow groups as tested
successfully. These are attributed tester confirmations and are listed
separately from the captured case/platform outcomes above.

| Confirmed workflow group | Result |
| --- | --- |
| Real-email delivery | PASS |
| Password-reset flow | PASS |
| Payment-provider flow, including Set up payouts | PASS |
| Offline testing and recovery | PASS |
| Android photo-permission denial | PASS |

## Evidence and reproduction

The [first native evidence package](evidence/20261016-native/README.md) and
[follow-up package](evidence/20261016-native-remaining/README.md) retain source and
environment records, dated observations, screenshots, independent API readbacks
and SHA-256 manifests. Their case IDs connect the procedures above to the
original observations. Successful cleanup records identify the owned API/Metro
processes, temporary databases and Android test-port mappings released after
execution.

The [automated test plan](test-plan.md) provides commands and fixtures for the
current automated suites. The native table above provides the procedure,
environment and observed result for each retained native execution.
