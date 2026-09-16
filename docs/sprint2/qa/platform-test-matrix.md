# Sprint 2 multi-platform test boundary

Updated 16 September 2026. Scope: currently implemented Web, iOS, Android and shared backend/API functions. Product sources are not changed by this QA update; missing Sprint 3 verification, profile persistence and provider payments are not newly implemented or certified.

## Automated layers

| Target | Commands | What the evidence establishes |
| --- | --- | --- |
| Shared components/logic | `npm run test:coverage`, `npm run test:defects` | Existing screens, providers and pure logic with explicit mocked boundaries; the default Jest preset is not Web or native-device E2E |
| iOS components | `npm run test:ios`, `npm run test:ios:defects` | Expo iOS preset, iOS module resolution and platform guards, real app components with mocked device services |
| Android components | `npm run test:android`, `npm run test:android:defects` | Expo Android preset, Android module resolution and platform guards, real app components with mocked device services |
| Web browser | `npm run test:web`, `npm run test:web:defects` after a fresh Web export | Chromium navigation and real HTTP against an owned temporary database; not mobile Safari or native execution |
| Shared backend | PostgreSQL pytest plus isolated HTTPX/TypeScript live suites | Authorization, persistence, validation and concurrency independently of the frontend device |

Run frontend commands from `frontend/`; the repository recorder runs all these layers and saves independent logs/JSON. Shared cases running on two native presets are two executions, not twice as many unique product capabilities.

At the user's request on **16 September 2026**, the separate shared, iOS, Android
and Chromium defect suites are **advisory in CI**. Their assertions still run and
report actual failures; those outcomes no longer block the workflow. Ordinary
regression, coverage, lint, type checking, build and required execution/report
health checks remain blocking. Installation/startup failures and missing,
malformed or incomplete reports are not accepted as successful evidence. Report
validation does not determine the cause of every individual failing test.

This is a CI gate change, not a product repair or platform certification. Green
means the current regression and CI-health gates passed, not that known defects
or remaining native criteria are resolved. The local recorder stays strict and
continues to return nonzero for defect failures; historical results stay intact.

Code coverage is collected only by the shared normal Jest regression and backend pytest runs. The native presets disable coverage; browser and manual-device runs are not instrumented. The [coverage audit](coverage-audit-20260916.md) reports exact counts and issue-linked gaps without attributing shared percentages to each platform.

## Verification-status distinction

- Seed Maya is verified in the backend. A missing profile endpoint may currently produce an unlabelled local Pending profile. Tests check that unavailable data does not become a fabricated authoritative status; they do not require the missing profile API to be implemented in this sprint.
- New counsellor registration is pending and service creation currently returns 403. Tests preserve that implemented gate and verify no service is persisted. The team/PO still needs to settle publishing eligibility separately from the deferred full verification workflow.
- A demo/preview response is not evidence of server persistence. Denied writes must not become local success.
- The Pending-versus-verified display inconsistency remains known; it does not bring the full verification gate into Sprint 2. That deferred Sprint 3 functionality is not a new Sprint 2 completion requirement or blocker.

## Native device checks — limited iOS and Android smoke recorded

The component run above preceded native environment installation. On 16 September,
Android SDK tools, a dedicated Pixel 8 Android 16/API 36 emulator and Expo Go
57.0.9 were installed; the emulator booted through IntelliJ IDEA 2025.3.3 Device
Manager and appeared in Running Devices. Official Android / Android Design Tools
plugins are installed. A later docked Running Devices session allowed manual
Android business journeys after the user entered the local Expo URL. Earlier IDE
focus trouble did not prevent this later run. See
[native environment status](native-environment.md); boot alone is not the device
acceptance evidence.

Xcode 27.0 and iOS 27 build `24A434` are installed. A limited manual smoke ran on
the dedicated iPhone 17 simulator in **Xcode 27 Device Hub**, using Expo Go 57.0.9,
approximately 15:27–15:34 Australia/Melbourne on 16 September. The measured scope
was guest browsing, login/slot selection/stub booking, and counsellor
workspace/profile-entry/logout/protected-route checks. Consult the
[native-device results](native-device-results-20260916.md) for actual checkpoint
outcomes and known limitations; do not infer full iOS acceptance or Android
success from the iOS run. It does not change the automated component totals.

The separate Android smoke observed guest catalogue/detail, invalid-password
rejection, correct login preserving the booking destination, a future slot and
labelled stub-payment confirmation. Its owned database had one matching order
and booking for 9500 AUD minor units. Alex logout and Maya's two-service
workspace/profile/logout were observed. The system Photo Picker opened with
**No photos yet**, and a left-edge Back gesture cancelled it without changing the
avatar/form. Signed-out role-page Back returned home; another Back left home
visible. These are measured subsets: post-payment Back is **not verified** because
the IDEA toolbar action's delivery was not confirmed, and Android protected
deep-link access and image selection/upload/save were not executed.

The [native test guide](../../../frontend/e2e/native/README.md) now uses IDEA and
Device Hub manual execution. Its two optional Maestro YAML drafts remain
unexecuted; Maestro was not installed or used. Parsing YAML or compiling native
JavaScript does not count as a passing device test. Linux CI jobs named
**components (not device E2E)** do not substitute for device evidence either.

## Remaining native acceptance work

The [issue-mapped delta plan](native-acceptance-delta.md) selects only unmeasured
cells from this checklist. It is NOT RUN documentation, not new device evidence;
the already observed smoke results should not be repeated on an unchanged baseline.

The iOS and Android smoke runs are only subsets of the following matrix. Preserve
the measured report's platform-specific results, and record
build/commit, OS/device, API/database identity, timestamp, steps and outcome
separately for every remaining case on each platform:

1. Launch from a cold start; confirm visible content, safe-area layout and usable recovery when fonts/network fail. Component fault injection does not substitute for native startup observation.
2. Register/login both roles, validate fields with the real software keyboard, dismiss the keyboard, navigate protected routes, then logout and check denied access/token replay against the QA backend.
3. Open catalogue/detail, select a future slot and use the labelled stub payment. Inspect confirmation, Android system back and iOS back gesture. Do not test real payments or shared data.
4. Use a seeded verified counsellor to publish a service and manage availability; independently read back persisted records. Verify a pending account's current 403 path does not claim success.
5. On the implemented photo picker UI, test permission grant/denial, cancellation and selection with actual OS dialogs. This validates the UI only; profile upload/persistence remains out of scope.

In particular, actual photo permission grant/denial and image selection,
post-payment Android Back, iOS back gestures, Android protected deep links,
cold-start font/network fault recovery, registration edge cases, and service
creation/availability management remain outstanding native coverage. Android
picker cancellation and signed-out Back checks do not establish all OS
permissions or navigation invariants. Do not mark the whole matrix passed from
these limited smoke runs. Current automated results and remaining product
defects are documented independently of this checklist.
