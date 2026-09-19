# US-06 frontend: Login, stored session and role-based navigation

Issue: [#98](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/98),
under [US-06 #9](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/9).

This slice covers the public login screen, how the returned session is stored and reused, and where each
role lands after logging in. It also covers the guards that send signed-out or wrong-role users away from
role screens. Failed-login feedback is in [US-07](us07-failed-login-feedback.md) and logout in
[US-08](us08-logout.md). The backend login and role checks are in the
[US-06–08 backend doc](../backend/us06-us08-auth-sessions.md). Refresh tokens
(`POST /auth/sessions/refresh`) were added to the backend after that doc was written; see
[auth.py](../../../backend/app/routers/auth.py).

## Screens and flow

`/auth/login` ([login.tsx](../../../frontend/app/auth/login.tsx)) is public. Ways to reach it:

| From | Parameters passed |
|---|---|
| Role welcome **Log in** ([welcome.tsx](../../../frontend/app/auth/welcome.tsx)) | `role` |
| Entry "Already have an account? Log in" ([index.tsx](../../../frontend/app/index.tsx)). Its code comment names it as the way in for a Platform Owner, whose role is never offered as a card. | none |
| Top bar **Log in** for guests ([TopBar.tsx](../../../frontend/src/components/TopBar.tsx)) | none |
| Guest taps **Book this service** on service detail, or opens its time slots | `serviceId` |
| Guest taps the **Bookings** tab ([JobSeekerNav.tsx](../../../frontend/src/components/JobSeekerNav.tsx)) | `role=job_seeker` |
| Registration **Continue to log in** ([US-02](us02-registration-outcome.md)) | `role`, `email`, optional `serviceId` |
| Guards on `/bookings`, `/job-seeker/profile`, `/job-seeker/diagnosis` and `/admin/*` (table below) | varies |

The screen shows **Close**, "Welcome back", an intro line (different when `serviceId` is set), **Email**
(prefilled from `email`), **Password**, the **Log in** button, "Forgot your password?" (password reset,
US-70, not covered here) and "New to Yoir? **Create an account**".

After a successful login the app calls `router.replace` and shows the toast `Welcome, <first name>`:

| Role returned by the server | No `serviceId` | With `serviceId` |
|---|---|---|
| `job_seeker` | `/job-seeker`, which redirects to `/job-seeker/diagnosis` if this device has no stored diagnosis ([US-09–13](us09-us13-yoir-diagnosis.md)) | `/services/[serviceId]/timeslots` |
| `counsellor` | `/counsellor` (workspace, "Good to see you, <first name>") | `/services/[serviceId]` |
| `platform_owner` | `/admin` ([admin/index.tsx](../../../frontend/app/admin/index.tsx), "Yoir administration") | `/services/[serviceId]` |

The home routes come from `homeFor()` in [navigation.ts](../../../frontend/src/navigation.ts). Routing
uses `session.user.role` from the server's response. The `role` route parameter is passed to `login()` as
`roleHint`, but `api.login` does not send it.

Signed-in navigation. Job Seeker: bottom tabs **Home**, **Explore** (`/marketplace`) and **Bookings**.
Career Professional: **Workspace**, **Bookings** and **Profile**
([CounsellorNav.tsx](../../../frontend/src/components/CounsellorNav.tsx)). Platform Owner: the
`AdminShell` top bar ([shell.tsx](../../../frontend/src/admin/shell.tsx)). There is no Forum entry for
any role.

## Behaviour and states

- **Local check:** if the trimmed email or the password is empty, the screen shows
  `Enter your email and password.` and sends nothing. The email is trimmed; the password is sent as typed.
  There is no email-format check.
- **Waiting:** the button label changes to `Logging in`, and the button is disabled with a spinner and
  `accessibilityState.busy`. There is no navigation until `login()` resolves, and a second tap sends
  nothing.
- **Storing the session:** `AuthContext.login` ([AuthContext.tsx](../../../frontend/src/auth/AuthContext.tsx))
  sets the session in React state and then writes it as JSON under the key `yoir.session`. On iOS and
  Android this uses `expo-secure-store` ([sessionStore.ts](../../../frontend/src/auth/sessionStore.ts));
  its comment says this is the Keychain on iOS and EncryptedSharedPreferences on Android. On the web it
  uses `localStorage` ([sessionStore.web.ts](../../../frontend/src/auth/sessionStore.web.ts)). That file
  records that any script on the origin can read the token and accepts the trade-off. If a write fails,
  the error is swallowed and the session lives only in memory.
- **Using the token:** screens pass `session.accessToken` to the client, which sends
  `Authorization: Bearer …`. If a request that carried a token gets a 401 on a path outside `/auth/`,
  the client runs a single shared refresh (`POST /auth/sessions/refresh`) and retries the request once.
  If the refresh is refused, the session is dropped and cleared ([client.ts](../../../frontend/src/api/client.ts),
  [authBridge.ts](../../../frontend/src/api/authBridge.ts)).
- **Relaunch:** `AuthProvider` renders nothing until the stored session has been read. It restores the
  session if either the access token or the refresh token is still valid, and otherwise clears it. The
  entry screen then redirects a restored session to `homeFor(role)`. The parent story left relaunch
  behaviour open; `dev` now signs the user back in.

Role guards (each screen checks the session itself):

| Screen | Signed out | Signed in with another role |
|---|---|---|
| `/` | Entry screen | Redirect to `homeFor(role)` (any signed-in user) |
| `/job-seeker` | Guest version of Home | Redirect to `homeFor(role)` |
| `/job-seeker/diagnosis`, `/job-seeker/profile` | Redirect to `/auth/login?role=job_seeker` | Redirect to `homeFor(role)` |
| `/counsellor`, `/counsellor/profile`, `/counsellor/availability`, `/counsellor/payouts`, `/counsellor/services/new`, `/counsellor/services/[serviceId]/edit` | Redirect to `/` | Redirect to `/` |
| `/admin/*` (`AdminShell`) | Spinner, then replace with `/auth/login` | Spinner, then replace with `/` |
| `/bookings` | Replace with `/auth/login` | Not checked in the screen |

Accessibility labels the tests use: `Email`, `Password`, `Log in` / `Logging in`, `Create an account`,
`Forgot your password?`, `Close`, the account button `Account, <name>`, and the tabs `Home`, `Explore`
and `Bookings`.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.login(email, password, roleHint?)` | `POST /auth/sessions` | Body `{ email, password, client }`. `client` is `web` or `native` (`platformClient`) and sets the refresh-token lifetime: 7 days for web, 90 for native by default ([config.py](../../../backend/app/config.py)). Returns `Session` `{ accessToken, expiresAt, user, refreshToken?, refreshExpiresAt? }`. |
| internal `refreshAccessToken()` | `POST /auth/sessions/refresh` | Body `{ refreshToken, client }`. Never used for `/auth/` paths, so a failed login cannot refresh its way in. |
| any authenticated call | various | Sends `Authorization: Bearer <accessToken>`. |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| AC1: a Job Seeker with correct credentials gets a JWT that is stored in device secure storage, and lands on the Job Seeker home with navigation to Marketplace (now **Explore**) and Forum | **Partly met.** The session is stored in SecureStore on iOS and Android and in `localStorage` on the web. The user lands on `/job-seeker`, or the diagnosis first for a new account. **Explore** is there; **Forum is not.** | `login.test.tsx` "[QA-100] successful login authenticates the real provider and opens the job seeker home"; `AuthContext.test.tsx` "signing in writes the session down for next time"; `AuthContext.http.test.tsx` "[QA-100] stores the returned session and resolves login to its authoritative role"; Playwright `US06/08 Web login, logout and server-side revoked-token replay`. The native SecureStore wrapper has no test (it is excluded from coverage in `jest.config.js`). |
| AC2: a Career Professional is routed to the Career Professional area, not the Job Seeker home | **Met.** The user lands on `/counsellor`. | `login.test.tsx` "[QA-100] a counsellor login without a booking opens the workspace"; `AuthContext.http.test.tsx` "[QA-100] preserves the role returned by a counsellor login"; Playwright `[QA-106][US08-AC3] …` (URL is `/counsellor` after Maya logs in); iOS and Android Maya login observed on 16 September ([native results](../qa/native-device-results-20260916.md), earlier build) |
| AC3: a seeded Platform Owner is routed to a Platform Owner area | **Met in code; lightly tested.** The user lands on `/admin`. | `navigation.test.ts` "a Platform Owner opens on the dashboard, not the marketplace" (`homeFor` only); `navigation.test.tsx` "[QA-100] an existing %s session opens its signed-in destination" (a restored session, not the login screen). No login-screen or Playwright test. |
| AC4: a Job Seeker token calling a counsellor-only or Platform-Owner-only endpoint is rejected by the backend | Backend only. The frontend guards above are for navigation, not security. | [Backend doc](../backend/us06-us08-auth-sessions.md) ("Authorization reads the current database role"); `backend/tests/test_login_sessions.py` |
| AC5: while the request is in flight, or if the backend is unreachable, the app shows loading and does not navigate | **Met.** | `login.test.tsx` "[QA-100] submitting twice while authentication is pending sends one request"; "[QA-103] offline failure retains the entered email and offers another submit" |

## Tests

| File | Covers |
|---|---|
| [`__tests__/screens/login.test.tsx`](../../../frontend/__tests__/screens/login.test.tsx) | Local check, destinations, booking continuation, busy state, offline (9 tests) |
| [`__tests__/auth/AuthContext.test.tsx`](../../../frontend/__tests__/auth/AuthContext.test.tsx), [`AuthContext.http.test.tsx`](../../../frontend/__tests__/auth/AuthContext.http.test.tsx) | Session state, writes to the store, restore rules |
| [`__tests__/auth/sessionStore.web.test.ts`](../../../frontend/__tests__/auth/sessionStore.web.test.ts), [`refreshOn401.test.ts`](../../../frontend/__tests__/auth/refreshOn401.test.ts), [`authBridge.test.ts`](../../../frontend/__tests__/auth/authBridge.test.ts) | Web storage, refresh-and-retry, single-flight refresh |
| [`__tests__/navigation.test.ts`](../../../frontend/__tests__/navigation.test.ts), [`__tests__/screens/navigation.test.tsx`](../../../frontend/__tests__/screens/navigation.test.tsx) | `homeFor` and entry redirects for all three roles |
| [`__tests__/api/client.test.ts`](../../../frontend/__tests__/api/client.test.ts) | "login sends the documented method, URL, headers and body" |
| [`e2e/web.spec.ts`](../../../frontend/e2e/web.spec.ts) | `US06/08 Web login, logout …`; `[QA-106][US08-AC3] …` |

```bash
# from frontend/
npm test -- __tests__/screens/login.test.tsx __tests__/auth __tests__/navigation.test.ts __tests__/screens/navigation.test.tsx
```

On 18 September 2026 at `dev` `64cb324` these suites passed (8 suites, 63 tests).
[`e2e/native/counsellor-login-logout.yaml`](../../../frontend/e2e/native/counsellor-login-logout.yaml)
is marked "Authored only"; it has never been run.

## Known gaps

- **No Forum.** The Job Seeker tabs are Home, Explore and Bookings.
- Platform Owner login has no screen-level or browser test.
- Secure storage is not certified on a device. QA
  [#100](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/100) and the 16 September
  [QA matrix](../qa/qa-matrix.md) say native secure storage and the admin destination are absent, and the
  [archived tests README](../../../frontend/__tests__/planned/README.md) describes an in-memory session.
  Those records predate `70232ce`, which added the session store and `/admin`. The device runs used
  product baseline `0ffa565`. None of this has been re-verified on a device.
- On the web the token is kept in `localStorage`, not secure storage.
- Native network and startup recovery on login (N09 in the [native acceptance plan](../qa/native-acceptance-delta.md))
  is "not run" on both platforms.
- Routing a first-time Career Professional to onboarding (US-05) is not part of this slice.
