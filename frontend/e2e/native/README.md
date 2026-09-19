# Native Expo Go smoke tests

Status: limited iOS and Android manual smoke execution was performed on
**16 September 2026**;
see the [measured native-device report](../../../docs/sprint2/qa/native-device-results-20260916.md)
for actual observations, scope and evidence. Completed checkpoints are not full
native acceptance or execution of every procedure below. The primary approach is manual testing through
**IntelliJ IDEA's Android device tools** and **Xcode 27 Device Hub for the iOS
Simulator**, against the isolated API below. Environment installation or a
successful Metro bundle is not a completed smoke test.

These procedures exercise real React Native views on an Android Emulator or iOS
Simulator. They are **not Jest components, Web/Chromium tests, or standalone
Yoir package certification**. Authoring or parsing a flow is not a passing run.
Record device execution separately for each platform, including failures.

## Safety and prerequisites

- Use a dedicated QA emulator/simulator with the SDK 57-compatible Expo Go
  installed. Android's container is `host.exp.exponent`; iOS uses
  `host.exp.Exponent`. The Yoir standalone ID `au.edu.unimelb.yoir` is not used.
- For Android, enable compatible Android / Android Design Tools plugins in
  IntelliJ IDEA, point them at the existing Android SDK, and reuse the dedicated
  QA AVD in Device Manager. Use Running Devices if the installed plugin exposes
  it; otherwise record the actual emulator window used alongside IDEA. Do not
  generate native project files with Expo prebuild just to expose an IDE menu.
- For iOS, install a compatible simulator runtime and use a dedicated QA device
  in Xcode 27 Device Hub. Record its device model, runtime and UDID. Neither platform requires
  Maestro for the manual procedure; it is not being installed or used for this
  execution approach.
- Finish Expo Go's first-run onboarding and development-menu notices before
  starting a measured test. If the OS asks to open an Expo Go deep link, approve
  that specific local link. Flows do not blindly accept arbitrary dialogs.
- English UI is needed for the existing English accessibility labels. Record
  device language/timezone and distinguish a selector issue from product failure.
- Start only the exclusively owned temporary API below. Never use a deployment,
  shared database, real credentials, or real payment provider. The passwords in
  these flows are public repository seed fixtures, not production credentials.
- The booking flow creates an order and completes the **labelled payment stub**.
  Restart the owned API for a fresh temporary database before each platform/run.
  Do not reset someone else's database. The counsellor flow only reads the
  workspace/profile and logs out.
- Verify the bundle's launch environment and retain API evidence. A localhost
  Metro URL does not prove that the app itself uses the isolated API. If the
  optional YAML is used in a separately authorized future run, its
  `QA_ISOLATED_API=true` flag is only an operator acknowledgement, not a check of
  the bundle's actual API URL.

## Start the owned API

From the repository root, confirm port `58019` is free, then run in a dedicated
terminal/process:

```sh
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET \
  WEB_QA_PORT=58019 \
  backend/.venv/bin/python frontend/e2e/serve.py
```

The existing launcher creates and seeds its own temporary SQLite file, overrides
the caller's database URL, and listens only on `127.0.0.1`. It requires the
existing `frontend/dist/web/index.html`; this is a launcher precondition, not the
UI under test. If absent, build it using the existing Web build procedure first.
The native app uses Metro, not the static Web bundle. Native SQLite smoke does
not replace PostgreSQL concurrency testing. Keep the server running throughout
the flow and stop only that owned process afterward to dispose of its data.

## Start Metro with an explicit native API URL

From `frontend/`, after confirming port `8089` is free:

```sh
env -u EXPO_NO_CLIENT_ENV_VARS \
  EXPO_NO_DOTENV=1 \
  NODE_OPTIONS=--dns-result-order=ipv4first \
  EXPO_PUBLIC_API_URL=http://127.0.0.1:58019/api/v1 \
  EXPO_PUBLIC_USE_DEMO_API=false \
  node node_modules/expo/bin/cli start --go --localhost --port 8089
```

`NODE_OPTIONS=--dns-result-order=ipv4first` ensures Metro's localhost resolves to
IPv4 on this Mac; otherwise Android's reverse mapping may not reach the IPv6
listener. `EXPO_NO_DOTENV=1` prevents a local `.env` from selecting another API. The client
reads these values in `src/api/client.ts`, and Metro inlines them into its bundle.
Fully reload the app after changing environment values. Some currently missing
profile routes still have a product preview fallback even with demo disabled;
this is not server evidence and remains an independently documented defect.

