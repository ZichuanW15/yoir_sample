# US-07 frontend: Generic failed-login message, nothing stored

Issue: [#101](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/101),
under [US-07 #10](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/10).

When a login fails, the user stays on the login screen and sees a fixed message that does not say which
credential was wrong. No session is created or stored, and a corrected attempt works straight away. This
is the failure path of the login screen described in [US-06](us06-login-role-navigation.md). The backend
returns the same generic `401 INVALID_CREDENTIALS` for a wrong password and for an unknown email
([backend doc](../backend/us06-us08-auth-sessions.md)).

## Screens and flow

The only screen is `/auth/login` ([login.tsx](../../../frontend/app/auth/login.tsx)).

1. The user enters an email and password and taps **Log in**. The button shows `Logging in` while waiting.
2. The request fails. `submit()` catches the error and sets `userFacingError(value)` as the banner text.
   The code comment reads "US-07: whatever failed, the message never says which credential was wrong."
3. The screen stays where it is. The email and password inputs keep their values, and **Log in** is
   enabled again.
4. The next valid submission clears the banner. On success the app routes as in US-06.

## Behaviour and states

| Failure | Message in the banner (`accessibilityRole="alert"`) |
|---|---|
| `401` with `code: "INVALID_CREDENTIALS"` (wrong password or unknown email) | `The email or password is incorrect.` |
| Email or password empty (checked on the device, no request) | `Enter your email and password.` |
| Other `ApiError`, such as a `400` for a malformed email | The server's `message`, for example `The request could not be validated.` |
| Network failure (`TypeError`) | `We could not reach Yoir. Check your connection and try again.` |

- **The message does not depend on server wording.** `userFacingError` in
  [client.ts](../../../frontend/src/api/client.ts) returns a fixed string whenever the code is
  `INVALID_CREDENTIALS`, and ignores the server's `message`. Since the backend sends the same code for both
  cases, the app shows identical text for a wrong password and an unknown email.
- **Nothing is stored.** `AuthContext.login` ([AuthContext.tsx](../../../frontend/src/auth/AuthContext.tsx))
  awaits `api.login` first. Only after it resolves does it call `setSession` and `writeSession`, so a
  rejection skips both. `request()` never tries a token refresh on `/auth/` paths, so a failed login
  cannot be turned into a session that way either.
- **Protected screens stay closed.** With no session, the guards listed in
  [US-06](us06-login-role-navigation.md) redirect away from `/counsellor/*`, `/admin/*`, `/bookings` and
  the Job Seeker profile and diagnosis screens.
- The app has no lockout, no attempt counter and no delay. The parent story defers rate limiting.
- The password field is not cleared after a failure.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.login(email, password)` | `POST /auth/sessions` | Failure: `401 { code: "INVALID_CREDENTIALS", message, requestId }` with no `fieldErrors` ([backend](../backend/us06-us08-auth-sessions.md)). |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| AC1: a registered email with a wrong password gets no token and a generic English message that does not say which field is wrong | **Met.** The banner shows `The email or password is incorrect.` and the session stays null. | `login.test.tsx` "[QA-103] invalid credentials show the generic safe message and allow retry" (the mocked server message "Do not expose account existence" is not shown); `AuthContext.http.test.tsx` "[QA-103] an invalid login rejects without authenticating the provider"; Android on 16 September: wrong password rejected with the incorrect email or password message ([native results](../qa/native-device-results-20260916.md), earlier build) |
| AC2: an unknown email gives an app message and backend response that cannot be told apart from the wrong-password case | **Met in the frontend by design**, because the text is chosen by `code`. The two responses being identical is a backend property. | Backend parity: `backend/tests/test_login_sessions.py` (QA [#103](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/103)). Playwright `US07 invalid login stays anonymous and can retry` uses an unregistered email against the real API and checks for an `alert`, but not its text. No frontend test compares the two cases side by side. |
| AC3: after a failure the user is still on the login screen, no token is in secure storage and no authenticated screen can be reached | **Met in code.** | `login.test.tsx` "[QA-103] invalid credentials…" (no navigation, provider "signed out"); `AuthContext.test.tsx` "a failed login leaves the local session signed out"; `refreshOn401.test.ts` "a failing login does not try to refresh its way in"; Playwright `US07 invalid login…` (URL stays `/auth/login`, four `/counsellor` deep links refused, `GET /me/services` is 401). No test asserts that `writeSession` is not called, and the device keystore has not been inspected. |
| AC4: entering correct credentials afterwards authenticates and routes as in US-06 | **Met.** | `login.test.tsx` "[QA-103] invalid credentials…" (the second attempt replaces to `/job-seeker`, "signed in as Alex Morgan"); Playwright `US07 invalid login…` (corrected login, then **Skip for now** on the diagnosis, then `Account, Web QA` visible); Android on 16 September: corrected password succeeded |

## Tests

| File | Covers |
|---|---|
| [`__tests__/screens/login.test.tsx`](../../../frontend/__tests__/screens/login.test.tsx) | Generic message, retry, empty fields, offline |
| [`__tests__/auth/AuthContext.test.tsx`](../../../frontend/__tests__/auth/AuthContext.test.tsx), [`AuthContext.http.test.tsx`](../../../frontend/__tests__/auth/AuthContext.http.test.tsx) | Failed login leaves the provider signed out (401 and transport error) |
| [`__tests__/auth/refreshOn401.test.ts`](../../../frontend/__tests__/auth/refreshOn401.test.ts) | Login 401 is not refreshed |
| [`e2e/web.spec.ts`](../../../frontend/e2e/web.spec.ts) | `US07 invalid login stays anonymous and can retry` |

```bash
# from frontend/
npm test -- __tests__/screens/login.test.tsx __tests__/auth/AuthContext.test.tsx __tests__/auth/AuthContext.http.test.tsx __tests__/auth/refreshOn401.test.ts
```

These suites passed on 18 September 2026 at `dev` `64cb324` (41 tests). The Playwright case was not
rerun for this document.

## Known gaps

- Native case N02 in the [native acceptance plan](../qa/native-acceptance-delta.md) is incomplete. On iOS,
  wrong password, unknown email and corrected retry are all "not run". On Android, the unknown-email
  comparison is "not run". The generic-error screenshots listed in the parent issue do not exist.
- No test asserts the exact generic text against the real backend, or compares unknown email with wrong
  password in the UI.
- Response timing between the two cases is not addressed in the frontend (the backend doc describes its
  partial mitigation).
- A malformed email gets the server's validation message rather than the generic credential message. This
  reveals nothing about whether an account exists.
