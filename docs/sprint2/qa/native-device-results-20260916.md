# Native simulator smoke results — 16 September 2026

**Measured result: limited iOS and Android smoke journeys completed against separate isolated real local API databases, and each booking was independently verified in its owned database. Both platforms also completed seeded counsellor login/logout; Android opened and cancelled the real system photo picker.** These are limited Expo Go simulator results, not full native acceptance or release approval.

iOS execution window: approximately **15:27–15:34 AEST (05:27–05:34 UTC)**. Android execution window: approximately **15:43–15:58 AEST (05:43–05:58 UTC)**. The UI was operated and inspected through the desktop UI tool, with screenshots and accessibility-tree observations in the task conversation. No saved screenshot files or published CI artifacts are claimed by this report. Maestro was not used.

## Source and environment

- Branch: `sprint2-qa`; HEAD: `3e7f4b348c03504360af04d438202e37a5428e83`, with an uncommitted QA overlay. Product baseline: `0ffa565e47d60fc2783a4618e5dce6cfe73a4b08`. This run has no new commit, push or remote CI result.
- A read-only comparison made while preparing this report found no difference from that baseline under `frontend/app`, `frontend/src` or `backend/app`. This is not a claim that the whole working tree was clean.
- Xcode 27.0; dedicated **Yoir QA iPhone**, iPhone 17, iOS 27.0 runtime build `24A434`; UDID `CDF478C3-78B8-4ABF-82FC-D8980188F5D9`.
- Expo Go 57.0.9, bundle ID `host.exp.Exponent`; the installed archive supports arm64 iPhone Simulator and passed local code-signature integrity verification. The application ran inside Expo Go, not a standalone Yoir `.ipa`.
- Metro: `exp://127.0.0.1:8089`; `NODE_OPTIONS=--dns-result-order=ipv4first`, `EXPO_NO_DOTENV=1`, `EXPO_PUBLIC_API_URL=http://127.0.0.1:58019/api/v1`, `EXPO_PUBLIC_USE_DEMO_API=false`.
- iOS backend: the existing `frontend/e2e/serve.py` launcher, owned PID `12294`, bound to loopback port `58019`. It created its own temporary SQLite database and seeded application fixtures. This process was subsequently stopped before provisioning the fresh Android database described below. No shared/deployed API or real payment service was used.

This record follows the earlier installation-only [native environment checkpoint](native-environment.md). Its measured iOS observations are separate from the [component-preset results](test-results-multiplatform.md).

## iOS observations

| Journey | Observed result | Boundary |
| --- | --- | --- |
| Guest discovery | Home → **Job Seeker** → **Continue as guest** opened the marketplace with seven services. Searching for **Interview confidence coaching** reduced the result to one of seven; Maya's service displayed **$95**. Service detail opened. | The direct guest link on Home was not exercised in this run. |
| Login preserves booking intent | **Book this service** prompted login. Signing in as seeded Alex returned to choosing a time for the selected service. | Seeded-account login only; this is not registration, email delivery or all authentication scenarios. |
| Slot and checkout | Selected **Thursday 17 September, 09:00–10:00, Australia/Melbourne**, then **Continue to payment**. Checkout displayed local **Test-mode payment** and **Pay $95**. | One open slot and one online booking path. |
| Stub payment and confirmation | **Pay $95** reached **You're booked** with the references recorded below. A subsequent read-only database check matched the booking and confirmed its persisted state. | Development stub; no real payment, settlement or email delivery verified. |
| Alex logout | Returned to the marketplace as Alex, then logged out and reached Home. | Does not establish persistence across app relaunch or all token-revocation scenarios. |
| Counsellor workspace | Seeded Maya logged in and opened the workspace, then **Professional profile**. The **Edit profile photo** control was visible. Returned and logged out to Home. | No OS photo picker was opened; no photo selection, permission response, upload or profile-save result is claimed. |
| Signed-out route protection | From Expo Go Home, entered `exp://127.0.0.1:8089/--/counsellor` after logout. The application showed signed-out Home rather than the counsellor workspace. | This specific route was observed; it is not exhaustive authorization coverage. |

