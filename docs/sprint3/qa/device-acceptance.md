# Sprint 3 device and external-boundary acceptance procedures

Prepared for product `cdcc44e66d647a9c5993736b797312b495715a3f` on 16 October 2026.
**Test owner: Wilson.**
**D02/D03 passed on iOS and Android in the earlier native run. The remaining
22 case/platform combinations were exercised in the follow-up: 11 PASS, 8 FAIL
and 3 BLOCKED.** The [earlier native report](test-results-native-20261016.md)
retains its four passing executions; the
[remaining-cases report](test-results-native-remaining-20261016.md) records the
separate follow-up, defects and incomplete external substeps. Android was
operated through IntelliJ IDEA in both runs.
The two recorded runs total **26 case/platform combinations: 15 PASS, 8 FAIL,
3 BLOCKED**. Wilson's five supplementary PASS confirmations
are recorded in the report's
[execution information](test-results-native-remaining-20261016.md#execution-information).
They cover the named workflows without replacing the frozen run's results or
specifying every detailed substep, platform, build or execution date.
Shared/iOS/Android Jest results establish component behaviour with controlled OS
boundaries, not device acceptance.

Use the [test plan](test-plan.md) and [QA matrix](qa-matrix.md) for automated
sources. The [gap follow-up report](test-results-gap-followup-20261016.md) identifies
what ran before this native follow-up. The September Expo Go observations are
historical and cannot be reused as observations of this product build.

## Earlier 16 October device preflight and bounded attempt

Xcode 27 and iOS 27 runtime were installed, with Expo Go 57.0.9 on the existing
iPhone 18 Pro simulator. An Android API 36 QA AVD also existed but remained shut
down. Initial absence of a booted/attached device did not mean runtimes were absent.

The iOS attempt booted that simulator and started an owned isolated SQLite API on
43179 plus Metro on 8089; both health checks returned 200. The Device Hub UI tool
then exposed only a menu, could not capture a screenshot and rejected a refreshed
element with error `-10005`. No Yoir screen, diagnosis answer or persistence
checkpoint was reached. **At that attempt, setup was attempted but D02/D03 were
NOT RUN, with zero native acceptance assertions.** This was a tooling blocker,
not a product defect.

The owned API and Metro exited cleanly, ports were released and the simulator was
restored to Shutdown. [Packaged device evidence](evidence/20261016-gap-followup/device/summary.json)
and the [attempt record](evidence/20261016-gap-followup/device/native-ios-smoke/status.json)
include the environment, source hashes, observed blocker and cleanup. A later run
obtained working UI access and completed D02/D03 on both platforms. Its separate
native report records save/restart/account isolation and completed-result
observations without changing this earlier attempt's outcome.

## Setup and evidence for each platform

1. Use a dedicated simulator/device and isolated test API/database. Record device
   model, OS/runtime, app build/commit, Expo Go or standalone build, API commit,
   database engine, tester and UTC start/end. Confirm API URL and demo mode false.
2. Prepare two test seekers, two counsellors and an owner. Use controlled accounts;
   never use a shared/production database or real payment method for these cases.
3. Record fixture preconditions: email verified/unverified, profile visibility,
   verification state, service owner, availability, booking/order IDs and ratings.
   Historical completed sessions may be seeded but must be labelled fixtures.
4. For deliberate network faults, interrupt only this device's test API connection
   or inject the named test response. Record when the fault starts/ends. Restore
   connectivity and independently read the API/database before claiming recovery.
5. Execute each row separately on iOS and Android. Capture the decisive before/
   after UI and, where relevant, persisted API state. Record PASS, FAIL, BLOCKED
   or NOT RUN with a reason. No failure or missing integration may become a pass
   merely because the corresponding component test passed.

## Cases and recorded-run outcomes

The platform columns below describe the two recorded runs. Wilson's later
workflow confirmations are listed in the linked execution information, rather
than counted as additional case/platform executions.

| Case / QA | Procedure | Expected result and boundary | iOS | Android |
| --- | --- | --- | --- | --- |
| D01 / #180 | Log in as a new counsellor; complete each required setup step; close/reopen the app and sign in again. Repeat with a deliberately failed onboarding read. | Stored setup is restored; loading precedes routing; a failed check must not be called a successful completion. Pending-versus-verified publishing policy remains separately agreed. | FAIL | FAIL |
| D02 / #162 #165 #168 | Answer part of the local diagnosis; use Back; skip; force-stop/reopen; sign out; sign in as the second seeker, then return to the first. | Same-device saved choices and resume step are retained, required single-choice validation works and other accounts do not see those answers. Actual local persistence after process restart is observed in Expo Go; this is not a storage security audit. Server-backed/cross-device resume is not implemented and is excluded. | PASS — [native report](test-results-native-20261016.md) | PASS — [native report](test-results-native-20261016.md) |
| D03 / #171 #174 | Complete diagnosis; inspect direction; open Explore, make a no-results search, return; retake and then abandon a second retake. | Saved local result survives navigation/restart, no results are fabricated, and abandoned retake retains the completed result. This does not establish server-derived direction/criteria integration. | PASS — [native report](test-results-native-20261016.md) | PASS — [native report](test-results-native-20261016.md) |
| D04 / #183 #186 | Change Public→Partial→Restricted→Public; inspect from the second account; reopen the app and retry after a rejected write. | Only allowed content is visible; a fresh read reflects the stored setting; old private data is absent. Existing failed-selection rollback and empty-key contract defects remain recorded separately. | PASS | PASS |
| D05 / #189 | Edit seeker profile, save, restart, change account; repeat with failed save. Try photo permission denial, picker cancellation and a supported selected image. | Only confirmed edits persist under the correct account; errors retain editable input. Cancellation/denial do not overwrite the old image. Record the actual image storage boundary; a data URL is not proof of an upload service. | PASS | BLOCKED |
| D06 / #192 #195 #198 #222 #231 | Submit LinkedIn details; owner leaves pending, approves, rejects with reason and redecides; return to Profile, My Services and owner Users; repeat submission/decision with a network failure. | Confirmed states agree after reread; cancelled actions have no write; failed writes have no false success. Capture focus-return separately from a complete reload, including any stale-state defect. OS link opening does not prove LinkedIn identity. | PASS | PASS |
| D07 / #201 | Create and pay a test booking; edit then withdraw its service; reopen booking/order/receipt and attempt a new booking. | Withdrawal prevents new orders but retains the recorded booking, amount, times and receipt. Existing edited-title/history defect is not treated as resolved. | FAIL | FAIL |
| D08 / #204 #207 | Inspect upcoming/past/empty booking lists in the configured timezone; open online and in-person details; follow an external meeting link and return. | Only the participant's records appear; times, brief and address match the API; missing delivery data is explicit. Record actual OS handoff and target app separately from simulated link calls. | PASS | PASS |
| D09 / #210 | Owner opens payment/order details, changes order state through supported operations, then returns; repeat after loading data successfully and causing the next read to fail. | Amounts, participants and progress match the stored order; error is not an empty-platform claim; recovered reads use fresh data. Existing old-order and stale-data defects remain visible. | FAIL | FAIL |
| D10 / #213 #216 #219 | As the eligible buyer, submit a valid review; exercise validation, double tap and failed submission/retry; open public service/profile. Also inspect a never-reviewed service. | One confirmed review persists, drafts recover and displayed ratings match the API. No fabricated score for unrated records. Concurrent aggregation defects and missing explicit profile wording remain unresolved. | PASS | PASS |
| D11 / #225 | Move an owned booking to another free time; repeat with an occupied time, invalid participant and failed request; revisit both calendars/order detail. | Booking/order identity and amount remain stable; old time is released only after a successful move; conflicts/failures retain the original booking. Fees or cutoff policy need agreed requirements. | PASS | PASS |
| D12 / #228 | Request reset using a controlled test inbox; follow the received link; test valid, expired, reused and altered tokens; repeat an offline submit then recover. | Generic request response, real inbox receipt and actual app routing are recorded separately; only a confirmed reset changes the password. Record session invalidation against the agreed policy. | BLOCKED | BLOCKED |
| D13 / additional implemented UI | Open email verification from the controlled inbox, complete resend; view receipt and payout setup; return from provider onboarding and deny/cancel external navigation. | Receipt formatting and current payout state agree with the API; pending calls prevent duplicate actions. Use provider test mode only; component mocks do not prove OS/provider success. Notification UI may be inspected, but its absent backend cannot be signed off as delivered. | FAIL | FAIL |

Case status does not erase incomplete substeps. In the recorded run, D12 was
blocked on actual inbox delivery and user-performed password entry/change, and
true offline transport recovery was not run. D13 recorded local UI failures;
provider onboarding, return and delivery were blocked. Android D05 could not
exercise a permission-denial prompt because its scoped system picker exposed
only selected images. The follow-up report and machine-readable ledger preserve
those observations. Wilson subsequently confirmed PASS for real-email delivery,
password reset, payment-provider flow including Set up payouts, offline
testing/recovery and Android photo-permission denial. The confirmation does not
identify all detailed token/session/provider branches or supply per-platform
execution evidence, so it does not revise the original ledger or erase failures.

## Separate release-environment checks

Signed standalone iOS/Android builds, deployment migration rehearsal and rollback
on a disposable copy, and deployed browser-origin/CORS/deep-link configuration
remain **NOT RUN** in the reviewed evidence. The supplementary email and payment
flow confirmations are recorded above; they do not specify full provider
test-mode payment/webhook/refund/payout lifecycle coverage. Execute remaining
release checks against named test environments with agreed expected outcomes.
Local unit, API, browser and Expo Go results do not establish those boundaries.
