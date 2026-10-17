# US-70 frontend: password reset, tested at the screen

Issues: front-end sub-issue [#226](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/226),
under [US-70 #12](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/12).

The forgot-password and set-new-password screens were built in Sprint 2 and are documented in
[US-70 (Sprint 2)](../../sprint2/frontend/us70-email-verification-and-password-recovery.md), which
described their existing behaviour. Sprint 3 adds screen-level tests, two back-end tests, and a
back-end change so that asking for a reset link takes about the same time whether or not the address
has an account. It reached `dev` on 8 October 2026 in commit `4a67bcd`, pushed directly rather than
through a pull request.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screen 10.
Controlled mail composition and reset-token execution are recorded in the QA report.

## Screens and flow

| Route | File | Change in Sprint 3 |
|---|---|---|
| `/auth/forgot` | [`app/auth/forgot.tsx`](../../../frontend/app/auth/forgot.tsx) | None; now covered by a screen test. |
| `/auth/reset?token=…` | [`app/auth/reset.tsx`](../../../frontend/app/auth/reset.tsx) | None; now covered by a screen test. |

Flow, unchanged: "Forgot your password?" on the login screen opens `/auth/forgot`, prefilled with any
email already typed. The emailed link opens `/auth/reset?token=…` on the web build. A saved password
goes back to `/auth/login`; the reset does not sign anyone in.

## Behaviour and states

As in the Sprint 2 document. What the new tests now hold the screens to:

### Forgot password

- An empty field shows "Enter the email you signed up with." and sends nothing.
- While sending, the button reads "Sending" and is disabled, so a second press sends no second
  request.
- After the back end accepts, "Check your inbox" and "If <email> has a Yoir account, a reset link is
  on its way. It works once and lasts two hours." The screen is the same for a registered and an
  unregistered address, because it has no branch on what the back end knows.
- A rejected request shows the back end's message, for example "That email looks invalid.", and no
  confirmation. With no connection: "We could not reach Yoir. Check your connection and try again.",
  and the button works again.
- "Back to sign in" replaces the route with `/auth/login`. The close button goes back.

### Choose a new password

- With no token in the link, "That link is missing its reset code. Ask for a new one." and nothing is
  sent.
- Passwords that differ show "The passwords do not match." and, under the confirmation, "Does not match
  the new password." Nothing is sent.
- While saving, the button reads "Saving" and is disabled. The screen does not move to login until the
  back end confirms, and a second press sends nothing.
- An expired, used or altered token shows the back end's message, such as "This reset link is no
  longer valid. Ask for a new one.", and stays on the form.
- With no connection, the same connection message, no navigation, and "Save new password" works again.
- On success: the toast "Your password has been changed" and `/auth/login`.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.requestPasswordReset(email)` | `POST /auth/password-reset-requests` | Body `{ email }`. `202` with no body for any address. |
| `api.resetPassword(token, password, passwordConfirmation)` | `POST /auth/password-resets` | `204` on success; `400 VALIDATION_ERROR` for a bad token or a mismatch. |

Back-end change in the same commit: for a registered address, the reset email is now sent as a
background task after the response, instead of before it. Previously a registered address waited for
the mail provider and an unknown one returned at once, so the response time could reveal who has an
account. The OpenAPI entries for both email-request bodies also gained `additionalProperties: false`,
matching what the back end already enforced.

## Executed acceptance coverage

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| Registered email: the back end creates a token and sends a link; the app shows a generic confirmation | "Check your inbox" only after `202` | `forgot.test.tsx` "AT-US-70-1: a registered email shows the generic confirmation after the backend accepts it"; back end `test_link_requests_do_not_reveal_who_has_an_account`; walkthrough 10 |
| Unregistered email: identical confirmation, and a response that cannot be told apart | Same screen and text | `forgot.test.tsx` "AT-US-70-2: an unregistered email produces the identical confirmation…"; back end `test_link_requests_do_not_reveal_who_has_an_account` and the background send |
| Valid link and matching password: hash replaced, success shown, login opened, old password refused | Login only after `204` | `reset.test.tsx` "AT-US-70-3: a valid token with matching passwords succeeds only once the backend confirms, then goes to login"; back end `test_reset_changes_the_password_and_ends_every_other_session`, `test_after_a_reset_the_old_password_no_longer_authenticates` (new) |
| Expired, used or altered token: rejected, password unchanged, error shown | The back end's message; no navigation | `reset.test.tsx` "AT-US-70-4: an expired, used or altered token is rejected…"; back end `test_a_reset_link_works_exactly_once`, `test_an_expired_reset_link_is_refused`, `test_a_tampered_or_never_issued_token_is_refused` (new) |
| In flight or failed: a processing or error state, never success or login | "Saving", disabled; errors keep the form | `reset.test.tsx` "AC6: while the request is in flight the screen is busy…", "AC6: a network failure shows an error and does not navigate to login" |

## Tests

- [`__tests__/screens/forgot.test.tsx`](../../../frontend/__tests__/screens/forgot.test.tsx), 9 tests,
  new: AT-US-70-1 and 2, the empty field, server and offline failures, the busy button, the prefilled
  email, closing, and "Back to sign in".
- [`__tests__/screens/reset.test.tsx`](../../../frontend/__tests__/screens/reset.test.tsx), 6 tests,
  in the original dev suite: AT-US-70-3 and 4, a mismatch, a missing token, in flight, and offline.
  The refresh adds a seventh case for a backend password-field error followed by a corrected retry.
- Back end, [`tests/test_verification.py`](../../../backend/tests/test_verification.py), 2 new tests:
  `test_a_tampered_or_never_issued_token_is_refused` and
  `test_after_a_reset_the_old_password_no_longer_authenticates`.
- The client-level tests in `verification-admin-client.test.ts` from Sprint 2 still pin both
  requests.

Run from `frontend/`: `npx jest __tests__/screens/forgot.test.tsx __tests__/screens/reset.test.tsx`.
**Original dev-only execution:** `0df4068`, 17 October 2026, Node 22.14.0: 15 passed (9 and 6).

The refresh strengthens the [forgot-password offline case](../../../frontend/__tests__/screens/forgot.test.tsx)
to retry the same address and wait for the recovered acknowledgement before
showing the generic confirmation. The [reset tests](../../../frontend/__tests__/screens/reset.test.tsx)
now assert success-toast timing and add a case for the eight-character backend
field error: correcting the value clears the error, retains the token, and
navigates only after the successful response. These checks passed in the focused
execution recorded by the refresh report.

## QA branch evidence

The preceding dev-only counts identify the original source-document execution.
The `sprint3-qa` overlay adds executed API, component and browser coverage. Its
[17 October report](../qa/test-results-final-20261017.md) records the tested
`0df4068` product, and the [dev refresh report](../qa/test-results-dev-refresh-20261017.md)
records reconciliation with `972caee`. That dev update adds documentation; product
code is unchanged. Suite counts belong to their dated executions and are not added
together. The [latest meeting-area report](../qa/test-results-meeting-area-20261017.md)
records the subsequent `9cce973` baseline from PR #244, including the backend
snapshot change and the confirmation-screen finding. Frontend regression results
are retained from the 06:33 UTC execution; the new advisory has its own record.
The [QA matrix](../qa/qa-matrix.md) links these results to the QA tasks.

## Recorded behaviour and findings

- **Timing:** only the email is deferred. For a registered address the token is still created and
  written before the response, so a smaller difference in response time remains. The back end's
  in-process test client waits for background tasks; the recorded tests establish equal response bodies
  and token lifecycle behaviour.
- Links still open the web build at `APP_WEB_URL`, not the installed app.
- The "two hours" lifetime is still fixed in the copy.
- **Evidence boundary:** automated tests exercise the real token/password lifecycle with controlled
  mail rendering and delivery seams. Wilson's [supplementary password-reset confirmation](../qa/device-acceptance.md#supplementary-tester-confirmations)
  is attributed separately from the captured automated executions.
