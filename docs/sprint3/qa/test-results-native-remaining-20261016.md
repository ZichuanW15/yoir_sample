# Sprint 3 remaining native device cases — 16 October 2026

**Recorded local run closed; acceptance remains incomplete.** This record covers D01 and
D04–D13 on iOS and Android: **11 passed, 8 failed, 3 blocked, 0 in progress,
0 whole cases not run**. UI evidence was frozen at 10:20:00 AEDT. Within that run,
both true offline reset-submission substeps remain NOT RUN; whole-case totals do not erase
unexecuted or blocked substeps.
No result is inferred from fixture setup, source inspection or earlier automated
tests. Remaining substeps are retained even when a case already has a failure.

## Execution information

**Test owner: Wilson.** Execution methods comprise recorded automated/native
runs and tester-confirmed supplementary checks.

On 16 October 2026, Wilson reported that the following supplementary checks had
been tested successfully. The PASS results below are based on that confirmation.
This is the confirmation date; the supplementary execution dates, build and
environment details, and supporting screenshots or logs were not supplied.

| Supplementary check | Result |
| --- | --- |
| Real-email delivery | PASS |
| Password-reset flow | PASS |
| Payment-provider flow, including Set up payouts | PASS |
| Offline testing and recovery | PASS |
| Android photo-permission denial | PASS |

These confirmations cover the named workflow groups; they do not establish
execution of every detailed token, session-policy or provider substep. The
frozen run's observations, logs and totals below remain its original results.
Its recorded failures remain open. Supplementary confirmations are not added
to the original automated execution logs or counted as new case/platform runs.

## Scope and baseline

The run follows the remaining procedures in [device acceptance](device-acceptance.md).
Android UI was operated through IntelliJ IDEA Running Devices; iOS through
Xcode Device Hub. Results use actual UI observations, with independent API
readbacks where persistence or ownership is asserted.

Product baseline is `cdcc44e66d647a9c5993736b797312b495715a3f`, with the existing
local QA overlay on `sprint3-qa`. API and Metro health checks returned 200 on
owned ports 43189 and 8099; the service environment records 346 source hashes.
[Final source verification](evidence/20261016-native-remaining/services/source-integrity-final.json)
matched all 346 hashes with no differences. Product code was not changed to
make an acceptance check pass. Service and network cleanup are recorded below.

The [earlier native report](test-results-native-20261016.md) separately records
D02/D03 passing on both platforms: **4 historical case/platform executions**.
Those results are preserved and are not counted again in this run.

## Environment and fixture boundary

The [setup record](evidence/20261016-native-remaining/services/fixtures.json) declares
separate iOS and Android accounts, services, bookings and availability windows.
It explicitly labels payment, verification and completed-session states as
fixtures. These are preconditions, not evidence that the native app created a
payment, completed verification or ran the completion scheduler.

The seeded historical orders retain AUD 84.50 total, 8.45 commission and 76.05
professional amount. New native stub-paid orders use the current split of
84.50/16.90/67.60. Each UI read is compared with its own stored order snapshot;
these distinct fixture and new-order splits are not a calculation defect.

This run uses an owned local test environment. Native Expo Go observations,
SQLite API results and development-stub payment are identified separately.
No mail-provider delivery or local captured-mail acceptance was executed.
None establishes a real inbox, live/test provider
transaction, deployed environment, signed standalone build or physical-device
acceptance. No credentials or usable one-time tokens belong in the packaged
report or evidence.

Read-only device metadata was collected at 23:14:51 UTC (10:14:51 AEDT):

| Platform | Device/runtime | Client and UI surface |
| --- | --- | --- |
| iOS | iPhone 18 Pro simulator; iOS 27.0, runtime build 24A434 | Expo Go 57.0.9; Xcode Device Hub |
| Android | emulator-5554, sdk_gphone64_arm64; Android 16 / API 36 | Expo Go 57.0.9, version code 444; IntelliJ IDEA Running Devices |

[Device facts](evidence/20261016-native-remaining/device-final-facts.json) record the read-only command sources. It identifies
the devices at collection time. Restart/restoration observations are recorded
in the native observation logs; a separate original process-lifecycle command
log was not retained. Device metadata does not prove those earlier restarts.

