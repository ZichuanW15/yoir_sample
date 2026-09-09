# US-03 backend: useful duplicate-email errors

Issue: [#96](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/96),
under [US-03 #6](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/6).

This completes the backend duplicate-email boundary on the existing public
`POST /api/v1/auth/users` endpoint, following [US-01](us01-registration.md) and
[US-02](us02-account-creation.md). No dependency, schema migration, frontend change
or new endpoint is required. The merged `dev` deployment changes are preserved.

## Behaviour and frontend contract

An already registered email returns HTTP `409` with the same English error whether
the initial lookup finds it or a concurrent registration wins the database insert:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "An account with this email already exists.",
  "fieldErrors": { "email": "Already registered." },
  "requestId": "<matches the X-Request-Id response header>"
}
```

- The app distinguishes duplicates using HTTP `409` and `fieldErrors.email`.
  Other invalid registration fields remain HTTP `400`; no new error code is added.
- Rejection creates no second or partial account and does not overwrite the
  original account's name, role, password hash or profile fields.
- A known duplicate is rejected before password hashing. Database conflicts roll
  back the whole failed transaction before returning the same form error.
- Neither error path issues a token, session cookie or redirect. Database messages,
  SQL, passwords and password hashes are not included in the response.
- Correcting the email to an unused address permits registration with the other
  form values unchanged; successful registration still returns HTTP `201`.
- The existing frontend catches the error, displays its message and leaves its
  input state intact. Form retention and device behaviour remain frontend/QA checks.

## Existing email policy, not a new product decision

Registration already uses `EmailStr` validation followed by lowercasing the whole
email; login also lowercases its lookup. Surrounding email whitespace is stripped
by the existing validation. Thus case/whitespace variants of API-created accounts
are duplicates. The existing database index is global, so one email cannot register
separate Job Seeker and Counsellor accounts.

These rules preserve the current implementation and US-03's working assumption.
The parent issue still lists case sensitivity and cross-role identity as product
decisions requiring agreement; this implementation does not claim client approval.
It does not introduce provider-specific dot/plus alias rules or migrate manually
inserted legacy emails. All account-creation paths must continue normalising emails.

## Race handling and failure isolation

The pre-check improves the common path but cannot guarantee uniqueness. The existing
unique index `ix_users_email` on `users.email` remains the final authority. An
`IntegrityError` from flush or commit is rolled back, then translated only when its
diagnostics identify this email invariant:

- PostgreSQL/psycopg2: SQLSTATE `23505` and constraint name `ix_users_email`.
  The driver exposes these as structured diagnostic attributes; no PostgreSQL
  message text is parsed. See the [psycopg2 diagnostics documentation](https://www.psycopg.org/docs/extensions.html#psycopg2.extensions.Diagnostics).
- SQLite (isolated local QA): `SQLITE_CONSTRAINT_UNIQUE` and the exact driver
  diagnostic `UNIQUE constraint failed: users.email`.

The existing `unique=True, index=True` model produces the named unique index;
an integration test verifies its name, uniqueness and columns. Renaming that index
in a future migration must also update the classifier and tests.

Primary-key, unrelated unique, not-null and unknown integrity failures retain the
generic HTTP `500` error instead of misleadingly asking the user to change email.
The rolled-back session remains reusable. No account merging, password recovery,
email verification or idempotency protocol is introduced.

## Verification and QA hand-off

From `backend/`, with Python 3.12 and the unchanged `uv.lock`:

```bash
uv sync --locked
uv run --no-sync pytest tests/test_duplicate_email.py tests/test_api.py::test_register_database_uniqueness_race_is_409
uv run --no-sync pytest tests -m "not live" --cov=app
uv run --no-sync ruff check app tests reset_db.py
```

With `DATABASE_URL` unset, the harness uses its own temporary SQLite database,
not the development `.env` database. PostgreSQL runs require a dedicated `_test`
database and `YOIR_QA_ALLOW_DATABASE_RESET=true`; see the
[QA test approach](../../sprint1/qa/test-approach.md).

The tests cover repeated duplicates, case/whitespace variants, both role directions,
unchanged original records, successful corrected-email submissions, no hashing or
token issuance for known duplicates, flush/commit rollback and unrelated failures.
The old strict-XFail race test now exercises a real database uniqueness rejection.
A two-request test uses a barrier after both pre-checks: exactly one request must
return `201`, the other `409`, with one persisted account and a successful loser retry.
This concurrency test runs on whichever database the QA harness is configured for.

Independent acceptance evidence and device recordings remain with
[#97](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/97).
Backend implementation alone does not close parent story #6 or its frontend/QA tasks.

## Local results — 9 September 2026

Python 3.12.13, unchanged dependency lockfile, QA-managed temporary SQLite:

- US-03 tests: 35 passed (34 new tests plus the formerly failing race regression).
- Before the fix, these tests reproduced six failures, including two concurrent
  requests returning `201` and `500`; after the fix that pair returns `201` and `409`.
- Full non-live backend suite: 167 passed, 15 unrelated existing strict XFail,
  1 PostgreSQL-only booking test skipped, 1 live test deselected. Baseline was
  132 passed, 16 XFail and the same skip/deselection.
- Full-suite coverage: 90% overall; auth router and password-security module 100%.
- The concurrent-registration regression also passed five separate isolated runs.
- Ruff, Python compilation, repository metadata/Markdown links and diff whitespace
  checks passed.
- Existing frontend API-client/AuthContext regression: 16 passed, 6 existing TODOs;
  TypeScript typecheck passed, using Node 24.19.0. No frontend files were changed.

These results are not PostgreSQL or device acceptance evidence. Docker was not
running locally. PostgreSQL diagnostic handling is covered locally with test doubles;
the existing CI PostgreSQL job will also run the real database-conflict and concurrent
registration tests when this work is pushed. No deployed environment was modified.
