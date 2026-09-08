# US-01 backend: registration form contract

Issue: [#86](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/86),
under [US-01 #4](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/4).

This backend slice completes the public registration request boundary used by the
Job Seeker form. It reuses the existing registration endpoint. Account persistence
and password hashing belong to US-02, duplicate-email handling to US-03, and the
shared counsellor role to US-04. Their existing behaviour is preserved.

The Sprint 2 frontend branch `feature/sprint2-onboarding-marketplace` at `dcf2eaf`
sends the same request as the
[published API contract](../../sprint1/executable-architecture/openapi.yaml).
Although the parent story abbreviates the submitted fields in its prose, both the
contract and the frontend include `passwordConfirmation`; it remains required.

## Request

`POST /api/v1/auth/users` is public and requires no bearer token.
Use `Content-Type: application/json`.

```json
{
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "password": "example-password",
  "passwordConfirmation": "example-password",
  "role": "job_seeker"
}
```

| Field | Validation |
|---|---|
| `name` | Required string; trim leading/trailing whitespace, then require 1–120 characters. Whitespace-only names are rejected. |
| `email` | Required valid email address, validated with Pydantic `EmailStr`/`email-validator`. Existing storage normalises it to lowercase. |
| `password` | Required string, at least eight characters. Never trim or otherwise normalise it. |
| `passwordConfirmation` | Required string, at least eight characters, exactly matching `password`. |
| `role` | Use `job_seeker` for US-01. The shared endpoint also accepts `counsellor`; it rejects `platform_owner` and unknown roles. |

Unknown fields are rejected rather than silently ignored. Required-field, type,
email-format, length and confirmation errors all return HTTP `400` before account
creation. The eight-character password minimum is inherited from the existing
frontend and published contract; this task does not introduce a new password policy.

## Responses

Successful valid requests return HTTP `201`:

```json
{
  "id": "example-user-id",
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "role": "job_seeker"
}
```

The response contains no password, password confirmation, password hash or session
token. Registration does not log the user in. The existing frontend can then offer
its Continue to log in action.

Validation failures return HTTP `400`, with English messages and camelCase field
keys matching the form. For example, a confirmation mismatch returns:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Passwords do not match.",
  "fieldErrors": {
    "passwordConfirmation": "Does not match password."
  },
  "requestId": "example-request-id"
}
```

An already registered email retains the existing HTTP `409` response:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "An account with this email already exists.",
  "fieldErrors": {
    "email": "Already registered."
  },
  "requestId": "example-request-id"
}
```

All responses include `X-Request-Id`; error bodies include the same `requestId`.
Clients should use the HTTP status and `code`, map `fieldErrors` onto the form and
display `message` as fallback, rather than depending on exact validator wording.
The runtime `/openapi.json` and `/docs` publish operation `register`, the request
example, password fields marked write-only, and `201`/`400`/`409` responses. Its
`4XX` fallback describes the shared client-error envelope; request validation uses
`400`, not FastAPI's default `422` body.

## Verify

Install the project's backend and test dependencies, then run from `backend/`:

```bash
python -m pytest tests/test_api.py -k register
python -m pytest tests/test_registration_contract.py
python -m pytest tests -m "not live"
ruff check app tests reset_db.py
```

Without `DATABASE_URL`, the existing test harness creates its own temporary SQLite
database. PostgreSQL integration uses the project's explicitly isolated test-database
workflow, described in [the test approach](../../sprint1/qa/test-approach.md).

The tests cover the public five-field request, validation failures without database
writes, both existing public roles, exact password preservation, safe response fields
and the published runtime contract. The pre-existing US-03 duplicate-email race is
tracked separately as a strict XFail; ordinary duplicate-email handling remains tested.

Front-end device validation, processing indicators and iOS/Android evidence remain
the responsibilities of #85 and #87. This backend change alone does not close the
parent story or supply device QA sign-off.

## Local verification — 8 September 2026

Checked on Python 3.13.9 with the dependencies from `backend/requirements-test.txt`,
using the QA-managed temporary SQLite database.

| Check | Result |
|---|---|
| Registration behaviour and contract tests | 42 passed; 1 existing US-03 race XFail |
| Full non-live backend suite | 94 passed; 16 existing strict XFail; 1 PostgreSQL-only test skipped |
| Ruff and Python compilation | Passed |
| Repository contract/traceability and Markdown links | Passed |

The baseline before this change was 60 passed / 17 XFail / 1 skipped. The registration
unknown-field defect now passes, and 33 new cases pass. PostgreSQL, deployed HTTP
integration and device QA have not been run for this change; the local Docker daemon
was unavailable. Existing CI provides the PostgreSQL and live integration checks.