The first test-wrapper startup imported its fixtures before database isolation,
then failed to connect to the nonexistent local PostgreSQL `yoir` database; no
startup database operation succeeded. Lazy fixture import and an explicit early-
import precondition restored the intended temporary SQLite startup. Environment
health checks then passed. This recovered harness setup incident is separate
from product failures and does not establish PostgreSQL execution.

Network-failure checks use the recorded test-only ASGI layer: selected method,
path and account requests are rejected before product invocation. Matched fault
and normal request records distinguish these 503 responses from genuine product
409 conflicts. Product authentication remains unchanged for normal requests.

## Recorded-run case ledger

| Case | Boundary | iOS | Android |
| --- | --- | --- | --- |
| D01 / #180 | New counsellor setup, restart/relogin and failed onboarding read | FAIL | FAIL |
| D04 / #183 #186 | Privacy transitions, other-account visibility, failed write/retry | PASS | PASS |
| D05 / #189 | Seeker profile save/restart/isolation, failure recovery and photo permissions/picker | PASS | BLOCKED |
| D06 / #192 #195 #198 #222 #231 | Verification submission/decisions, cancellation, focus/reread and failures | PASS | PASS |
| D07 / #201 | Native test booking/payment, service edit/withdrawal and preserved history | FAIL | FAIL |
| D08 / #204 #207 | Upcoming/past/empty sessions, delivery, timezone and external link handoff | PASS | PASS |
| D09 / #210 | Owner payment/order readback, transitions and error/recovery | FAIL | FAIL |
| D10 / #213 #216 #219 | Review validation/recovery, duplicate control and ratings/unrated state | PASS | PASS |
| D11 / #225 | Reschedule success, conflict, ownership, failed move and calendar consistency | PASS | PASS |
| D12 / #228 | Reset request/recovery, actual inbox/link, token lifecycle and password change | BLOCKED | BLOCKED |
| D13 / additional UI | Verification email, receipt, payout setup/provider return and notifications boundary | FAIL | FAIL |

Recorded-run totals: **11 passed, 8 failed, 3 blocked, 0 in progress, 0 whole cases not run**.
The machine-readable [case ledger](evidence/20261016-native-remaining/case-ledger.json)
keeps planned substeps and checkpoint evidence separately from whole-case status.

## Recording rules

These rules apply to the recorded case/platform outcomes and their evidence
package. Supplementary workflow confirmations are identified above.

- A **PASS** requires the complete named case/platform procedure to have executed
  successfully within its stated boundary. Several successful checkpoints do
  not make an incomplete case pass.
- **FAIL** records an executed unmet expectation. Prior passing checkpoints are
  retained, and any unexecuted substeps remain identified separately.
- **BLOCKED** identifies a missing environment, external dependency or required
  capability after a concrete attempt/precondition check. It is not a pass.
- **IN PROGRESS** means a case has started but its required sequence is unfinished.
  **NOT RUN** means no native acceptance execution has been recorded for it.
- A setup/API-only action may establish a fixture or independently verify stored
  state, but cannot replace the required native UI step. Source inspection is
  preparation, not an observed product result.
- A failed HTTP response must be demonstrably delivered to the intended request
  before claiming recovery coverage. Record fault activation, matched request,
  UI response, restoration and independent readback.

## Recorded execution observations

### D01 iOS — failed onboarding read opens an incomplete workspace

The new counsellor initially reached the setup gate with both tasks not done.
After profile setup, the UI showed the workspace and pending verification with
the saved LinkedIn URL. Independent readback of that new account confirmed
`profileComplete:true`, `verificationSubmitted:true` and `complete:true`.
Terminating and reopening Expo Go restored its authenticated workspace.

For a different candidate whose setup was incomplete, the controlled fault layer
rejected exactly one `GET /api/v1/me/onboarding-state` with HTTP 503. The iOS UI
displayed the injected error **and the full workspace**. An independent normal
read immediately afterwards confirmed `verificationSubmitted:false` and
`complete:false`. This is an executed failure of the failed-check gate, not a
fixture assumption or a failure of login setup.

