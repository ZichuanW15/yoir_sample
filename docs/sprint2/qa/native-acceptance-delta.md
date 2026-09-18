# Native acceptance delta — unmeasured cells only

Prepared 16 September 2026 from the [issue reconciliation](qa-matrix.md) and
[actual simulator observations](native-device-results-20260916.md). This is a
**NOT RUN plan**, not a new test result. Reuse those dated observations where the
product baseline is unchanged. Do not repeat completed guest/online booking,
both-role login/logout, Android picker cancellation or other measured smoke
checkpoints merely to populate this plan. Setup navigation is not a new pass.

Scope: implemented React Native UI and shared API only, Expo Go on the dedicated
IDEA Android emulator and Xcode Device Hub iOS simulator. No new framework,
Maestro installation, production API, device reset, real payment, or product fix
is needed. Follow the [owned API and Metro setup](../../../frontend/e2e/native/README.md).
Verify the actual API target before writes; use a new exclusively owned temporary
database for a new run, never reset a shared or existing user database. Retained
old evidence does not require reusing its now-consumed slots or old database.

## Execution and evidence rules

- Select only a remaining platform/case from [issue-evidence.json](issue-evidence.json).
  Both platforms are required unless a row explicitly narrows the missing cell.
- Record commit/product and test hashes, dirty overlay, device/OS/Expo Go,
  timezone, API/owned DB identity, timestamps, actual steps, expected and actual
  outcome, and screenshot/log references in a new evidence directory. Redact
  tokens; public QA fixture accounts are not real user credentials.
- Use `pass`, `fail`, `not-run`, or `blocked-environment` per subcase, never one
  blanket result for a whole issue. Missing prerequisites stop dependent steps.
- A failed known assertion stays failed. Record any retry separately; do not
  replace the first observation. Component mocks do not supply a device result.
- Persisted writes need independent API/owned-DB readback. Photo selection is
  UI evidence only while profile upload/persistence is absent. No confirmation
  label alone proves a booking; no successful stub proves a payment provider.
- Unexpectedly encountering a known defect is enough to retain that finding;
  do not deliberately rerun its existing automated reproduction for this update.

## Remaining scenarios

### N01 — Registration and duplicate-email recovery

Issues #87/#94/#97/#91. **iOS: not run; Android: not run.** Use unique run-tagged
emails and test both selectable roles. Exercise required-empty and mismatched
password rejection with the real keyboard: current form-level feedback must
prevent a request. This does not certify the unimplemented per-field/email-format
criteria. Correct inputs, submit once, observe processing without premature
success, then success and the explicit login continuation without implicit login.
Independently read back exactly one account, the selected role and hash-only
credential; do not publish the hash or password in screenshots.

Attempt the same email again: generic registration screen remains, duplicate-email
feedback appears, inputs and role remain, no additional account is created.
Change only the email and retry; confirm one new account and login continuation.
Capture the same UI cases separately on both platforms. Full verification is not
part of counsellor registration acceptance.

### N02 — Native failed-login parity

Issue #103. **iOS: wrong-password, unknown-email and corrected retry not run.
Android: wrong-password/corrected retry already observed; unknown-email comparison
not run.** Compare the visible message for unknown email with the recorded generic
wrong-password message, keep the user signed out and block protected navigation.
On iOS only, also perform the missing wrong-password→corrected-login sequence.
Do not rerun the passed backend parity suite or certify secure-storage inspection
against the current in-memory session implementation.

### N03 — Remaining native navigation boundaries

Issues #106/#127. **iOS: real back gesture after logout and confirmation not run.
Android: protected deep link after logout and post-payment system Back not run.**
Use actual device gestures/buttons with delivery visible, not an unverified IDE
toolbar click. Logged-out Back and `/--/counsellor` must expose no protected data.
For Android, do only the missing deep-link subcase; the signed-out role-page Back
and picker-cancel gestures already have observations. For iOS, reuse the existing
signed-out deep-link observation and add only the missing Back check.

For confirmation Back, use a currently open, valid confirmation if available;
otherwise a fresh owned booking is a prerequisite setup, not a rerun claimed as
new purchase coverage. Back must not resubmit a payment/order or expose a stale
editable paid checkout; inspect the owned DB for no extra order/booking. Test
this independently per OS. Do not equate this with absent booking-read API support.

### N04 — Implemented local search/filter/sort controls

Issue #112. **iOS: advanced filters/sort/empty recovery not run; Android: local
search/filter/sort/empty recovery not run.** Use the current catalogue and combine
offered modality/state/price/rating controls. Check selected criteria remain
visible, every displayed card matches, price sorting orders current records, an
unmatched combination produces an explanatory empty state, and Clear restores
the list. Skip the iOS keyword-only case already observed. These are local UI
checks: parent US45 requires backend query mapping, which remains unimplemented,
excluded and explicitly **not passed**.