## iOS persisted booking evidence

The isolated database was located using the owned backend process's open file descriptors:

```text
/private/var/folders/5h/35gmrt4n5zq84_8vh5md45nm0000gn/T/yoir-web-qa-s7e51gyr/web_test.db
```

At **05:27:31 UTC**, a `sqlite3 -readonly` baseline query returned **0 orders, 0 bookings, 21 open slots and 0 booked slots**. After the UI journey, the read-only order/booking/service/slot/user join returned the observed booking, with order and booking both **confirmed / paid**, the slot **booked**, and the relationship-consistency expression equal to **1**.

| Reference | Observed value |
| --- | --- |
| Order | `0ae10675-eacc-4b02-8b84-f3b9c6aefc9e` |
| Booking | `96305945-927b-4523-94b5-4a8a44865dce` |
| Payment shown in UI | `stub_c371e3dd-6a1b-465d-a191-1051310dace7` |

The database join verified the booking's service, slot, job seeker, counsellor and slot times against the related rows. The **payment reference was observed in the UI only**: the current backend does not store it. On first payment it returns a random `stub_<UUID>`; on an already-completed order it returns `stub_<order ID>`. Consequently this report does not claim that the UI payment reference was matched to a persisted payment record or that reference stability was tested.

The final iOS read-only snapshot at **05:42:44 UTC** contained **1 order, 1 booking, 20 open slots, 0 held slots and 1 booked slot**. Its only order and booking were the references above, still confirmed/paid. The owning launcher subsequently exited normally; a read-only filesystem check confirmed that the old temporary database no longer existed before the Android baseline was recorded. The observations and query outputs remain historical evidence in this report and the task conversation; the raw database is not claimed as retained or published. The old path must not be reused as a permanent artifact.

## Known issues and untested scope

- The login screen still showed misleading demo guidance that any email/password works, despite this run using the real local API and valid seeded credentials. A completed happy path does not clear that defect.
- Maya's workspace still displayed **Verification pending**, while her marketplace service displayed **Verified** and the Android run's seeded database recorded Maya as `verified`. This known presentation inconsistency remains unresolved. The smoke result does not certify publishing eligibility or add the Sprint 3 verification/LinkedIn workflow to Sprint 2 scope.
- On iOS, only the profile-photo control was seen; the OS photo picker was not opened. On Android, the real photo picker opened with no photos available and was cancelled; no permission prompt appeared. Permission grant/deny handling, selecting an image, upload and saved-photo persistence were **not** tested on either platform. No profile fields were changed or saved during this native smoke run.
- Email delivery, camera capture, registration, service editing, availability editing, failed-payment recovery, concurrent booking, offline recovery and accessibility completeness were not exercised in this smoke run.
- SQLite smoke evidence is not PostgreSQL locking/concurrency evidence. Expo Go evidence is not standalone app signing, installation permissions, release splash behavior, store distribution, physical-device behavior or coverage of every iOS version/device.
- Previously reported failing acceptance/defect tests remain separate and are not reclassified as passes by this successful smoke journey.

## Android — limited smoke completed

The dedicated Android emulator was docked in IntelliJ IDEA and UI testing resumed at approximately **15:43 AEST**. The following preflight state was independently checked; these are environment/baseline observations, **not passing Android acceptance tests**.

| Check | Observed state |
| --- | --- |
| Device | `emulator-5554`, AVD `Yoir_QA_Android`, Pixel 8 hardware profile; `sys.boot_completed=1` |
| Runtime | Android 16 / API 36 / `arm64-v8a`; system-image model reports `sdk_gphone64_arm64` |
| Expo Go | `host.exp.exponent`, version `57.0.9`, versionCode `444`, target SDK 36 |
| Fresh owned API | PID `15241`, `/private/tmp/yoir-sprint2-qa/venv/bin/python frontend/e2e/serve.py`, listening only on `127.0.0.1:58019` |
| API health | `GET http://127.0.0.1:58019/api/v1/health` returned `{"status":"ok"}` |
| Device networking | Existing `adb reverse --list` showed both `tcp:58019 → tcp:58019` and `tcp:8089 → tcp:8089` |
| Database baseline | At **15:44:45 AEST / 05:44:45 UTC**, read-only SQLite query returned **7 services, 0 orders, 0 bookings, 21 open slots, 0 held slots and 0 booked slots** |