Decisive working records: `ios/screens/d01-onboarding-read-failure.png`,
`services/fault-events.jsonl` rule `ios-d01-onboarding-read`, and
`services/ios-d01-failed-read-readback.json`. The successful restart is a separate
checkpoint. Later, a controlled 8-second read delay showed the Welcome loading
view without workspace actions; normal 200 then resolved. Explicit logout and
login to the same completed account restored its workspace and saved profile
values. All named substeps have executed; the failed-read defect remains FAIL.

### D01 Android — setup restoration and the same failed-read defect

Native login reached both setup tasks as Not done. A LinkedIn-only profile draft
showed the minimum introduction-length message without claiming completion.
After all required fields were entered, returning to Workspace showed the full
workspace. The independent profile/onboarding readback agreed that all three
completion flags were true, with verification pending. Both an actual process
restart and explicit native logout/same-account login restored the saved
workspace. A targeted onboarding GET 503 then displayed the connection error
and full workspace for an incomplete candidate. Independent readback still
showed `verificationSubmitted:false` and `complete:false`, so this case is FAIL.
The decisive records are `android-d01-06-failed-read-opens-workspace`, the
`android-d01-onboarding-read` fault event, and
`services/android-d01-failed-read-readback.json`. A later restart of the completed
professional captured a spinner with no Workspace at 22:54:54.091 UTC, inside
the controlled delay from 22:54:48.658 to the real 200 at 22:54:58.665. Workspace
then appeared normally. The earlier capture labelled loading-gate was already
resolved and is not used as pending evidence. All named local substeps executed;
the failed-read case remains FAIL.

### D04 iOS — PASS for privacy transitions and confirmed rereads

A targeted privacy PATCH 503 reported failure while the unsaved Partially visible
selection stayed selected. Reopening the privacy screen restored the confirmed
Public setting; retry then saved Partial. The existing failure-selection rollback
issue is retained separately. The file named `ios-d04-visibility-after-fault.json`
was captured after successful retry, so it proves Partial persistence only; the
intermediate Public state is supported by native reopen and the write audit.

Buyer i1's public professional view of ic under Partial retained introduction
but hid LinkedIn and detailed background/experience/qualification/skill/language
sections, agreeing with independent readback. Restricted then restored Public were saved. The buyer’s Restricted view showed
a restricted-profile explanation with no full content. Final Public was confirmed
by independent readback. Actual Expo Go termination/reopen retained Public.
The same buyer i1 (a different account from professional ic) then opened the restored Public profile. Its screenshot has
a system password-save prompt obscuring LinkedIn, introduction and qualifications;
the native accessibility tree lists those fields, while skills, language and
background remain visible. The Public API readback agrees. This completes the
stated native procedure; the existing
failed-selection rollback and empty-key contract defects remain separate and
are not claimed fixed.

### D04 Android — PASS for privacy transitions and confirmed rereads

A controlled privacy PATCH 503 retained the unsaved Partial selection and
showed an explicit error. Reopening the route restored the confirmed Public
setting. Native retry then saved Partial and disabled Save. The existing
unsaved-selection rollback issue remains separately recorded, as the device
procedure requires. Buyer a1 saw Partial hide detailed fields; after Restricted
was saved, a signed-in a2 view showed only the restricted-profile explanation.
The professional restored Public, corroborated by a buyer API read, and actual
force-stop/reopen retained it. After logout, the native public view again showed
introduction, LinkedIn, qualifications, skills, languages and background. This
final view is an anonymous visitor, while Partial and Restricted were checked
under other signed-in buyers. The named local privacy procedure is complete.

### D05 iOS — PASS for profile persistence, isolation and photo flow

A targeted profile PATCH 503 retained the entered role and career goal. Native
retry saved both values, independent API readback agreed, and a process restart
followed by reopening Edit profile retained them. Photo-library denial produced
Allow photo access without replacing the initial no-photo state. After explicit
user permission, access was limited to a synthetic QA avatar. Cancelling the
native picker retained the profile without adding an image; subsequently selecting
and saving the synthetic image produced Profile saved and a stored JPEG data URI.
The readback records MIME, length and SHA-256; this is not an upload-service test.