For Android, target the **actual dedicated emulator serial** and establish both
local port mappings before opening Expo Go:

```sh
adb -s emulator-5554 reverse tcp:58019 tcp:58019
adb -s emulator-5554 reverse tcp:8089 tcp:8089
```

An iOS Simulator can reach the Mac's loopback directly; a physical device needs
different networking and is not covered by these commands. Expo Go opens
`exp://127.0.0.1:8089`; app paths use `/--/`, for example
`exp://127.0.0.1:8089/--/counsellor`.

## Launch the dedicated device

Android: in IntelliJ IDEA, use Device Manager to start the dedicated QA AVD
(currently `Yoir_QA_Android`), rather than an unrelated development device. Check
its actual serial with `adb devices -l`, establish the two reverse mappings above,
and open the local Expo URL in the installed Expo Go. Interact with the native
screen through the IDE's available emulator/Running Devices view. Record any
missing plugin, unavailable device tool or launch error as an environment blocker;
do not call it a failed product assertion or a passed device test.

The measured Android run used the docked `Yoir_QA_Android` API 36 emulator in
IDEA and Expo Go 57.0.9. After the user entered `exp://127.0.0.1:8089`, Yoir's
home screen loaded and the manual journeys could proceed. Earlier IDE focus
trouble no longer prevented that limited run.

iOS: open the dedicated simulator in Xcode 27 **Device Hub**, install the
compatible Expo Go if needed, and open `exp://127.0.0.1:8089`. Interact with the
actual simulated device UI. The measured 16 September run used **Yoir QA iPhone**
(iPhone 17, iOS 27 build `24A434`, UDID
`CDF478C3-78B8-4ABF-82FC-D8980188F5D9`) and Expo Go `57.0.9`.
The iOS run must use a freshly restarted isolated API, and have its own evidence
directory; an Android result cannot be reused as iOS evidence.

## Recorded smoke boundary

The linked report records separate iOS and Android observations. On Android,
guest browsing reached seven services and Maya's $95 detail; booking prompted
login. A wrong seed password was rejected through the real software keyboard,
and the corrected password preserved the booking destination. Selecting the
17 September 09:00–10:00 Melbourne slot and the labelled payment stub produced
the confirmation, with one order and one booking for 9500 AUD minor units in the
owned database and matching order/booking references. Alex and Maya logout both
returned home. Maya's workspace showed two services.

Android's real system Photo Picker opened with **No photos yet**. A left-edge
Back gesture cancelled it without changing the `MC` avatar or empty profile
form. A separate signed-out role-page Back gesture returned home, and another
Back left home visible. This does **not** verify post-payment Back protection:
delivery of the earlier IDEA toolbar Back action was not confirmed. Android
protected deep-link access, image selection/upload/save, release packaging and
full native E2E remain unverified. The optional YAML files below were not run.

## Manual smoke checklist — reference, not a blanket rerun

For follow-up work, use the [remaining-only issue-mapped plan](../../../docs/sprint2/qa/native-acceptance-delta.md).
Reuse completed checkpoints from the dated report on the unchanged product
baseline. Run only unmeasured platform/subcase cells; do not repeat this entire
checklist merely because the documentation was updated. Setup needed for a new
edge case is not additional happy-path acceptance coverage.

Choose a new evidence directory per platform/run, for example
`artifacts/qa/native/android-manual-run01/`. Record each checkpoint as **pass**,
**fail** or **not run**, with its screenshot/log reference and actual observation.
Do not fill pass results in advance. Before each scenario, return to the home
screen signed out; if needed, restart only the selected Expo Go container. Do not
erase the emulator or clear unrelated applications' data.

### Guest browsing, login and stub booking

1. On the home screen, choose **Just looking? Browse as a guest**, or use the
   alternative **Job Seeker** → **Continue as guest** route. Record which route
   was actually used; success through one route does not prove the other works.
   Confirm that Marketplace loads from the real isolated API.
2. Search **Interview confidence coaching**, open Maya Chen's **$95** service,
   and select **Book this service**. Confirm the login prompt preserves the
   booking destination.
3. Enter seed fixture `alex@example.com` / `password123` using the native input
   controls. Dismiss the keyboard and select **Log in**. Confirm the app returns
   to **When suits you?**, rather than dropping the intended booking.
4. Select an available future one-hour slot, then **Continue to payment**.
   Confirm **Review and pay**, the selected details and the explicit
   **Test-mode payment** / no-real-money notice before selecting **Pay $95**.
