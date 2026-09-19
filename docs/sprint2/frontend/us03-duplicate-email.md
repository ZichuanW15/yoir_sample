# US-03 frontend: Duplicate-email error that keeps the form

Issue: [#95](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/95),
under [US-03 #6](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/6).

When the backend rejects a registration because the email is already registered, the user stays on the
registration screen with everything they entered and sees a form-level English message. They can change
the email and submit again from the same screen. Uniqueness and the single-account guarantee are backend
work ([US-03 backend doc](../backend/us03-duplicate-email.md)). After a corrected retry succeeds, the
screen behaves as described in [US-02](us02-registration-outcome.md).

## Screens and flow

The only screen is `/auth/register` ([register.tsx](../../../frontend/app/auth/register.tsx)). The form
itself is described in [US-01](us01-job-seeker-registration.md).

1. The user submits an email that is already registered.
2. The backend returns `409` with `code: "VALIDATION_ERROR"`, the message
   `An account with this email already exists.` and `fieldErrors.email: "Already registered."`
   ([auth.py](../../../backend/app/routers/auth.py), `_duplicate_email_error`).
3. The screen shows that message in the error banner above the form (`accessibilityRole="alert"`). The
   form stays mounted, with nothing cleared and no navigation.
4. The user edits the email and taps **Create account** again. If the device checks pass, the banner
   clears when the new request starts. A `201` shows the US-02 success panel.

## Behaviour and states

- The screen does not look at the status or `code`. A duplicate email goes through the same `catch` as
  any other rejection, and the user sees `userFacingError(value)`, which is the server's `message`. The
  message text is the only thing that tells a duplicate email apart from other errors. The code comment
  in `submit()` says so: "a rejected registration (a duplicate email, say) stays on the form with its
  reason".
- Everything is kept: name, email, password, confirmation and the selected role are React state, and
  none of it is reset on failure. Values are kept as typed, including surrounding spaces. Trimming happens
  only in the request body.
- The server's `fieldErrors.email` is not shown next to the Email field, and the field is not styled as
  invalid. The parent story asks for a form-level error, and the screen provides one.
- The banner stays while the user edits. It clears only when the next submission passes the device checks.
- Email case: the app sends the email with its original capitalisation. The backend lowercases it
  before checking uniqueness ([backend doc](../backend/us01-registration.md)).

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.register(input)` | `POST /auth/users` | `409 VALIDATION_ERROR` for a duplicate, including concurrent registrations. Only `message` is displayed. |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| AC1: registering with an existing email is rejected, and exactly one account with that email remains | Backend only. The frontend sends one request per valid submission; the button is disabled while busy. | [US-03 backend doc](../backend/us03-duplicate-email.md); `backend/tests/test_duplicate_email.py` (QA [#97](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/97)); `register.test.tsx` "[QA-87] double submit during registration sends a single request" |
| AC2: after the duplicate rejection, the user stays on the registration screen with their values kept and sees a clear English form-level error that the email is already registered | **Met.** With the real backend the banner reads `An account with this email already exists.` | `register.test.tsx` "[QA-97/91] duplicate email for %s retains every field and succeeds after correction" (checks all four inputs, the role and no navigation). Its mock returns a different code and message from the real backend (see Tests). Playwright `US03 duplicate registration remains on the form with input preserved` runs against the real backend: status 409, an `alert` visible, the email kept, no success text. |
| AC3: after changing to an unused email and resubmitting, the account is created and the app behaves as in US-02 | **Met.** | Same Jest test: a second `POST /auth/users` with the new email, "Your account is ready", then **Continue to log in** replaces to `/auth/login` with the new email. The Playwright spec does not do the corrected retry. |

## Tests

- [`__tests__/screens/register.test.tsx`](../../../frontend/__tests__/screens/register.test.tsx),
  "[QA-97/91] duplicate email for %s retains every field and succeeds after correction", runs once for
  `job_seeker` and once for `counsellor`. The mocked 409 uses `code: "EMAIL_ALREADY_REGISTERED"` and the
  message "An account already exists for this email address.", which is not what the backend sends. The
  screen displays whatever `message` arrives, so the path is still exercised, but the asserted wording is
  not the real one.
- [`e2e/web.spec.ts`](../../../frontend/e2e/web.spec.ts), `US03 duplicate registration remains on the
  form with input preserved`, creates the account through the API, then registers the same email in
  Chromium. It checks the 409, the alert and that the email is kept. It does not check the message text.

```bash
# from frontend/
npm test -- __tests__/screens/register.test.tsx
npm run test:web -- -g "US03 duplicate"   # needs the web export and backend, see e2e/README.md
```

The Jest suite passed on 18 September 2026 at `dev` `64cb324` (15 tests). The Playwright test was not
rerun for this document.

## Known gaps

- No frontend test asserts the real duplicate message, `An account with this email already exists.`
- The server's `fieldErrors.email` ("Already registered.") is discarded.
- Not run on a device: native case N01 (duplicate-email recovery) is "not run" on iOS and Android in the
  [native acceptance plan](../qa/native-acceptance-delta.md). The duplicate-error screenshots listed in the
  parent issue do not exist.