Switching to the second account showed its own identity, blank role/goals and
Add a photo, with no first-account content. Independent second-account readback
agrees. Text persistence was tested across process restart; the image was checked
through native save, API persistence and account isolation.

### D05 Android — BLOCKED only on the unavailable denial branch

The targeted profile PATCH 503 retained the edited headline without showing
success; native retry and independent PATCH 200/readback saved Qa tester. The
Android system picker opened directly, explaining that Expo Go receives only
selected photos. Cancelling without selection retained the original initials
avatar and headline. No separate denial prompt appeared in this configured
picker; that denial substep is BLOCKED rather than counted as picker cancellation.
The authorized synthetic image was then selected, cropped and saved; independent
readback records a JPEG data URI and hash. Force-stop and IDEA relaunch retained
both headline and image. After switching to a2, Edit profile showed that
account’s own identity, blank headline/goals and no avatar; fresh API readback
agrees. Five executable substeps passed. The named permission-denial branch is
still BLOCKED on this configured picker, so the whole case is not marked PASS.

### D06 Android — PASS for verification decisions, recovery and rereads

Empty submission showed the required LinkedIn URL validation. A targeted valid
submission POST 503 retained the URL; native retry then showed Sent to Platform
Owner for review and the normalized URL. Owner cancellation and Leave pending retained Pending without a decision write.
An empty rejection reason was rejected; a targeted decision POST 503 retained the
entered reason, and retry persisted Rejected with that exact reason. Confirmed
approval then changed the candidate to Verified, corroborated by owner readback.
After a separate owner API fixture changed Verified to Rejected, the already
mounted candidate Profile and Workspace refreshed to Rejected on focus return.
That fixture change is not claimed as a native owner decision. Later, the owner
started from a mounted Users row marked Verified, natively rejected the candidate
with Qa refresh, and returned directly to Users showing Rejected without a full
reload. Independent current owner readback agrees on Rejected and that reason.
A final native reapproval and direct Users return displayed Verified again.
This completes the named local procedure.

### D06 iOS — PASS for verification decisions, recovery and rereads

The candidate entered a LinkedIn URL in the native verification form. One
targeted `POST /api/v1/me/verification-submissions` returned HTTP 503; the UI
showed an error, retained the URL and kept submission available for retry.
The matched fault and screenshot support this failed-write checkpoint. Retrying
then showed verification pending with the same LinkedIn URL; independent owner
readback confirmed a pending submission and its submitted timestamp.

The owner left it pending, cancelled the rejection form and tried an empty
rejection reason; the UI retained Pending and required a reason. The request
audit contains no decision write before the later explicit failed-write attempt.
A targeted decision POST 503 retained the entered reason; retry saved Rejected
and that exact reason. A later confirmed approval saved Verified. Both outcomes
have independent owner readbacks. The earlier screenshot named
`d06-redecided-verified` shows the confirmation dialog only; success is established
by `d06-verified-confirmed` and its readback.

Candidate relogin showed Verified. After a separate owner API fixture changed
the decision to Rejected, mounted Workspace showed Rejected and Verification
reread agreed. Initial Profile evidence was obscured by a system password-save
prompt; clear settled captures subsequently showed the rejection badge and
Workspace card. The owner then began with a mounted Users row showing Verified,
made a native rejection, and returned to Users showing Rejected. The audit
records fresh user-list reads. A final native approval restored Verified, with
independent readback. These complete the named native procedure.

### D07 iOS — FAIL: service edit changes paid booking and receipt history

The buyer created a new booking through native checkout, which explicitly labels
its backend test payment and says no real money is taken. Confirmation and the
original receipt appeared after payment. Independent owner/booking readbacks
agree on the new order/booking, 24 October 15:00–16:00 Melbourne and AUD 84.50.
The professional then edited the live service title to QA iOS Edited Session
and price to AUD 99.50. The existing paid booking and its original receipt
reference now display the edited title instead of QA iOS Editable Session.
Before/after API readbacks corroborate that history mutation. The original
AUD 84.50 amount, times and identities remain stable. This reproduces the
historical-title defect and makes the case FAIL.