### N05 — In-person detail and slot edge paths

Issues #115/#118/#121. **Both platforms: not run for these edge cases.** From
existing seeded service data or a service created in N06, inspect in-person
modality and meeting area; retain the selected service through auth/slot entry.
Do not invent a modality-choice widget or pre-session brief that is absent.
Use an owned service with zero open slots: expect explicit no-slots feedback and
no selectable slot (known defect may fail). For conflict recovery, let a second
owned API session reserve the selected slot before the native user continues;
expect an unavailable/conflict error, no false booking and refreshed open slots.
Inspect persisted counts. Do not repeat PostgreSQL same-slot concurrency tests;
this new cell measures native conflict presentation, not SQLite concurrency.

### N06 — Native service creation, modality and area

Issues #133/#136/#139/#142. **Both platforms: not run.** Login as the seeded
verified counsellor; record backend verification separately from the known
misleading Pending UI. Use a run-tagged service title. Verify no-modality and
in-person/both without state or city reject without a saved service; correct the
form and publish. Observe success only after API confirmation, independently read
back owner/title/priceMinor/modalities/location, and reopen My Services to see the
persisted service. Exercise online, in-person and both with distinct records;
online must not require area. Current banner validation is not inline-field AC.

For native failed-publication recovery, make the owned API temporarily unavailable
only if no other test/user uses it: preserve the complete draft, do not claim a
save, restore the same owned API, retry once, and read back exactly one record.
Do not wipe the database to simulate an error. Service PATCH/DELETE is absent;
mocked edit/delete tests do not authorize calling those flows passed. Negative
price already has failing component/Web evidence; do not duplicate it here.

### N07 — Native availability CRUD and timezone

Issue #145. **Both platforms: not run.** With an owned service and future dates,
add a slot, check displayed timezone and exact backend instants, edit its time,
read back the change, delete the unbooked slot and confirm absence. Require server
confirmation before visible success. Use a distinct future slot for failure
presentation if needed, retain unsaved changes on an unreachable API, and verify
no false persistence. Record actual configured timezone/offset. Existing backend
ownership/concurrency and component DST cases are reused, not rerun. No weekly
calendar, recurrence policy or booked-slot mutation capability is newly required.

### N08 — Remaining native photo UI

Issue #130. **iOS: real picker/cancel/selection and applicable permission paths
not run. Android: picker opening/cancel already observed; selection and applicable
permission paths not run.** Use a non-personal QA image already present or added
to the dedicated simulator. Verify selection changes the preview; on iOS check
cancel retains it. Test grant/denial only where the actual OS presents a relevant
permission dialog. A system Photo Picker may not request broad photo access:
record that behavior, do not mark an unseen grant/deny dialog passed or alter OS
permissions globally. Preview is not upload or durable save; do not exercise
absent profile persistence or repeat the known false-success defect.

### N09 — Native network/startup recovery

Issues #100/#109 and shared startup robustness. **Both platforms: not run.**
Against the owned API, observe catalogue/login while unreachable: loading ends
in actionable failure, no stale list is claimed current, and no authenticated
navigation occurs. Restore only that owned service and use the available retry.
For a cold launch, record visible content and layout; font-fault injection is
not provided by this native harness, so do not claim device font-error recovery
from the existing mocked test. Record that subcase as not run unless a controlled
native fault mechanism is separately prepared. Leave other users' networking alone.

### N10 — Native stub failure and receipt recovery

Issues #124/#127. **Both platforms: error/retry/background paths not run.** Only
exercise faults reproducible through the existing isolated harness. A transport
failure before order/payment reaches the server must not display confirmed
success; preserve a recoverable state and independently inspect the owned DB.
An uncertain post-commit response must be recorded as uncertain, not interpreted
as rollback. Inspect existing persisted records before any retry to avoid creating
duplicate setup bookings. Do not introduce a provider simulator or fabricate a
pending transaction capability. Payment-provider callbacks and participant-only
booking re-read remain excluded. The successful stub journeys are already measured.

## Result template for a future measured delta

```text
Case/subcase: N__ / QA #__
Platform / device / OS / Expo Go:
Product commit + dirty source hash / QA code hash:
Owned API and DB identity (no secrets):
Start/end UTC; screenshot/log references:
Expected / actual:
Outcome: not-run | pass | fail | blocked-environment
Independent persistence check, if applicable:
Reused earlier evidence (reference, not a fresh result):
Remaining/excluded criterion:
```

No result entries are prefilled as passed. This plan does not close issues,
replace the recorded failures, or establish complete iOS/Android acceptance.
