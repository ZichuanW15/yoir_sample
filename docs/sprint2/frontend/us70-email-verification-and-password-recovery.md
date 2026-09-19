# US-70 frontend: email verification and password recovery

Issue: [US-70 #12](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/12). No
front-end sub-issue exists. Email verification has no backlog story: the Epic A client note asks the
team to recommend an approach and records that no extra authentication step has been approved. Its
backend operations are tagged `US-06`.

This slice lets a registered user ask for a password-reset link, choose a new password from it, and
confirm their email address from a link that also signs them in. A banner prompts an unconfirmed user
before the backend refuses them a booking or a service publication. It reached `dev` on 18 September
2026 in [PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157), built
during Sprint 2 alongside the committed stories. US-70 sits in the Product Backlog column, not
Sprint 2, and is not claimed as accepted.

## Screens and flow

| Route | File | What the user sees |
|---|---|---|
| `/auth/forgot` | [`app/auth/forgot.tsx`](../../../frontend/app/auth/forgot.tsx) | "Forgot your password?" and one Email field. |
| `/auth/reset?token=…` | [`app/auth/reset.tsx`](../../../frontend/app/auth/reset.tsx) | "Choose a new password" with New password and Confirm new password. |
| `/auth/verify?token=…` | [`app/auth/verify.tsx`](../../../frontend/app/auth/verify.tsx) | Confirms the address, then "You're confirmed". |
| (component) | [`src/components/VerifyEmailBanner.tsx`](../../../frontend/src/components/VerifyEmailBanner.tsx) | "Confirm your email to …" with a Resend action. |

Recovery: the login screen's "Forgot your password?" opens `/auth/forgot`, prefilled with any email
already typed. The emailed link is `<APP_WEB_URL>/auth/reset?token=…`, built by the backend in
`app/mail/messages.py` (`APP_WEB_URL` defaults to `http://localhost:8081`). Verification links use
`/auth/verify?token=…` the same way. `app.json` declares the `yoir` scheme but no universal or app
links, so these links open the web build, not the installed app.

The banner appears on Explore (`/marketplace`, "book a session") and on the Career Professional
workspace (`/counsellor`, "publish a service").

## Behaviour and states

- **Forgot:** an empty field shows "Enter the email you signed up with." with no request. Submitting
  shows "Sending" while busy, then "Check your inbox": "If <email> has a Yoir account, a reset link
  is on its way. It works once and lasts two hours." The screen cannot tell a registered address from
  an unknown one, because the backend answers `202` for both. A server error, such as an invalid
  email format, shows in the banner.
- **Reset:** with no token, submitting shows "That link is missing its reset code. Ask for a new
  one." A mismatch is caught in the app ("The passwords do not match." and "Does not match the new
  password." under the confirmation). There is no client-side length check; the backend's eight-
  character minimum returns as a field error. While saving, the button reads "Saving". On `204` the
  app shows the toast "Your password has been changed" and replaces the route with `/auth/login`; it
  does not sign the user in. On failure it stays on the form with the server message, such as "This
  reset link is no longer valid. Ask for a new one.", and field errors under the fields. A notice
  explains that the reset signs the user out on every device.
- **Verify:** with a token, the screen shows "Confirming your email…", posts the token once (a ref
  stops React Strict Mode sending it twice), adopts the returned session, and shows "You're confirmed"
  with a toast and "Browse Career Professionals" (to `/marketplace`). With no token or any failure it
  shows "That link has expired", the error banner, an Email field prefilled from any session, and
  "Send me a new link". After that request the screen says "If that address has an account, a new
  link is on its way." "Back to sign in" is always offered.
- **Banner:** hidden for guests and for sessions whose `user.emailVerified` is true. Resend shows a
  spinner, then "We have sent a new link to <email>. It lasts a day." whether or not the request
  succeeded; the component's comment explains that the endpoint answers the same either way.
- **Gate:** browsing and signing in stay open to an unconfirmed account. The backend refuses order
  creation and service publishing with `403 EMAIL_NOT_VERIFIED`. The time-slot screen and the
  service form show its message through `userFacingError`.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.requestPasswordReset(email)` | `POST /auth/password-reset-requests` | Public. `202` with an empty body for any address; the client resolves because it checks Content-Type before parsing. |
| `api.resetPassword(token, password, passwordConfirmation)` | `POST /auth/password-resets` | Public. `204` on success; `400 VALIDATION_ERROR` for a mismatch or an unknown, used or expired token. Revokes refresh tokens and retires issued access tokens. |
| `api.verifyEmail(token)` | `POST /auth/email-verifications` | Public, no bearer token. Returns a `Session`; `400` for an unknown, used or expired link. |
| `api.requestEmailVerification(email)` | `POST /auth/email-verification-requests` | Public. Always `202`; mails only an unconfirmed account. |

Tokens are single-use, stored as digests and scoped by purpose. Lifetimes come from backend settings:
`email_verification_ttl_hours` (24) and `password_reset_ttl_hours` (2).

## Acceptance criteria

| Criterion (story) | Frontend behaviour | Evidence |
|---|---|---|
| Registered email: reset token created, link sent, generic confirmation shown (US-70) | "Check your inbox" after `202` | `verification-admin-client.test.ts` "requestPasswordReset posts only the address"; backend `test_link_requests_do_not_reveal_who_has_an_account`. Delivered email and screen: Not covered |
| Unregistered email gets the identical confirmation and response (US-70) | Same screen and text; the app receives the same `202` | Backend `test_link_requests_do_not_reveal_who_has_an_account`. Screen: Not covered |
| Valid link and matching new password: hash replaced, success, login shown, old password fails (US-70) | Toast and `/auth/login` only after `204` | `verification-admin-client.test.ts` "resetting a password sends the link token with both copies of the new one"; backend `test_reset_changes_the_password_and_ends_every_other_session`. Screen: Not covered |
| Expired, used or altered token: rejected, password unchanged, error shown (US-70) | Server message in the banner; no navigation | Backend `test_a_reset_link_works_exactly_once`, `test_an_expired_reset_link_is_refused`, `test_a_reset_link_cannot_confirm_an_address`. Screen: Not covered |
| In-flight or failed submission shows processing or error, never success (US-70) | "Saving" busy button; success path only after the promise resolves | Not covered |

Email verification has no acceptance criteria of its own; its checks are listed under Tests.

## Tests

- [`__tests__/api/verification-admin-client.test.ts`](../../../frontend/__tests__/api/verification-admin-client.test.ts),
  "confirming an address and recovering an account": five cases pin the four URLs and bodies, check
  that `verifyEmail` sends no bearer token, and check that the bodiless `202` resolves rather than
  failing to parse.
- [`__tests__/integration/live-client.test.ts`](../../../frontend/__tests__/integration/live-client.test.ts),
  "registers, authenticates, discovers a slot, creates an order and completes stub payment", expects a
  freshly registered user's order to fail with `403`. It runs only with `LIVE_API_BASE_URL` and was
  not run for this document.
- Backend [`tests/test_verification.py`](../../../backend/tests/test_verification.py) covers link
  issue, single use, expiry, purpose separation, non-disclosure, the order and publishing gates, and
  reset.
- No Jest test renders `forgot.tsx`, `reset.tsx`, `verify.tsx` or `VerifyEmailBanner`, and no
  Playwright spec or device run covers them. The [dev-sync review](../qa/dev-sync-review-20260918.md)
  records that delivered email was not exercised.

Local run on `dev` at `64cb324`, 18 September 2026: `verification-admin-client.test.ts` 12 passed
(5 in this area); backend `tests/test_verification.py` 18 passed on the temporary SQLite database.

## Known gaps

- No screen-level, end-to-end or device evidence for any of the four surfaces.
- Links open the web build at `APP_WEB_URL`; handing a link to the installed app is not configured.
- The verify screen always says "That link has expired", even for a missing token or a network error.
- The banner reports a new link as sent even when the request failed.
- The "two hours" and "a day" lifetimes are fixed in the copy, not read from the server.
- No client-side email-format or password-length check; both rely on the backend's `400` response.