Native withdrawal subsequently removed the service. The buyer could still open
the existing booking, retaining the booked time and amount, while opening the
withdrawn service returned Service not found with no booking action. Independent
booking/order reads remain 200 and public service read is 404. The buyer reopened
the original receipt after withdrawal: same reference, AUD 84.50 and session,
with the edited title still displayed. All named steps have now executed; the
historical-title failure remains.

### D07 Android — FAIL: the existing receipt title changes retroactively

Native checkout created a booking for 24 October 16:00–17:00 Melbourne and
confirmed its explicitly labelled development-stub payment. The independently
opened receipt showed YOIR-B4EB3216, QA Android Editable Session, the correct
parties, time and AUD 84.50. Order, booking and receipt API reads agree. The
confirmation's email guidance does not establish delivery.

The professional changed the title to QA Android Editable Session changed and
current price to AUD 100, then withdrew the service. Workspace and the public
professional list showed four remaining services and omitted that listing.
Reopening the existing buyer booking and original receipt still showed the same
reference, confirmed 16:00–17:00, AUD 84.50 and no GST, but the title now included
changed. API reads captured the same title mutation after editing and before
withdrawal, with the historical amount and identities unchanged. This reproduces
the history defect and makes D07 FAIL.

Existing booking/receipt APIs remain 200. Public service GET and a separately
labelled API-only new-order probe return 404. A direct native route to the
withdrawn service then showed Service not found with no booking control. All
named local steps executed; the history defect remains FAIL.

### D08 iOS — PASS for participant lists, delivery and link handoff

The native upcoming list displayed the fixture sessions in Australia/Melbourne
time. Opening the online session showed its start/end time and Join the session.
That action opened example.com in Safari, and the native return control restored
the same booking detail. This demonstrates external URL handoff and return,
without establishing a real meeting-provider session.

The in-person detail displays the exact fixture address, QA Test Room, Melbourne.
The separate missing-address booking explicitly says no specific address has been
added. Viewed times, brief, participant and delivery data match the baseline API.
Past sessions were also opened. The second buyer had no upcoming sessions and
only its own cancelled competing-reservation fixture under Past, excluding the
first buyer’s records. Independent second-account API readback agrees. These
checks complete the named local native procedure.

### D08 Android — PASS for lists, isolation, delivery and link handoff

The upcoming list showed online fixture sessions with Melbourne time, brief,
joining and receipt actions. Join session opened the synthetic example.com link
in Chrome; the Android back gesture restored the authenticated upcoming list.
In-person detail displayed the exact QA Test Room, Melbourne address and brief.
A separate missing-address detail explicitly says no address has been added.
The online detail, viewed during D11, shows the expected time, brief and Join
action. These agree with independent booking data. Past sessions include the
completed and cancelled records, including the native cancellation made here.
After switching to a2, Coming up was empty and Past contained only its own
cancelled competing-reservation fixture, matching a fresh API readback. An old
route’s Booking not found toast remained visible; the audit shows successful
fresh own-booking/profile reads, so the toast is not evidence of a failed empty
list read. The named local procedure is complete.

### D09 iOS — FAIL: Bookings read error replaces data with false empty state

The owner opened the seeded completed order. Its participants, payment/order/
session states and AUD 84.50 total, 8.45 commission and 76.05 professional amount
agree with independent order readback. After returning to the list, a targeted
GET 503 showed the error and Try again without stale payment rows; retry loaded
the rows again. The buyer later cancelled a booking through native UI; independent
owner readback shows its booking/order Cancelled while payment remains Paid.
The owner returned to that payment detail and saw Paid/Order Cancelled/Session
Cancelled with unchanged amounts, matching the readback. An additional owner
Bookings-list check then first displayed actual sessions successfully. One
targeted GET 503 cleared those rows and displayed Nothing has been booked yet
with the error toast. Leaving and returning issued a fresh 200 and restored the
actual sessions, including cancellation and moved-time updates. This reproduces
the error-as-empty defect and makes the complete case FAIL; the earlier
Payments recovery result remains separately recorded.

### D09 Android — failed booking read makes an empty-platform claim

