# US-02 frontend: Registration success, processing and errors

Issue: [#92](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/92),
under [US-02 #5](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/5).

This slice covers what the registration screen does once the request is sent: a processing state while
it waits, a success panel that leads to login without signing the user in, and an error state that
never claims success. The form and its on-device checks are in [US-01](us01-job-seeker-registration.md).
The duplicate-email case is in [US-03](us03-duplicate-email.md). Account creation, password hashing and
server-side validation are backend work, covered in the
[US-02 backend doc](../backend/us02-account-creation.md).

## Screens and flow

The only screen is `/auth/register` ([register.tsx](../../../frontend/app/auth/register.tsx)).

1. The user taps **Create account**. If the US-01 checks pass, `api.register` is called and the button
   shows its busy state.
2. **On success** the role cards, fields and button are replaced by a success panel: a check mark, the
   text "Your account is ready" and a **Continue to log in** button. The "Already registered? **Log in**"
   row stays below it.
3. **Continue to log in** calls `router.replace` with `/auth/login` and the parameters `role`, `serviceId`
   (if present) and `email` (the trimmed address). The login screen prefills its Email field from `email`
   ([login.tsx](../../../frontend/app/auth/login.tsx)). Because this is `replace`, going back does not
   return to the completed form.
4. **On failure** the form stays as it was, with a message in the error banner above it.

The app does not move to login by itself after success. The user has to tap **Continue to log in**.

## Behaviour and states

| State | What the user sees | What the app does not do |
|---|---|---|
| Waiting | **Create account** disabled with a spinner, `accessibilityState.busy = true` | No success panel, no navigation, no second request |
| Success (any 2xx; the client resolves with the returned `User`) | "Your account is ready" and **Continue to log in** | No call to `POST /auth/sessions`, no change to `AuthProvider`, nothing written to the session store |
| Server rejection (`ApiError`) | The server's `message`, word for word | No success panel, no navigation; all inputs and the role kept; button enabled again |
| Server rejection with an empty `message` | `Something went wrong. Please try again.` | As above |
| Error response that is not JSON | `The service returned an unexpected response.` (fallback in `request()`) | As above |
| Network failure (`TypeError`) | `We could not reach Yoir. Check your connection and try again.` | As above |

Messages come from `userFacingError` in [client.ts](../../../frontend/src/api/client.ts). The screen does
not read the response's `fieldErrors`, so server field errors never reach individual fields. The
`fieldErrors()` helper exists in the client, but this screen does not use it. Examples of messages the
real backend sends ([errors.py](../../../backend/app/errors.py),
[auth.py](../../../backend/app/routers/auth.py)):

- A malformed email passes the device checks and fails server validation, which returns 400 with
  `The request could not be validated.` That generic sentence is what the user sees.
- A confirmation mismatch would return `Passwords do not match.`, but the device check catches it first.

The banner is cleared only when the next submission passes the device checks. Editing a field does not
clear it.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.register(input)` | `POST /auth/users` | `201` returns public user fields and no token ([backend](../backend/us01-registration.md)). A `400` or `409` returns `{ code, message, fieldErrors, requestId }`. The screen uses only `message`. |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| AC1: valid data creates a Job Seeker account whose stored credential is a password hash only | Backend only. The frontend sends the password over the API and does not store it. | [US-02 backend doc](../backend/us02-account-creation.md); `backend/tests/test_account_creation.py` (QA [#94](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/94)) |
| AC2: after the backend confirms, the app shows an English success message and navigates to login without creating a session or storing a token | **Met, with one difference.** The app shows "Your account is ready" and creates no session. Navigation to `/auth/login` happens when the user taps **Continue to log in**, not automatically. | `register.test.tsx` "[QA-87/91] registers %s and retains the booking on the login continuation" (checks "signed out", no `POST /auth/sessions`, and `replace` to `/auth/login` with `email`); Playwright `US01/04 Web registration persists ${role}` (login screen shows the prefilled email) |
| AC3: while waiting, or after a network or server error, the app shows a processing or error state and neither shows success nor navigates | **Met.** | `register.test.tsx` "[QA-87] double submit during registration sends a single request"; "[QA-94] a network failure preserves inputs without success, login or authentication"; "[QA-94] backend %s rejection remains anonymous and does not claim success" (400 and 500) |
| AC4: the backend rejects a request that is missing a required field or has an unsupported role, whatever the device validates | Backend only. The UI can send only `job_seeker` or `counsellor`. If the backend rejects anyway, the error row above applies. | [US-01 backend doc](../backend/us01-registration.md); `backend/tests/test_registration_contract.py` |

## Tests

- [`__tests__/screens/register.test.tsx`](../../../frontend/__tests__/screens/register.test.tsx) covers
  success, network failure, 400 and 500 rejections, and double submit. These tests mock `fetch` but go
  through the real client and `AuthProvider`. `AuthStatusProbe` shows the provider is still signed out.
- [`__tests__/api/client.test.ts`](../../../frontend/__tests__/api/client.test.ts): "maps API, generic
  and unknown failures to safe user-facing messages" and "uses a deterministic fallback when an error
  response is not JSON".
- [`e2e/web.spec.ts`](../../../frontend/e2e/web.spec.ts): `US01/04 Web registration persists ${role}`
  registers through the browser and then logs in through the API to confirm the account exists.

```bash
# from frontend/
npm test -- __tests__/screens/register.test.tsx __tests__/api/client.test.ts
```

Both suites passed on 18 September 2026 at `dev` `64cb324` (15 and 15 tests).

## Known gaps

- Navigation to login needs a tap. If the parent's "navigates to the login screen" means automatic
  navigation, AC2 is not met as written.
- Server `fieldErrors` are ignored. A malformed email produces the generic
  `The request could not be validated.` rather than a field-specific message.
- Registration has not been recorded on either platform. Native case N01 in the
  [native acceptance plan](../qa/native-acceptance-delta.md) is not run on iOS or Android, and the
  success-to-login recordings listed in the parent issue do not exist.
- The backend also creates and emails an address-confirmation link on registration
  ([auth.py](../../../backend/app/routers/auth.py)). The success panel does not mention it. Email
  confirmation is out of US-02's scope.
