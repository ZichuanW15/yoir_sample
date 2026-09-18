# US-01 frontend: Job Seeker registration form

Issue: [#85](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/85),
under [US-01 #4](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/4).

A signed-out visitor can open a public registration screen with name, email, password, password
confirmation and a role selector, and the app checks the form on the device before sending anything.
The screen is shared by four stories. What happens once the server answers is covered in
[US-02](us02-registration-outcome.md), the duplicate-email error in [US-03](us03-duplicate-email.md)
and the Career Professional option in [US-04](us04-career-professional-registration.md). The request
contract is in the [US-01 backend doc](../backend/us01-registration.md).

## Screens and flow

| Route | File | Role in this slice |
|---|---|---|
| `/` | [index.tsx](../../../frontend/app/index.tsx) | Entry: **I am a Job Seeker** / **I am a Career Professional** cards, guest browsing, "Already have an account? Log in" |
| `/auth/welcome?role=…` | [welcome.tsx](../../../frontend/app/auth/welcome.tsx) | Role welcome: **Log in**, **Create an account** and, for Job Seekers only, **Continue as a guest** |
| `/auth/register?role=…&serviceId=…` | [register.tsx](../../../frontend/app/auth/register.tsx) | The registration form |
| `/auth/login` | [login.tsx](../../../frontend/app/auth/login.tsx) | Its "New to Yoir? **Create an account**" link also opens the form, passing `role` and `serviceId` on |

The main path is Entry → **I am a Job Seeker** → `/auth/welcome?role=job_seeker` → **Create an
account** → `/auth/register?role=job_seeker`. No screen on this path checks for a session, so the
visitor is never asked to sign in. The root stack in [_layout.tsx](../../../frontend/app/_layout.tsx)
opens `auth/register` with a slide-from-bottom animation.

From top to bottom the form shows: a **Close** button (`goBack('/auth/welcome')`), the heading "Create
your account", an error banner when there is one, the **Account role** group, the four fields, the
**Create account** button, and "Already registered? **Log in**". That link replaces the screen with
`/auth/login`, carrying `role` and any `serviceId`.

The role group has two radio cards:

| Card | Value sent | Description shown |
|---|---|---|
| Job Seeker | `job_seeker` | "Browse Career Professionals, book a session and pay through Yoir." |
| Career Professional | `counsellor` | "Publish services, set your availability and take bookings." |

Career Professional is preselected only when the route parameter is `role=counsellor`. Any other value,
or none, preselects Job Seeker. `serviceId` is set when a guest started booking a service before
logging in. Registration does not use it; it only passes it on to the login screen.

## Behaviour and states

`submit()` runs three checks in order and stops at the first one that fails. Each failure shows a
single message in the form-level `ErrorBanner` ([ui.tsx](../../../frontend/src/components/ui.tsx),
`accessibilityRole="alert"`) and sends no request:

| Check | Message |
|---|---|
| Trimmed name or trimmed email is empty, or password or confirmation is empty | `Complete all required fields.` |
| Password is shorter than 8 characters | `Password must be at least 8 characters.` |
| Password and confirmation differ | `Passwords do not match.` |

- **Email format is not checked on the device.** A malformed address is sent, and the server's 400
  message is shown instead (see [US-02](us02-registration-outcome.md)).
- Messages are not attached to fields. Individual fields have no error styling or accessibility hint.
- Name and email are trimmed before sending. Password and confirmation are sent exactly as typed.
- The email input uses `keyboardType="email-address"`, `autoCapitalize="none"` and
  `autoComplete="email"`. Both password inputs use `secureTextEntry` and `autoComplete="new-password"`.
- **Processing:** once the checks pass, the banner clears and `busy` is set. The **Create account**
  button is disabled and shows a spinner, with `accessibilityState` `{ disabled: true, busy: true }`.
  Its label does not change. Tapping it again sends nothing.

Accessibility labels the tests rely on: the inputs `Full name`, `Email`, `Password` and
`Confirm password` (from `Field`'s `accessibilityLabel`); the radios `Job Seeker` and
`Career Professional` (`accessibilityRole="radio"`, with `checked` and `selected` state); the buttons
`Create account`, `Close` and `Log in`; and the banner's `alert` role.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.register({ name, email, password, passwordConfirmation, role })` in [client.ts](../../../frontend/src/api/client.ts) | `POST /auth/users` | Public, with no bearer token. `RegisterRequest` in [types.ts](../../../frontend/src/api/types.ts) allows only `job_seeker` or `counsellor` as `role`. The body includes `passwordConfirmation`. The parent story's scope line leaves it out, but the [backend contract](../backend/us01-registration.md) requires it. |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| AC1: a signed-out visitor who taps Register from the entry or login screen sees name, email, password, confirmation and a role selector with Job Seeker, without authenticating | **Met.** Entry → welcome → **Create an account**, or login → **Create an account**. The form has the four inputs and Job Seeker is preselected. | `navigation.test.tsx` "[QA-87/91] %s opens its role welcome"; `welcome.test.tsx` "[QA-87/91] job seekers can choose registration, login or anonymous browsing"; `login.test.tsx` "[QA-87] switching to registration preserves the booking and selected role"; `register.test.tsx` "[QA-87/91] registers %s and retains the booking on the login continuation" (asserts the radio is checked); Playwright `US01/04 Web registration persists ${role}` |
| AC2: an empty required field or an invalid email format keeps the user on the screen, marks each offending field with an English message and sends no request | **Partly met.** An empty field shows one form-level banner and sends nothing. The offending field is not marked. Invalid email format is not checked on the device, so the request is sent. | `register.test.tsx` "[QA-87][characterization] rejects empty %s with the current form-level banner" (4 cases). The per-field and email-format probes in [`planned/auth-issue-acceptance.test.tsx`](../../../frontend/__tests__/planned/auth-issue-acceptance.test.tsx) are archived and not run. QA [#87](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/87) records AC2/3 as not certified. |
| AC3: a mismatched confirmation shows an error on the confirmation field and sends no request | **Partly met.** Shows `Passwords do not match.` in the form-level banner and sends nothing. The message is not attached to the confirmation field. | `register.test.tsx` "[QA-87][characterization] rejects mismatched passwords with the current form-level banner"; archived probe "[QA-87][US01-AC3] a mismatch is associated with password confirmation and sends no request" (not run) |
| AC4: a complete form with Job Seeker selected sends name, email, password and the Job Seeker role, and shows a processing state until the backend responds | **Met.** Sends `{ name, email, password, passwordConfirmation, role: "job_seeker" }`. The button stays busy until the request settles. | `register.test.tsx` "[QA-87/91] registers %s and retains the booking on the login continuation" (exact body); "[QA-87] double submit during registration sends a single request"; `client.test.ts` "register serialises the complete registration request" |

## Tests

| File | Covers |
|---|---|
| [`__tests__/screens/register.test.tsx`](../../../frontend/__tests__/screens/register.test.tsx) | Required fields, 8-character rule, mismatch, request body, busy state (15 tests) |
| [`__tests__/screens/welcome.test.tsx`](../../../frontend/__tests__/screens/welcome.test.tsx), [`__tests__/screens/navigation.test.tsx`](../../../frontend/__tests__/screens/navigation.test.tsx) | Reaching the form from the entry and welcome screens |
| [`__tests__/api/client.test.ts`](../../../frontend/__tests__/api/client.test.ts) | `api.register` method, URL, headers and body |
| [`e2e/web.spec.ts`](../../../frontend/e2e/web.spec.ts) | `US01/04 Web registration persists ${role}`: real Chromium form against the real API |

From `frontend/`:

```bash
npm test -- __tests__/screens/register.test.tsx __tests__/screens/welcome.test.tsx __tests__/screens/navigation.test.tsx
npm run test:planned   # archived per-field/email-format probes; expected to fail
```

On 18 September 2026 at `dev` `64cb324`, the three Jest suites above passed (24 tests). The Playwright
run needs a web export and the backend (see [e2e/README.md](../../../frontend/e2e/README.md)). The most
recent recorded Chromium result is 15 passed, in the
[18 September review](../qa/dev-sync-review-20260918.md). That run used `dev` at `776899c`, before the
latest frontend commits, and was not repeated for this document.

## Known gaps

- AC2 and AC3 are not fully met: there is no per-field error association and no on-device email-format
  check. QA [#87](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/87) lists both
  as deferred.
- The 8-character password minimum matches the backend. The parent story's open decision on password
  strength is not recorded as settled anywhere in the QA docs.
- Registration has not been run on either platform. Native case N01 in the
  [native acceptance plan](../qa/native-acceptance-delta.md) is "not run" for iOS and Android. The
  screenshots listed in the parent issue's Evidence section have not been recorded.