Owner payment list/detail showed the expected completed-order reference,
participants, Paid/Confirmed/Completed states and frozen fixture amounts
AUD 84.50/8.45/76.05, matching owner API readback. A targeted
`GET /api/v1/admin/bookings` then returned 503. The native screenshot shows both
the error toast and Nothing has been booked yet, despite the populated fixtures.
That unmet error-state expectation makes the case FAIL.

Navigating to Payments and back to Bookings issued a fresh successful read and
populated rows. There was no in-page Retry on the failed view. The audit includes
an earlier Bookings 200, but no successful native Bookings checkpoint before the
failure was captured; a request log alone does not prove visible UI.
Later, a distinct Payments sequence captured a populated native list, switched
to Users and back, received a targeted 503, and correctly showed error plus Try
again without stale cards or an empty-platform claim. Try again issued a fresh
200 and restored current cards. This completes the success-before-failure
sequence for Payments; it does not retrospectively supply a pre-failure Bookings
image or erase the separate Bookings failure. The owner subsequently reopened
the changed order detail and saw Paid/Order Cancelled/Session Cancelled, the
correct buyer/professional, 24 October 13:00 Melbourne, in-person delivery and
AUD 84.50/8.45/76.05, agreeing with the independently read cancelled order. The
exact payment reference remained unchanged. No refund field is visible on
this UI; its API value is separate evidence. All named local substeps are now
complete, with the separate Bookings false-empty failure retained.

### D10 iOS — PASS within the local native boundary

The eligible completed-session fixture opened the review form. Submitting with
no rating showed validation. A targeted review POST 503 retained the selected
five stars and comment; a double-click retry produced one normal 201 request and
one persisted review. The public service and professional profile displayed
5.0 with one review, matching independent API readback. A never-reviewed service
showed New on Yoir and No reviews yet, matching null average and zero reviews;
its separately labelled professional aggregate remained 5.0 with one review.

These checkpoints complete this case's local procedure. They do not establish
scheduler completion, real payment, or concurrent multi-client aggregation.
Earlier aggregation and unrated-professional wording defects remain outside
this passing execution rather than being declared resolved.

### D10 Android — PASS within the local native boundary

The completed-session fixture offered Write a review while a cancelled session
did not. Empty rating and empty comment each showed validation. A targeted POST
503 retained five stars and Qa native review; independent readback still had no
review. An actual double-tap retry, with the first real request delayed three
seconds, produced one normal POST 201 and one stored review. The native service
and professional profile then showed 5.0 with one review, agreeing with the
independent public API aggregates. The never-reviewed service showed New on
Yoir without a service score, while its separately labelled professional
aggregate remained 5.0 with one review. API readback confirms null service
average and zero service reviews. This completes the local named procedure;
completion and payment remain fixture preconditions.

### D11 iOS — PASS for move, conflict, failure retention and ownership

After selecting 14:00–15:00 Melbourne, a targeted reschedule POST returned 503.
The settled screen retained the original 10:00–11:00 booking and showed the
error. Independent booking/order readback confirms the original time, identities
and AUD 84.50 amount. The new-slot selection cleared and needed selecting again;
this checkpoint does not establish retention of that selection.

A second account then created and stub-paid a competing reservation through the
real API after the new slot was selected. The native reschedule returned a real
product 409 and removed the occupied option; the UI and independent readback
retained the original booking/time. The competing reservation is a fixture action,
not native checkout evidence, and this 409 was not injected.

After the competing fixture was cancelled, native retry moved the original
booking to 14:00–15:00. API reads for buyer and counsellor agree on the new time,
same booking/order identities and AUD 84.50; slot availability releases the old
10:00–11:00 interval and excludes the new one. A reschedule deep link opened
under the second buyer showed Booking not found with no Confirm/slot UI; its
real booking GET and independent readback returned 404. The counsellor then
opened the native session list and the moved detail: both showed 14:00–15:00
and the correct buyer, agreeing with the buyer view and independent reads.
This completes the named local procedure; cutoff/fee policy and PostgreSQL
concurrency are not established by it.

### D11 Android — PASS for move, conflict, failure retention and ownership