5. Confirm **You're booked**, the no-real-money success text, and the booking and
   payment references. Capture the confirmation and references before leaving.
6. Select **Back to Explore**, then **Account, Alex Rivera** → **Log out**.
   Confirm the signed-out home screen and absence of Alex's account control.
7. Independently inspect only the owned temporary database for the corresponding
   order, booking and slot state. A success message without matching persisted
   data is not sufficient evidence. The displayed stub payment reference is not
   persisted in the database; do not claim payment-ID persistence from it.

### Counsellor workspace, profile entry and logout

1. From signed-out home, select **I am a Career Professional**, then **Log in**.
   Use the seed fixture `maya@example.com` / `password123`.
2. Confirm **Good to see you, Maya**, **Account, Maya Chen**, and the workspace.
   Capture the screen without treating its potentially fabricated Pending
   verification status as a correct server result.
3. Open **Professional profile** and confirm **Edit profile photo** is reachable.
   This checks navigation only, not OS permissions, image selection or upload.
4. Go **Back**, then **Account, Maya Chen** → **Log out**. Confirm signed-out home.
5. Open `exp://127.0.0.1:8089/--/counsellor` in the same signed-out app session.
   Confirm protected workspace content is not exposed and the app returns home.

A missing slot, blocked keyboard, failed login, crash or unexpected navigation
must remain visible in the report. Stop dependent checkpoints and mark them
**not run** when their prerequisite fails. Record retries separately with the
reason; do not silently replace an initial failure with the retry result. Inspect
screenshots and device/Metro/API logs to distinguish environment/setup problems
from product defects. Existing acceptance failures are not waived by this smoke
procedure.

## Optional automation drafts — not used for this execution

`guest-booking.yaml` and `counsellor-login-logout.yaml` remain authored Maestro
drafts for possible future automation. They have **not been executed**, are not
required for IDEA/Xcode manual testing, and are not evidence of passing native
tests. Installing or switching to that runner requires a separate decision.
Their selectors, runner compatibility and failure behaviour must be validated
in a real device run before any automation result is claimed.

## Coverage and evidence boundary

| Manual scenario / optional draft | Expected native observations |
| --- | --- |
| Guest booking / `guest-booking.yaml` | Guest catalogue/detail, login redirect for Alex, actual keyboard input, future-slot selection, stub checkout/confirmation, return to Marketplace and logout |
| Counsellor workspace / `counsellor-login-logout.yaml` | Maya login/workspace, profile/photo-edit control, logout and protected workspace redirect |

The seed generates future slots when the isolated database starts. The optional
booking draft matches a complete one-hour slot accessibility label; for manual
testing, record the specific slot selected. Do not reuse an exhausted/stale seed
database or alter product rules just to make the flow pass.

Retain the completed checkpoint record, screenshots, device/Metro/API logs,
tested Git revision and dirty-tree diff/source hashes, IDE/plugin versions,
OS/device and Expo Go versions, API/DB identity, and start/end times. Retain a
runner/JUnit report only if an automation runner was actually used; manual tests
do not produce one automatically. Independently check that the **owned database**
contains the corresponding order and booking, with the expected slot state;
screenshots of success text alone do not prove persistence. The stub payment
reference is UI/API evidence only, not a persisted payment record. Do not put auth
tokens in published evidence.

This small smoke suite does not certify OS photo permission grant/denial or real
photo selection, iOS back gestures, all Android system-back invariants, offline
recovery, registration edge cases, app-store packaging, or all native acceptance
criteria. Android picker opening/cancellation and the signed-out Back checks
above are the measured subset, not proof of the remaining cases. The image UI
opens the **photo library**, not a camera. A controlled image selection and any
applicable OS grant/denial paths need separate measured runs; profile
upload/persistence is not implemented and must not be claimed. The Maya flow
does not endorse its potentially fabricated Pending verification status; that
display inconsistency remains known. The deferred Sprint 3 verification gate is
not a new Sprint 2 completion requirement or blocker.
Existing known-defect tests remain independent and must not be described as
passing merely because these smoke flows pass.

## Primary references

- [IntelliJ IDEA Android plugin setup](https://www.jetbrains.com/help/idea/create-your-first-android-application.html)
- [Expo deep-link paths](https://docs.expo.dev/linking/into-your-app/)
- [Expo environment variables](https://docs.expo.dev/guides/environment-variables/)
