# US-70 backend: reset request and reset confirmation, with single-use tokens

Issues: back-end sub-issue [#227](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/227),
under [US-70 #12](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/12).

A registered user asks for a reset link, receives it by email, and sets a new password with it,
without the API revealing whether an address has an account. Both endpoints, the single-use token
table and the reset email reached `dev` on 18 September 2026 in
[PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157) (commit `70232ce`),
with the transactional email it needs. In Sprint 3, Ariz moved the reset email to a background task, so
the response time no longer depends on whether the address has an account, and added two tests (commit
`4a67bcd`, pushed to `dev` on 8 October 2026 without a pull request). The screens are documented in
[US-70 frontend](../frontend/us70-password-reset.md).

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screen 10.

## Endpoints and flow

| Endpoint | Code | What it does |
|---|---|---|
| `POST /auth/password-reset-requests` | `request_password_reset` in [`app/routers/auth.py`](../../../backend/app/routers/auth.py) | Body `{email}`. `202` with no body for any address. For a registered one, issues a token and emails the link after responding. |
| `POST /auth/password-resets` | `reset_password` in the same file | Body `{token, password, passwordConfirmation}`. `204` sets the new password and ends every session; otherwise `400`. |

Flow: on "Forgot your password?" the user enters their email. A registered user receives "Reset your
password" with a link to `<APP_WEB_URL>/auth/reset?token=…`. They choose a new password there and then
log in with it.

Both endpoints are public. The token helpers are `issue_single_use_token` and
`consume_single_use_token` in `app/routers/auth.py`; the table is `SingleUseToken` in
[`app/models.py`](../../../backend/app/models.py). The email is `password_reset` in
[`app/mail/messages.py`](../../../backend/app/mail/messages.py), with the templates
`password_reset.html.j2` and `password_reset.txt.j2`.

## Token lifecycle

- **Issued:** 32 random bytes (`secrets.token_urlsafe(32)`). Only the SHA-256 digest is stored, with
  the user, the purpose `reset_password` and an expiry of `password_reset_ttl_hours`, 2 by default. The
  raw token exists only in the email.
- **One live link:** issuing a new link marks any earlier unused reset link for that user as used, so
  asking again replaces the old link instead of adding a second one.
- **Spent once:** the confirmation looks the token up by digest with a row lock. It must have the reset
  purpose, be unused and be unexpired. It is then marked used, so a second attempt fails.
- **Purpose-bound:** a link mailed to confirm an email address cannot reset a password, and a reset
  link cannot confirm an address.
- **Anything else is refused:** an unknown, altered, used or expired token is `400 VALIDATION_ERROR`,
  "This reset link is no longer valid. Ask for a new one.", and the password is unchanged.

## Behaviour and states

- **Same answer for every address:** `202` with an empty body whether or not the address has an
  account, and the email is only sent to a registered one. Addresses are matched in lower case.
- **Timing:** for a registered address the email is sent as a background task after the response
  (Ariz, `4a67bcd`), so waiting on the mail provider no longer shows in the response time.
- **New password:** both fields at least 8 characters, and they must match. A mismatch is
  `400` "The passwords do not match." and is checked before the token is spent, so the user can retry
  with the same link. Extra fields are refused.
- **On success:** the password is hashed as at registration. Every refresh token is revoked, and
  access tokens already issued are retired through `sessions_invalidated_at`. The user is signed out on
  every device, the old password stops working, and the reset does not sign them in.
- **Email:** subject "Reset your password", the link, and how long it lasts. A failed send does not
  change the response.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.requestPasswordReset(email)` | `POST /auth/password-reset-requests` | `202` with no body for any address. |
| `api.resetPassword(token, password, passwordConfirmation)` | `POST /auth/password-resets` | `204` on success; `400` with field errors otherwise. |

## Acceptance criteria

| Criterion | Backend behaviour | Evidence |
|---|---|---|
| Registered email: a reset token is created and a link sent | Token issued; email sent after the response | `test_link_requests_do_not_reveal_who_has_an_account`, `test_password_reset_composes_a_reset_link` |
| Unregistered email gets the identical confirmation and response | Same `202` and empty body; nothing sent | `test_link_requests_do_not_reveal_who_has_an_account` |
| Valid link and matching new password: hash replaced, success, old password refused | `204`; sessions ended | `test_reset_changes_the_password_and_ends_every_other_session`, `test_after_a_reset_the_old_password_no_longer_authenticates` |
| Expired, used or altered token: rejected and password unchanged | `400`; no change | `test_a_reset_link_works_exactly_once`, `test_an_expired_reset_link_is_refused`, `test_a_tampered_or_never_issued_token_is_refused`, `test_a_reset_link_cannot_confirm_an_address`, `test_a_confirmation_link_cannot_reset_a_password` |
| An in-flight or failed submission never shows success | `204` only after the change is committed; a mismatch leaves the link usable | `test_reset_requires_the_confirmation_to_match_and_leaves_the_link_unspent`; the busy and error states are the app's |

## Tests

- [`tests/test_verification.py`](../../../backend/tests/test_verification.py): the nine reset tests
  above. `test_link_requests_do_not_reveal_who_has_an_account` runs for both link requests, reset and
  email confirmation. `test_a_tampered_or_never_issued_token_is_refused` and
  `test_after_a_reset_the_old_password_no_longer_authenticates` are Ariz's Sprint 3 additions.
- [`tests/test_mail_messages.py`](../../../backend/tests/test_mail_messages.py):
  `test_password_reset_composes_a_reset_link`, and the reset case of
  `test_account_emails_never_carry_the_other_purpose_link`, which checks that a reset email carries no
  email-confirmation link and the other way round.

Run from `backend/`:

```bash
env -u DATABASE_URL uv run pytest tests/test_verification.py tests/test_mail_messages.py -q \
  -k "reset or link_requests or tampered or old_password"
```

Local run on `dev` at `a6eeb35`, 18 October 2026, Python 3.12.14, temporary SQLite database: 12 passed.

## Known gaps

- **Timing is narrowed, not removed:** for a registered address the token is still created and written
  before the response, so a smaller difference in response time remains.
- **No rate limit:** anyone can ask for reset emails to an address as often as they like. Each request
  replaces the previous link, but each one sends an email.
- Used and expired tokens are never deleted, so the table only grows.
- The link points at `APP_WEB_URL`. Left unset on a deployment, it points at `localhost`
  ([dev environment](../../deployment/dev-environment.md)), and it opens the web build rather than the
  installed app.
- The lifetime is a setting, but the app's copy says "two hours", so changing the setting would make
  the copy wrong.