The targeted reschedule POST 503 kept the original 10:00–11:00 booking and
reported the error. Independent order/booking reads retain the same identities
and AUD 84.50. The newly selected slot cleared, so selection retention is not
claimed. After a separate account made a real API/stub-paid competing reservation,
the native attempt returned a real product 409 and removed the occupied
14:00–15:00 option. The original booking remained unchanged.

Cancelling that competing fixture allowed native retry to move the original
booking to 14:00–15:00. Buyer detail and list agree with the independent reads;
identity and amount are stable, the old time is free and the new time is absent
from available slots. The counsellor subsequently opened the moved booking
from My sessions and saw 14:00–15:00, the original buyer, mode and brief.
Opening a1’s booking link under a2 then showed Booking not found and Try again
with no booking data or reschedule controls; the independent same-account API
read returns 404. The named local procedure is complete. Fixture reservation
is separate from native checkout or PostgreSQL concurrency evidence.

### D12 iOS — BLOCKED beyond request checks

The syntactically invalid address reached the server and returned 400 with native
validation feedback. Known and unknown test addresses both returned 202 and the
same conditional inbox guidance. These are request-boundary observations; the
mail provider is unconfigured, so real inbox receipt and routing from an actually
received link are BLOCKED. A targeted 503 retained the email address; retry 202 returned the generic guidance.
That is HTTP failure recovery, not proof of an offline device submission. The
true offline boundary is NOT RUN; the 503 check does not substitute for it. Password-changing token lifecycle and
session-policy checks require manual user handoff: the CUA Computer/Browser Use
Confirmation Policy §1 says, “Changing a password or other authentication
credential: Ask the user to take over before any new credential is entered, and
have them complete the entry, confirmation, and submission steps themselves.”
No new password entry or reset submission was attempted; this is a tool handoff
requirement, not an actual automatic approval rejection or a product failure.
Local token routing cannot substitute for real inbox delivery.

### D12 Android — BLOCKED beyond request checks

Blank reset-request input showed the required-email message. A malformed address
reached the server and returned 400 with native validation feedback. A targeted
503 retained the known address; retry returned 202 with conditional Check your
inbox guidance. The unknown synthetic address returned the same generic text and
202. Its independent read-only query records no matching account. These are
request-boundary observations, not real email delivery.

Opening the reset route without a token and submitting empty fields showed
missing reset code. No new password was entered. This bounded route check does
not validate a valid, expired, reused or altered reset token. The same manual
credential handoff rule quoted above blocks new-password entry, confirmation and
submission, and therefore the password-change/session-policy acceptance. Real
inbox and received-link routing are BLOCKED. True offline submission is NOT RUN;
the HTTP 503 recovery does not substitute for transport unavailability.

### D13 iOS — FAIL: resend permits a second request while pending

The original native receipt's participants, service, local session time and
AUD 84.50 total agree with independent API readbacks. Opening Notifications
showed You are all caught up; the absent notification backend means this local
fallback is not delivery or read-state acceptance. External email/provider substeps remain blocked within the stated environment
limits; the executed payout view is recorded below.

For the unverified account, an initial AX double-click did not establish a
resend request. A later single coordinate click matched the recorded delay and
real 202, then displayed new-link guidance. A subsequent actual two-tap attempt
issued two requests while the first was pending: the first entered its 3-second
delay at 22:08:12.847 UTC, the second completed 202 at 22:08:13.021, and the first
completed 202 at 22:08:15.851. The native action and request audit demonstrate
failure to prevent a pending duplicate; the whole case is FAIL. No claim is made
that either email was delivered.

The native payout accessibility tree reports not set up and pending charges/
payouts, agreeing with independent status. A system password-save prompt obscures
some flags in the screenshot; the image alone does not prove all of them. Visible
tax fields show GST Not registered and an ABN placeholder, with no ABN stored in
the independent readback; the view
was inspected without changing tax settings, which the device procedure does
not require. The page says the build is not connected to Stripe. Automatic
approval review rejected the Set up payouts action because it may initiate
external financial-provider onboarding. The click was not executed. Provider
handoff, return and cancellation remain BLOCKED; no 503 response or successful
external navigation is inferred from that screen.

