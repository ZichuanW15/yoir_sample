# Native environment setup — 16 September 2026

Status at this checkpoint: **both native environments installed; limited iOS and Android manual smoke executed**. See the [measured native-device report](native-device-results-20260916.md) for the observations and evidence, not a blanket native-platform sign-off. The working QA overlay remains uncommitted on `sprint2-qa`, HEAD `3e7f4b348c03504360af04d438202e37a5428e83`. No product source, dependency lockfile, commit, push, remote issue or PR was changed by this environment setup.

## Verified installation

| Component | Observed state |
| --- | --- |
| Host | Apple Silicon, macOS 26.6.2; Java 21.0.10; Node 20.20.2 |
| Android command-line tools | 22.0, installed under `~/Library/Android/sdk/cmdline-tools/22.0` |
| Android emulator / platform tools | 37.1.11 / 37.0.1; Hypervisor.Framework acceleration check returned success |
| IntelliJ IDEA | 2025.3.3; official Android plugin `253.31033.145` and Android Design Tools `253.30387.20` installed |
| Android SDK packages | Platform 36 revision 2, sources 36 revision 1, and Build Tools 36.1 / 37 installed through SDK Manager |
| Dedicated virtual device | `Yoir_QA_Android`, Pixel 8, ARM64 Google APIs image revision 7; Android 16 / API 36 |
| Android boot / IDE integration | `emulator-5554` became connected; `sys.boot_completed` returned `1`; dedicated AVD booted through IDEA Device Manager and appeared in Running Devices |
| Expo Go Android | Official 57.0.9 APK installed and used for the measured manual smoke; package `host.exp.exponent`, versionCode 444 |
| Xcode | 27.0, build 27A266a, installed from Apple's App Store; license dialog cleared in the user's session |
| iOS runtime / device | iOS 27 build `24A434` installed; dedicated `Yoir QA iPhone` (iPhone 17), UDID `CDF478C3-78B8-4ABF-82FC-D8980188F5D9`, booted in Xcode 27 Device Hub |
| Expo Go iOS | Official 57.0.9 simulator app installed and used for the measured manual smoke |
| Maestro | Not installed and not used; the selected execution approach is IDEA / Device Hub manual testing |

Xcode's external coding-agent access was left disabled; it is not required for simulator testing. watchOS, tvOS and visionOS were not selected.

IDEA required a restart after configuring the existing SDK path before its device
windows registered correctly. No Gradle project or Expo prebuild was generated to
enable those tools. An earlier IDEA UI-focus problem interrupted setup, but the
later docked Running Devices session supported manual interaction. After the
user entered the local Expo URL, Yoir's home screen loaded and the limited
Android business-journey run proceeded. The setup interruption is not a product
failure, and successful boot alone is not the acceptance evidence.

## Preflight checks, not acceptance tests

- Started the existing `frontend/e2e/serve.py` launcher on loopback port 58019 using an exclusively owned temporary SQLite database. Health returned `ok`; seven seed services were present; orders and bookings were both zero before UI execution. No shared or deployed API was used.
- Started Metro on loopback port 8089 with `EXPO_NO_DOTENV=1`, `EXPO_PUBLIC_API_URL=http://127.0.0.1:58019/api/v1` and `EXPO_PUBLIC_USE_DEMO_API=false`. Android reverse mappings were created for these two ports on the dedicated emulator only.
- Initial Metro listening was IPv6-only even though its displayed URL used IPv4. Restarting with `NODE_OPTIONS=--dns-result-order=ipv4first` made the IPv4 manifest request succeed. This was a local environment correction, not a product fix.
- Expo Android and iOS manifests identified SDK 57.0.0. Both platform-specific development entry bundles compiled and downloaded successfully (Android 6,999,258 bytes; iOS 6,374,968 bytes). Lazy development entry compilation is not whole-app runtime coverage or an `.apk`/`.ipa` build.
- Prepared [manual native smoke procedures](../../../frontend/e2e/native/README.md), with two optional Maestro YAML drafts. YAML parsing passed, but the drafts have not been executed and cannot be listed as passing automated tests.

## Measured device execution

On 16 September, approximately **15:27–15:34 Australia/Melbourne**, the dedicated
iOS device completed the limited manual guest browsing/login/stub-booking and
counsellor workspace/logout smoke procedures. See the
[device report](native-device-results-20260916.md) for checkpoint results,
limitations and evidence. This was native UI execution in Expo Go, not a Jest
preset, compiled bundle or standalone application build. Existing known defects
are not waived by a successful smoke checkpoint.

The later Android run in IDEA's docked API 36 emulator also exercised guest
catalogue/detail, rejected incorrect Alex credentials followed by successful
login with the booking destination retained, future-slot selection, labelled
stub payment and confirmation. The owned database contained one corresponding
order and booking for 9500 AUD minor units, with matching order/booking
references. Alex logout and Maya login/workspace/profile/logout were observed.
The actual Android Photo Picker opened with no photos available; cancelling
with the left-edge Back gesture preserved the avatar/form. Signed-out
role-page-to-home and home-to-home Back gestures were also observed.

Post-payment Back remains **not verified** because delivery of the IDEA toolbar
Back action was not confirmed. Android protected deep-link access, actual image
selection/upload/save and complete native acceptance were not exercised. The
known Pending-versus-verified display inconsistency remains a data-display
limitation; the deferred Sprint 3 verification gate is not a new Sprint 2 blocker.

For each further execution, inspect current listeners and devices and establish a
fresh owned database before recording a run. This document does not assert that
test processes remain running or have been stopped. Do not reuse production
credentials or call real payment services.

## Download provenance

Android tools were downloaded from [Google's official Android tools page](https://developer.android.com/studio). The ARM64 archive SHA-256 matched the published value:

`835b62a26162b229b441d1f6d4680383815a270809eb33522c0d480fa5002c4e`

The installed Expo CLI's SDK-version metadata selected [Expo Go 57.0.9 official release](https://github.com/expo/expo-go-releases/releases/tag/Expo-Go-57.0.9). Local downloaded-file SHA-256 values (integrity records, not independently published vendor attestations):

- Android APK: `14c18828a3d04e43922245920bd941b978fd1c7a5aec88a0188032f0bb4972ce`
- iOS simulator archive, subsequently installed for the measured smoke: `faff18034c9f3504ea4786f07350efab604610c61cfcabd0f2191fc4416a7614`

Local setup/download evidence is under `/private/tmp/yoir-native-setup.x1kWVs`; this is temporary local evidence, not a published artifact. Keep it separate from the earlier component and browser results.

## Remaining validation

The limited iOS and Android smoke does not cover all native acceptance criteria:
actual OS photo permission grant/denial and image selection, post-payment Android
Back, iOS back gestures, Android protected deep links, cold-start font/network
failure recovery, registration cases, and service creation/availability management
still need measured native runs. Android picker cancellation and signed-out Back
observations do not close those broader gaps. Independently verify the owned
database's order, booking and slot state in each further booking run;
the displayed stub payment reference is not a persisted payment record. Report
environment/selector errors separately from product defects.

Expo Go execution will validate native views and local API interaction inside Expo Go; it will not certify a standalone Yoir build, release signing, store distribution, independent-package permissions or physical hardware. Known product-defect tests remain failing independently of these smoke flows.
