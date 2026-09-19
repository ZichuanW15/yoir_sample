# US-06–08 backend: login, safe errors and logout

Backend tasks: [US-06 #99](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/99),
[US-07 #102](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/102) and
[US-08 #105](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/105).
Parent stories: [#9](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/9),
[#10](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/10) and
[#11](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/11).

This slice completes the backend authentication boundary on `backend/auth-sessions`,
after fast-forward merging `dev` at `f6e3bc3` with no conflicts. Registration remains
as documented for [US-01](us01-registration.md),
[US-02](us02-account-creation.md) and [US-03](us03-duplicate-email.md).
Unmerged PR #152 and new counsellor/administrator business endpoints are excluded.

## API contract

| Request | Result |
| --- | --- |
| `POST /api/v1/auth/sessions` with `email` and `password` | `200` with the unchanged `accessToken`, `expiresAt`, `user` structure |
| Invalid login fields, including extra fields | `400 VALIDATION_ERROR`, with `fieldErrors` |
| Unknown email, wrong password or unusable stored password hash | Identical generic `401 INVALID_CREDENTIALS` |
| `DELETE /api/v1/auth/sessions/current` with a valid bearer token | Empty `204` after durable revocation of that token |
| Missing, invalid or expired logout credential, or missing account | `401 AUTHENTICATION_REQUIRED` |

Credential failures return exactly this shape, without `fieldErrors`, user data,
tokens, passwords, hashes or internal diagnostics:

```json
{
  "code": "INVALID_CREDENTIALS",
  "message": "The email or password is incorrect.",
  "requestId": "<matches the X-Request-Id response header>"
}
```

Corrected credentials can be submitted immediately. Login keeps the existing
case-normalized email lookup and preserves password whitespace and Unicode exactly.
The password is excluded from request-model representations and marked write-only
in OpenAPI. Successful login responses have `Cache-Control: no-store` and
`Pragma: no-cache`; logout success also has `Cache-Control: no-store`.
Unknown accounts perform one Argon2 verification against a dummy hash, rather
than skipping password verification entirely. Matching that dummy hash can never
authenticate a nonexistent account. This reduces the obvious timing shortcut;
it is not a constant-time guarantee across database and network operations.

## Session and role decisions

- Existing Job Seeker, Counsellor and Platform Owner accounts can log in. The
  response and token use the stored role; clients cannot supply a login role or
  user identifier. Public registration still cannot create a Platform Owner.
- The existing configurable JWT policy is retained: HS256 by default and a
  default lifetime of 60 minutes. Expiry requires logging in again; there is no
  refresh-token flow, sliding expiry or additional cookie session.
- New tokens contain `sub`, `role`, `exp`, `iat` and a fresh random `jti`, so two
  logins in the same second have independently revocable credentials.
- Authentication verifies the configured signature algorithm and expiry. It
  requires a nonempty string subject, a supported role and a finite numeric
  expiry; supplied `iat`/`nbf` must also be finite numbers and `jti` a nonempty
  string. Boolean/string timestamp substitutes are not accepted.
- Authorization reads the current database role, not the token's role claim.
  Existing order and payment endpoints therefore continue to permit only Job
  Seekers, including when a correctly signed token has an outdated role claim.
- No timing-equivalence guarantee, lockout, rate limiting, password recovery or
  administrator provisioning workflow is introduced in this slice.

## Durable, current-session logout

The new `revoked_tokens` table stores a SHA-256 digest, `expires_at` and
`revoked_at`; it has no account foreign key and stores neither raw JWTs nor
passwords. The digest is calculated from the **verified `header.payload` signing
input**, not the raw JWT string. Equivalent base64url signature padding therefore
cannot turn a logged-out credential into an accepted one.

Every protected request checks this shared database denylist before loading its
account. A revocation-store failure fails closed with a generic server error; it
does not grant access or report successful logout. Logout commits the revocation
before returning `204`, and a failed write is rolled back.

Repeating logout for an otherwise valid, unexpired, already-revoked token returns
`204`. Concurrent repeats use a database conflict-safe insert and leave one row.
Expired/invalid credentials still return `401`, rather than claiming successful
revocation. Other tokens belonging to the same account remain usable, and a fresh
login works normally.

Cleanup occurs opportunistically during logout, in the same transaction as the
insert. Only records whose expiry was at least 24 hours ago are removed. This
retention margin accommodates modest differences between worker clocks; it is
not an extra 24-hour token-validity allowance. No background cleanup job is added.

Existing correctly signed tokens without `jti` remain compatible if their required
claims are valid. Identical legacy tokens cannot be distinguished as separate
sessions and share one revocation entry. New random `jti` values remove that
ambiguity for new logins.

A confirmed logout affects subsequent authentication checks. It does not cancel
requests that already passed authentication before the revocation committed.
All API workers must run the updated code and share the revocation database for
the check to be effective across workers and restarts.

## Deployment and frontend boundary

The existing startup `Base.metadata.create_all` creates the new table and indexes
without resetting data or changing existing tables. No dependency change or
existing-table migration is required; the database account needs permission to
create the new table. Do not reset the database or erase live revocation records
when deploying this feature. PostgreSQL is the deployment database; SQLite is
supported for isolated local QA, with a dialect-specific conflict-safe insert.

The frontend already calls `DELETE /auth/sessions/current`, so its wire contract
does not change. However, its current `AuthContext` keeps sessions in memory,
clears local state immediately and calls logout in the background; the API client
swallows logout errors. It does not implement secure persistent token storage.
An offline or failed logout is therefore **not evidence of server revocation**.
Frontend error handling, secure-storage decisions, protected-screen behaviour and
device recordings remain frontend/QA work. Backend completion alone does not
close the parent stories or establish their full acceptance criteria.

## Verification and QA handoff

From `backend/`, using Python 3.12 and the repository lockfile:

```bash
uv sync --locked
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest tests/test_login_sessions.py tests/test_logout_sessions.py -q
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest tests -m "not live" --cov=app
uv run --no-sync ruff check app tests reset_db.py
```

Unsetting `DATABASE_URL` selects the harness-owned temporary SQLite database,
not the development `.env` database. The suite clears test data and drops its
tables at teardown. PostgreSQL testing requires an explicitly disposable database
named `yoir_test` or ending in `_test`, plus `YOIR_QA_ALLOW_DATABASE_RESET=true`.
Never point this destructive fixture harness at a shared development or deployed
database. See the [QA test approach](../../sprint1/qa/test-approach.md).

Regression coverage includes all three roles, safe session output, independent
tokens at a fixed clock instant, exact password handling, generic failure parity
and corrected retries, malformed hashes, input validation, stored-role permissions,
durable and concurrent logout, legacy tokens, alternate signature encodings,
invalid claim shapes, expiry cleanup and database-failure rollback/fail-closed
behaviour. SQLite results are not PostgreSQL or device acceptance evidence.

## Local verification — 11 September 2026

Python 3.12.13, unchanged `uv.lock`, QA-managed temporary SQLite databases:

- US-06/07 login regressions: **35 passed**.
- US-08 logout regressions: **45 passed**, including forced concurrent logout and
  the expiry-retention boundary.
- Added logout OpenAPI and non-destructive schema-upgrade checks: **2 passed**.
- Full non-live backend suite: **250 passed, 14 unrelated existing strict XFail,
  1 PostgreSQL-only booking test skipped, 2 live tests deselected**. The malformed
  Argon2 login regression now passes instead of being marked XFail.
- Full-suite coverage: **91% overall**, security module **100%**, auth router **96%**.
  The PostgreSQL insert branch requires PostgreSQL coverage; the local SQLite run
  is not a claim that this deployment path was exercised.
- Real HTTP smoke against a separate, loopback-only Uvicorn process with a fresh
  disposable SQLite database: **2 passed**, including login-failure parity,
  current-session logout, token replay/signature-padding rejection and preservation
  of another login session.
- Existing TypeScript client against that test server: **1 passed** through
  registration, login, marketplace, booking and development payment confirmation.
- Existing frontend API-client/AuthContext regression: **16 passed, 6 existing
  TODOs**; TypeScript typecheck passed using Node 24.19.0. No frontend files changed.
- Ruff, Python compilation, repository metadata/Markdown links and diff whitespace
  checks passed.

No live/development database was reset and no deployed environment was changed.
PostgreSQL-specific verification remains for the existing CI job when this work is
pushed; local Docker was unavailable. Device acceptance remains with QA tasks
[#100](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/100),
[#103](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/103) and
[#106](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/106).

Technical references: [PyJWT verification and required claims](https://pyjwt.readthedocs.io/en/stable/api.html#jwt.decode),
[Argon2 verification exceptions](https://argon2-cffi.readthedocs.io/en/stable/api.html#exceptions),
[SQLAlchemy PostgreSQL conflict handling](https://docs.sqlalchemy.org/en/20/dialects/postgresql.html#insert-on-conflict-upsert).