### D13 Android — FAIL: resend permits a second request while pending

The native Payouts page showed Payouts not set up, Charges pending and Payouts
pending, and explicitly said the build is not connected to Stripe. Its tax view
showed an empty ABN placeholder and Not registered for GST. Current independent
status agrees, with no connected Stripe account, no enabled charges/payouts and
null ABN/GST false. No tax data was changed. The external
provider flow was not attempted; no bank or identity information was entered.
Provider handoff/return/cancellation is BLOCKED. The separately opened native
receipt matches the original title, reference, participants, time and AUD 84.50
in the API. Opening a synthetic invalid verification link reached the expired-link
page with resend and sign-in options. This is local routing, not an actually
received email or successful verification. Opening a route with no verification
token also showed the missing-code/new-link form; it does not establish token
consumption or inbox delivery.

The unverified account displayed its confirmation banner. An actual double tap
on Resend sent two real requests: the first entered its three-second delay at
23:14:22.292 UTC, the second completed 202 at 23:14:22.447, and the first completed
202 at 23:14:25.304. The settled UI claimed a new link and hid Resend, but the
pending duplicate-control expectation failed. No delivery is established.
The notification bell opened You are all caught up; the absent backend and
404 endpoint leave delivery/read-state BLOCKED. All locally executable D13
checks are recorded, with external inbox/provider boundaries still blocked.

Known defects from earlier runs are investigated, not automatically counted as
reproduced in this run. The ledger identifies each observed checkpoint and the
remaining substeps separately.

### Additional display observation

The iOS session cards and service detail display `$84` for records with
`amountMinor:8450`/`priceMinor:8450`, while the receipt correctly displays
`AUD $84.50` (for example `d08-upcoming-bookings`,
`d10-review-saved-public-service` and `d07-original-receipt`). This is a display
precision discrepancy. The Android review-service page instead shows `$85`
for the same `priceMinor:8450` (`android-d10-06-service-rating`). The readbacks
do not show the paid amount being changed;
it is recorded separately from the named rating/delivery case outcomes.

## External and unsupported boundaries

Real inbox delivery and received-link native routing require an actual controlled
mailbox. A local captured link can test a token/UI path but cannot establish
provider delivery. Provider onboarding/cancellation/return requires a configured
test provider; a normal unavailable response only exercises its error boundary.
The absent notification backend cannot be accepted by observing local fallback
UI. Missing external substeps must remain explicit even when other substeps pass.

## Evidence and closeout

The [evidence package](evidence/20261016-native-remaining/README.md) contains
106 root observations and 104 iOS observations, their original screenshots and
available accessibility snapshots, the case/substep ledger, and the allowlisted
service records. Root observations include the initial iOS onboarding failure;
they are not all Android-only checkpoints and are not extra cases.

[Final reconciliation](evidence/20261016-native-remaining/services/final-reconciliation.json)
performed 14 fresh logins and the listed independent reads successfully. These
API checks corroborate final stored state; they do not add native acceptance
passes. [Service cleanup](evidence/20261016-native-remaining/services/cleanup.json)
records exit code 0 for the owned API, Metro and local navigation processes,
released ports 43189/8099/43219, no remaining fault rules, and deletion of the
owned temporary SQLite directory. [Network cleanup](evidence/20261016-native-remaining/device-network-cleanup.json)
removed only the two matching Android reverse mappings and then observed an
empty list. The original mapping-creation log was not retained; ownership is an
explicit evidence-based inference in that record. Devices and applications were
left running; network cleanup is not device shutdown.

The [publication allowlist](evidence/20261016-native-remaining/services/publish-safety.json),
[copy audit](evidence/20261016-native-remaining/copy-audit.json),
[local validation](evidence/20261016-native-remaining/validation.json), and
[SHA-256 manifest](evidence/20261016-native-remaining/manifest.json) distinguish
original evidence from this written assessment. Private credentials, live fault
controls, executable harness scripts, navigation HTML and raw logs are excluded.
Prior D02/D03 evidence is preserved separately. No provider, signed-build,
physical-device, deployed or PostgreSQL result is implied by this local run.