The new database was resolved from PID `15241`'s open file descriptors; it is separate from the completed iOS run:

```text
/private/var/folders/5h/35gmrt4n5zq84_8vh5md45nm0000gn/T/yoir-web-qa-9pqgyb7h/web_test.db
```

### Observed UI journey

| Journey | Observed result | Boundary |
| --- | --- | --- |
| Guest discovery | Home → **Job Seeker** → **Continue as guest** opened the marketplace with seven services. Opened **Interview confidence coaching**, Maya's **$95** service, then selected **Book this service**. | The direct guest link on Home was not exercised. |
| Invalid login and recovery | Alex's seeded email with `password12` was rejected with an incorrect email/password message. Appending `3` to use the seeded `password123` succeeded and preserved the selected booking flow. | Demonstrates one real incorrect-password response and recovery, not arbitrary-password acceptance or exhaustive authentication coverage. |
| Native input interaction | The actual Android soft keyboard was shown, the password was masked, and the login button could be activated. | This is observed usability on this emulator, not all keyboard sizes, locales or accessibility modes. |
| Checkout | Selected **17 September, 09:00–10:00, Australia/Melbourne**. Continued to checkout, observed explicit test-mode payment wording, and selected **Pay $95**. | One online booking and development-stub payment only. |
| Confirmation | Reached **You're booked** with the booking/payment references below. The booking text was independently checked against the database, removing ambiguity from its small on-screen rendering. | No real payment, email delivery or full native acceptance is claimed. |
| Return and logout | **Back to Marketplace** succeeded. Opened **Account, Alex Rivera**, selected **Log out**, observed **Logged out**, and returned to Home. | This confirms the observed UI logout path, not every token-revocation or relaunch scenario. |
| Limited signed-out Android Back gesture | After logout, opened the counsellor role welcome page. An actual left-edge Android Back gesture returned to Home; repeating the gesture from Home left the application on signed-out Home, without returning to an authorized screen. | One observed signed-out navigation path only. The gesture was performed through the docked device UI, not an injected adb key event. |
| System Back immediately after payment | **NOT VERIFIED.** Clicking the triangle Back control in the IDEA device toolbar produced no independently verifiable navigation response. | This attempted control action is not counted as proof that Android system Back is blocked after payment or that the checkout stack is safe. |
| Counsellor login | Entered `maya@example.com` and the seeded `password123` using the onscreen keyboard. Login succeeded; the workspace showed **Good to see you, Maya** and **2 published** services. | Seeded account only. The workspace's **Verification pending** wording disagreed with the marketplace's **Verified** label; this remains a known issue, not a completed verification workflow. |
| Native photo picker and cancel | Opened **Set up professional profile**, then the avatar pencil control. The actual Android photo picker showed **Photos / Albums** and **No photos yet**. No permission prompt appeared. A left-edge Back gesture cancelled it and returned to the original profile, still showing the **MC** avatar and empty LinkedIn/Introduction fields. | No image was selected, no form fields were entered, and **Save profile** was not used. This establishes picker launch/cancel behavior only, not permission grant/deny handling, upload or new profile-data persistence. |
| Maya logout | Returned to the workspace, opened the account view showing **Maya Chen / Career Counsellor**, selected **Log out**, observed the **Logged out** toast, and reached Home by approximately **15:58 AEST**. | The final observed application state was signed-out Home. No cold-relaunch/session-persistence claim is made. |
| Signed-out direct deep link | **NOT TESTED on Android.** | The specific iOS deep-link result is not transferred to Android. |

### Android database verification

A `sqlite3 -readonly` transaction at **15:54:30 AEST / 05:54:30 UTC** returned exactly **1 order, 1 booking, 20 open slots, 0 held slots and 1 booked slot**. The only booking was the one shown in the Android UI:

