# US-09–11 backend: private diagnosis records and confirmed progress

Backend tasks: [US-09 #161](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/161),
[US-10 #164](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/164) and
[US-11 #167](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/167).
Parent stories: [US-09 #81](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/81),
[US-10 #78](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/78) and
[US-11 #80](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/80).

This Sprint 3 backend slice adds account-owned diagnosis records, step-by-step
saving, resume, answer validation and stale-write protection. It gives the existing
five-input/six-step frontend flow a persistent API; it does **not** mean the parent
stories, frontend integration or the complete diagnosis-to-booking journey are
accepted. Conditional topic-bank routing still needs agreed mappings. US-12
direction generation and US-13 matching are outside this slice.

## Questionnaire boundary

`yoir-six-step-v1` defines the question IDs, option IDs and labels in
[`backend/app/diagnosis.py`](../../../backend/app/diagnosis.py).
The question-definition endpoint exposes that version so the client can render
and submit the supported contract without guessing. It is not a claim that the
client has approved the frontend's recommendation weights or all question-routing
decisions.

| Step | Stable question ID | Title | Accepted answer |
| --- | --- | --- | --- |
| 1 | `now` | Where are you now? | One supported option ID |
| 2 | `goal` | What are you trying to achieve? | One supported option ID |
| 3 | `tried` | What have you tried so far? | Array of unique supported IDs; `[]` explicitly means none |
| 4 | `stuck` | Where are you getting stuck? | One supported option ID |
| 5 | `barriers` | Are there any barriers affecting your next step? | Array of unique supported IDs; `[]` explicitly means none |
| 6 | No input ID | Your Yoir Direction | Result step descriptor only; no result-generation endpoint in this slice |

The three single-select questions require a choice. The two multi-select questions
must be explicitly saved, even when their value is empty: an absent answer is not
the same as `[]`. These single/multiple and optional-selection rules follow the
current frontend flow and must remain part of client/PO acceptance review.

The optional `other` text is at most 200 characters and is accepted only when that
question's `other` option is selected. The `stuck` question has no `other` option.
Omitting `other` or sending `null` clears previously saved text for that question;
changing away from `other` must not leave hidden old text attached to the answer.

The client's wider workbook contains topic questions and free-text responses that
are **not** represented by this five-question schema. Situation-to-topic routing,
conditional follow-ups and pruning of abandoned topic branches remain a separate
content/contract decision; no arbitrary routing or scoring is introduced here.
Later answers are retained when earlier answers change in this universal flow,
because all five questions remain applicable. That is not an implementation of
conditional-branch pruning.

## API contract

All paths below start with `/api/v1`. All five operations require a bearer token
for a Job Seeker. Ownership is derived from the authenticated account, not a
caller-supplied user ID. Career Professionals and Platform Owners cannot read or
write these private records through these routes.

| Request | Success |
| --- | --- |
| `GET /me/diagnosis/questionnaire` | `200`: version, five question definitions and step-six descriptor |
| `POST /me/diagnosis` | `200`: create the caller's record or return it unchanged if it already exists |
| `GET /me/diagnosis` | `200`: caller's persisted record; `404` if not started |
| `GET /diagnoses/{diagnosisId}` | `200`: matching record only when owned by the caller |
| `PUT /diagnoses/{diagnosisId}/steps/{stepId}` | `200`: entire updated record, including the new revision and confirmed progress |

Full schemas and operation-to-story mapping are in
[`openapi.yaml`](../../sprint1/executable-architecture/openapi.yaml) and
[`interface-traceability.csv`](../../sprint1/executable-architecture/interface-traceability.csv).

Start or resume:

```http
POST /api/v1/me/diagnosis
Authorization: Bearer <access token>
Content-Type: application/json

{"questionnaireVersion":"yoir-six-step-v1"}
```

A new record has this shape; IDs and timestamps below are illustrative:

```json
{
  "id": "<diagnosis ID>",
  "questionnaireVersion": "yoir-six-step-v1",
  "revision": 0,
  "status": "in_progress",
  "currentStep": 1,
  "totalSteps": 6,
  "completedSteps": [],
  "answers": {"other": {}},
  "createdAt": "2026-10-07T00:00:00Z",
  "updatedAt": "2026-10-07T00:00:00Z"
}
```

Save the first question using the last confirmed revision:

```http
PUT /api/v1/diagnoses/<diagnosis ID>/steps/now
Authorization: Bearer <access token>
Content-Type: application/json

{"questionnaireVersion":"yoir-six-step-v1","expectedRevision":0,"value":"job"}
```

The returned record now has `revision: 1`, `currentStep: 2`,
`completedSteps: ["now"]` and `answers: {"now":"job","other":{}}`.
The client must keep this returned revision for the next save. It cannot submit
an arbitrary progress counter, completion flag, user ID or result; unknown request
fields are rejected.

After `goal` is saved, `tried` accepts `"value": []` as a deliberate answer.
After all five questions are saved, `currentStep` becomes `6` and `status` becomes
`answers_complete`. This means **inputs are saved**, not that a Yoir Direction has
been generated or accepted. There is no fake result, placeholder match or
server-side recommendation in this slice.

## Persistence, ordering and concurrent edits

- One record belongs to one Job Seeker, enforced by a unique account foreign key.
  Repeating `POST /me/diagnosis` resumes it; it does not clear answers or reset its
  revision. Reads do not create records.
- Confirmed answers are stored in the shared database, not a process-local cache.
  A newly authenticated session for the same account can retrieve them.
- Steps must be saved in order. Previously saved steps can be edited; a caller
  cannot skip an unsaved required input step or write to step six.
- Progress is derived by the server from saved answers. An empty multi-select
  array still counts as saved; a missing question key does not.
- Every accepted save replaces that question's value atomically and increments
  the revision. Updates condition on `expectedRevision`; concurrent submissions
  cannot silently overwrite a newer saved version.
- A failed validation, ownership check, ordering check or revision check leaves
  the record unchanged. Database write failure must not return successful saved
  progress.

## Error handling

Errors use the existing `{code, message, requestId, fieldErrors?}` envelope.

| Response | Meaning and client action |
| --- | --- |
| `400 VALIDATION_ERROR` | Unsupported version/step/option, wrong answer shape, duplicate choices, invalid `other`, missing fields or unknown request fields. Show the error; keep the last confirmed record. |
| `401 AUTHENTICATION_REQUIRED` | Missing, invalid, expired or revoked authentication. Restore authentication before retrying. |
| `403 FORBIDDEN` | The account is not a Job Seeker. Do not show or allow diagnosis editing for this role. |
| `404 NOT_FOUND` | No diagnosis exists, or the requested ID does not belong to the caller. Foreign and nonexistent IDs have the same response. |
| `409 INVALID_STATE_TRANSITION` | Skipped step, stale revision or a stored questionnaire version that differs from the request. Fetch the current record and reconcile with the user's edits; do not blindly replay an old save. |

`expectedRevision` must be a nonnegative integer, not a numeric string or Boolean.
Multiple-choice payloads must be arrays of unique strings from that question's
allowed options; numbers, mixed arrays and more than 12 values are rejected.

If a network response is lost after a save, the client cannot assume that the save
failed. Re-read `GET /me/diagnosis` before retrying: a committed save has advanced
the revision, so replaying the old revision returns a conflict safely.

## Frontend handoff and remaining acceptance

This change does not modify the frontend. Its current
[`useDiagnosis`](../../../frontend/src/diagnosis/view.tsx) and storage modules still
use on-device/browser storage and calculate direction locally. Shipping these API
routes alone does not switch the deployed frontend to server-backed resume.

Integration work should:

1. Fetch the supported questionnaire and call start/resume after authentication.
2. Render returned saved answers; use `currentStep` for the first unsaved input.
3. Save each step and only advance after the successful response; retain unsaved
   local input for error recovery without presenting it as confirmed progress.
4. Keep the returned revision, reconcile `409` responses and clear account-specific
   in-memory data on account changes/logout.
5. Distinguish `answers_complete` from an available direction. Keep US-12/13 results
   and routing work explicit, rather than presenting this response as a generated
   or approved recommendation.

No skip marker, delete/reset endpoint or additional history of attempts is added.
Navigating away can leave a draft; start/resume keeps it. Existing local completed
answers are not automatically imported. Any import needs explicit, ordered,
validated saves with revision checks and must not overwrite newer server data.

Remaining parent-story acceptance includes frontend success/error states and
cross-device journeys, approved conditional topic routes/free-text content,
branch-change invalidation once branching exists, and integrated US-12/13 results.
The existing
[frontend handoff](../../sprint2/frontend/us09-us13-yoir-diagnosis.md) describes the
pre-backend baseline and should not be read as proof of this integration.

## Deployment

Alembic revision `0009` (after `dev`'s `0008`) adds the diagnosis table with the account foreign key,
unique ownership constraint, version, JSON answers, revision and timestamps. It
does not reset existing accounts, bookings or payments. The existing startup
migration mechanism upgrades the database before serving requests; no seed/reset
command is needed. Follow the normal backup/release process before upgrading a
shared database. The API workers must use the same database for cross-device
resume and concurrency protection.

The diagnosis migration was renumbered from `0006` to `0009` while this PR was
unmerged, to preserve `dev`'s existing `0006` profile visibility, `0007` pre-session
brief and `0008` meeting address migrations. Do not replace those migrations or
stamp a database blindly. A persistent database that ran the earlier PR-only
diagnosis `0006` has a different schema from `dev`'s `0006` and requires a separate
schema/history check and backup before upgrading. The tests below use disposable
databases, not a shared deployment.

## Verification and QA handoff

Regression scenarios are covered by
[`backend/tests/test_diagnosis.py`](../../../backend/tests/test_diagnosis.py):
versioned questions, idempotent start, account isolation, role/auth guards,
sequential saves, resume, earlier-answer edits, empty multi-selects, invalid
payloads, stale revisions and database-failure safety. Published-contract and
traceability checks remain in
[`test_contract.py`](../../../backend/tests/test_contract.py). Non-destructive
schema upgrade and isolated downgrade coverage is in
[`test_diagnosis_migration.py`](../../../backend/tests/test_diagnosis_migration.py).
The runtime/published request fields, security, errors and answer options are
checked by [`test_diagnosis_contract.py`](../../../backend/tests/test_diagnosis_contract.py).
Downgrading drops diagnosis records, so it is not a data-preserving rollback plan
for a shared deployment.

From `backend/`, using the existing Python 3.12 environment and lockfile:

```bash
uv sync --locked
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest tests/test_diagnosis.py tests/test_diagnosis_migration.py tests/test_diagnosis_contract.py tests/test_contract.py -q
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest tests -m "not live and not future_contract" -q
uv run --no-sync ruff check app tests
```

Unsetting `DATABASE_URL` selects the QA harness's disposable SQLite database. The
fixtures delete test data and drop their tables; never run them against shared
development or deployed data. PostgreSQL verification requires a deliberately
disposable database named `yoir_test` or ending in `_test` and the harness's
explicit reset opt-in. See the [QA test approach](../../sprint1/qa/test-approach.md).

### Local verification — 7 October 2026

Tested on Python 3.12.13 with the unchanged dependency lockfile, on
`feat/US-09-backend-diagnosis-progress` based on `dev` at `e5dce2a` (renamed from
`backend/diagnosis-progress` to follow the repository's feature-branch convention).
These results cover the
local implementation, not a deployed release or parent-story acceptance.

- New diagnosis behaviour, migration and contract tests: **85 passed** on isolated
  SQLite; all are also included in the PostgreSQL full-suite result below.
- Full non-live backend suite, including retained future-contract checks:
  **663 passed, 5 PostgreSQL-only skips, 18 existing strict XFail, 2 live tests
  deselected** on disposable SQLite.
- The same full non-live suite on a separate, loopback-only PostgreSQL 15 test
  container: **668 passed, 18 existing strict XFail, 2 live tests deselected**.
  This exercises concurrent starts, competing saves and the real foreign-key
  cleanup path. The separate 0005-to-0006 data-preservation/downgrade tests use
  their own temporary SQLite engines; the PostgreSQL suite builds through the
  full migration chain.
- Frontend/backend compatibility check: all **5 question IDs/titles and 43 option
  IDs/labels** match the existing `frontend/src/diagnosis/model.ts`.
- Ruff, whitespace, OpenAPI and traceability checks passed. Repository metadata
  passed when excluding the four pre-existing uncommitted PO documents. The full
  working-tree check still identifies their existing broken Story Map image link
  (`images/user-story-map-full-dependencies.png`); those documents were preserved
  unchanged and are not part of this backend delivery.

No shared development or deployed database was reset, and no email or payment
provider was contacted by these tests. No frontend end-to-end, physical-device or
deployed-environment acceptance is claimed. The frontend must still switch its
local diagnosis storage to these APIs before cross-device app behaviour can be
accepted.

### Merge compatibility — 8 October 2026

Merged `dev` at `5f46166` into the same feature branch. The operation coverage set
retains both the diagnosis endpoints and `dev`'s own-profile, profile-visibility
and booking meeting-address endpoints. The diagnosis migration now follows the
single `0001`–`0009` chain; the 7 October results above describe the earlier
pre-merge revision numbering, not the current deployment chain.

The frontend dependency manifest and lockfile follow `dev`'s existing
`shell-quote` override at `1.11.0`. This version retains the critical security fix;
no audit threshold or test expectation is relaxed as part of conflict resolution.

Post-merge local verification (Python 3.12.13; Node 24.19.0 / npm 10.8.2):

- Non-live backend regression excluding the separately run diagnosis migration
  module: **674 passed, 5 PostgreSQL-only skips, 18 existing strict XFail, 2 live
  tests deselected** on disposable SQLite.
- Diagnosis migration module: **5 passed**. Both `0005` and `0008` schemas retain
  their users, services, windows, orders and bookings when upgraded to `0009`.
  Repeated upgrades retain saved diagnosis answers; downgrade to `0008` only
  drops diagnosis records and preserves `dev`'s fields and data.
- Frontend regression: **46 suites / 379 tests passed**. Lint, typecheck, clean
  locked installation and the deployable Web build passed.
- The unchanged production critical-audit gate passed with **0 critical**;
  **51 high and 14 moderate** findings remain outside this merge resolution.
- Backend Ruff and whitespace checks passed. GitHub CI separately validates
  PostgreSQL, browser regression and its pinned Node 20.20.2 environment.