| Field | Verified value |
| --- | --- |
| Booking reference — UI and database | `606db395-7fda-4cc9-9f9f-007915a6b779` |
| Related order reference — database | `2754855a-5179-44c2-be94-c889876e5983` |
| Slot reference — database | `3c124bd7-f20d-40f9-8620-b0a19d7485f6` |
| Payment reference — UI only | `stub_bf9640c6-3e8a-4cfb-8a1e-25e84c0e8b21` |
| Service and participants | `Interview confidence coaching`; `alex@example.com` → `maya@example.com` |
| Amount / currency | `9500` minor units / `AUD` |
| Order and booking status | Both `confirmed` / `paid` |
| Slot status | `booked` |
| Stored slot start / end | `2026-09-17 09:00:00.000000` / `2026-09-17 10:00:00.000000` |
| Stored timezone / modality | `Australia/Melbourne` / `online` |
| Booking creation timestamp | `2026-09-16 05:53:58.095729` |
| Relationship consistency | `1`: booking/order service, slot and job seeker matched; counsellor matched the service owner; booking times matched the slot. |

As with iOS, the UI payment reference is not stored by the backend and was **not** independently verified in SQLite. The timestamp columns above are reproduced as stored, not a claim that SQLite preserves an explicit timezone offset.

At **15:56:17 AEST / 05:56:17 UTC**, a further read-only snapshot still returned **1 order, 1 booking, 20 open slots, 0 held slots and 1 booked slot** following the observed navigation/logout steps. This does not turn the inconclusive post-payment toolbar Back attempt into a passing Back test.

The final read-only snapshot at **15:59:05 AEST / 05:59:05 UTC**, after Maya's logout, returned **7 services, 1 order, 1 booking, 20 open slots, 0 held slots and 1 booked slot**. Maya's seeded record remained `verified`, with **2 active services**. The counsellor login/picker-cancel/logout journey did not add another booking or order; no profile edit/save was attempted.

The **limited Android smoke is complete**, including the observed booking, invalid-login recovery, both seeded-account logout paths and native picker cancellation. **Post-payment Android system Back remains NOT VERIFIED; Android signed-out direct deep linking remains NOT TESTED.** This is not full native acceptance or standalone release-package validation. Database evidence checks were read-only and did not create the order or booking; those records resulted from the observed UI journey.

At this checkpoint the owned local API, Metro server and Android emulator are intentionally being retained for the user's continued inspection; this report update did not stop or clean them. The Android database is still temporary and may be removed when its owning launcher exits. Its current availability is not a claim of a permanent archived database artifact.

## Relevant source fingerprints

These SHA-256 values were read from the working tree when preparing this report, after the observed journey. They identify relevant current files; they are not a complete start/end run manifest.

```text
c8fd186d031a3da0e502f8178596fd1d023b7edc51b2b09b8662115c5bc3e27f  frontend/app/auth/login.tsx
355dbc57e2804f31668750f6e30be2358c580ba06c3212ccf6592d72c07cc615  frontend/app/services/[serviceId]/timeslots.tsx
ed0dcb4ce7f5f46951ebb3a7be22d2c5a6a4140223be6b7af948a81fc1fb2216  frontend/app/bookings/checkout.tsx
4fe3ef74cbd7a76078a0958b5aa0e3d60e53c36b05ee09188a7d9fdca274392c  frontend/app/bookings/confirmation.tsx
e5e7f29796f3d13eb33f743e469cbc769840a22c8834e41f72ab9c08af5b0697  frontend/app/counsellor/index.tsx
3a83ca3ea6e8fe5f97502c7408cee51aba6d515eee6f9a3919b221ce9182f40c  frontend/app/counsellor/profile.tsx
2726f8842ad80c8f662040814c355918031ae2aa2c64f98f79a3bb39addc419e  frontend/src/api/client.ts
31553bd1d4d27e2cbef46927ee5da4ab4231e6e40eadece93db84c7abf569d00  backend/app/routers/bookings.py
8ab88c80857a4a2777170bf32b102b1d1e9b26419f25b2db1aceaea63640b99f  frontend/e2e/serve.py
c75de92770a1d1941b5d79e7210a38ef9e4f926f22494570137236ae02144141  frontend/app.json
```
