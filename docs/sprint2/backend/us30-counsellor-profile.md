# US-30 backend: counsellor professional profile

Backend task: [US-30 #129](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/129),
under parent story [#24](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/24).

This document records the integrated backend profile contract on `dev` commit
`33027e0`, reviewed on 19 September 2026. The branch on which this document was
authored contains an earlier backend snapshot; the final Sprint 2 implementation
source is the integrated backend model, schema, router, migration and tests at that
`dev` revision.

## API contract

| Request | Access and result |
| --- | --- |
| `PATCH /api/v1/me/counsellor-profile` | Authenticated counsellor; `200` with the saved profile |
| `GET /api/v1/counsellors` | Public; professionals behind active, bookable services |
| `GET /api/v1/counsellors/{counsellor_id}` | Public; `200` profile or `404 NOT_FOUND` |

Although the update uses `PATCH`, the request is the whole editable profile, as
submitted by the profile form. It is not a one-field partial update. A representative
request is:

```json
{
  "photoUrl": "https://example.com/profile.jpg",
  "linkedinUrl": "https://www.linkedin.com/in/example",
  "introduction": "Career Professional for graduates and career changers.",
  "background": "Career development and recruitment.",
  "experience": "Eight years of advisory experience.",
  "qualifications": ["Master of Career Development"],
  "expertise": ["Interview preparation", "Resume writing"],
  "languages": ["English", "Hindi"],
  "baseLocation": {
    "state": "Victoria",
    "cityOrRegion": "Melbourne"
  },
  "defaultModality": "online"
}
```

`linkedinUrl` is required. Omitted optional text and list fields receive their schema
defaults, so a client must submit the complete current form to avoid clearing data.
Unknown fields are rejected rather than silently ignored.

## Stored and public fields

| Field | Backend behaviour |
| --- | --- |
| `photoUrl` | Optional string up to 2,000 characters; stored on the user row |
| `linkedinUrl` | Required LinkedIn address; host must be `linkedin.com` or a subdomain |
| `introduction` | Optional descriptive text, up to 5,000 characters |
| `background` | Optional descriptive text, up to 5,000 characters |
| `experience` | Optional descriptive text, up to 5,000 characters |
| `qualifications` | Up to 20 trimmed, nonblank items; 160 characters per item |
| `expertise` | Up to 20 trimmed, nonblank items; 160 characters per item |
| `languages` | Up to 20 trimmed, nonblank items; 160 characters per item |
| `baseLocation` | Optional `state` and `cityOrRegion` value object |
| `defaultModality` | `online` or `in_person`; defaults to `online` |

The backend adds server-controlled `id`, `displayName`, `verificationStatus`,
`overallRating` and `reviewCount` to the response. The public detail endpoint returns
the same professional profile shape. The public collection includes only counsellors
who own an active service that passes the payment listing rule, ordered by overall
rating and then display name.

Migration `0005_counsellor_profile_details.py` adds the persisted qualification,
expertise and language lists. `test_counsellor_profile_details.py` verifies that the
lists are saved, trimmed, bounded and returned through the public profile endpoint.

## Ownership and verification decisions

- The `/me` route derives the owner from the verified bearer token and current
  database account. A caller cannot choose another profile ID in the request.
- Job Seekers and anonymous callers cannot update a counsellor profile.
- `verificationStatus`, ratings and review counts are response-only. A counsellor
  cannot mark their own profile verified or write their own rating.
- LinkedIn validation belongs to the backend because that URL is used by the
  separate Platform Owner verification workflow.
- Profile statements and qualification text remain user-supplied information. A
  verified account status must not be presented as independent verification of every
  qualification or profile statement.

An invalid LinkedIn host returns `400 VALIDATION_ERROR` with a `linkedinUrl` field
error. Standard schema failures, including blank or oversized profile-list items,
also return the shared `400` error envelope with the request ID preserved.

## Photo and service boundaries

The backend stores the supplied `photoUrl` string. It does not implement multipart
upload, object storage, image resizing or deletion of an uploaded asset. Therefore
the backend portion of task #129 provides a persisted photo reference, not a complete
file-upload system.

Services are available through `/api/v1/services` and the counsellor-owned service
routes. They are not embedded as explicit service links in `CounsellorProfileOut`.
A consumer can load the public profile and service collection separately; changing
that response composition requires a separate contract change.

## Verification and QA handoff

From `backend/` on the integrated `dev` revision, using the locked dependencies:

```bash
uv sync --locked
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest \
  tests/test_counsellor_profile_details.py \
  tests/test_counsellor.py \
  tests/test_sprint2_counsellor_acceptance.py -q
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest \
  tests -m "not live" --cov=app
uv run --no-sync ruff check app tests reset_db.py
```

Unsetting `DATABASE_URL` selects the QA-owned temporary SQLite database. PostgreSQL
verification must use an explicitly disposable database whose name ends in `_test`
and the project's reset-consent environment variable. Never run the destructive
fixture harness against a development or deployed database.

Backend tests cover profile persistence, list bounds, public output, role and
ownership guards, LinkedIn validation and the server-controlled verification state.
Frontend rendering, native photo selection and physical-device acceptance are not
established by these backend tests.

## Integration verification — 19 September 2026

- The dated QA baseline at `8aa2428` recorded **564 passed, 15 strict XFail and
  7 deselected** against PostgreSQL.
- [Application CI run 35414587950](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/runs/35414587950)
  completed all seven jobs successfully for `dev` commit `33027e0`, including the
  backend PostgreSQL, migration, Ruff and coverage job.
- This documentation change did not rerun the suite locally. The linked results are
  repository integration evidence, not a new local execution claim.

Backend completion alone does not close parent story #24 or establish frontend,
native-device or client acceptance.

## Documentation assistance disclosure

Codex was used on 19 September 2026 to inspect the backend model, schema, router,
migration, tests, linked issues and CI metadata and to help draft and verify this
document. It was used to improve traceability and identify mismatches, not to invent
implementation or test results. Human review remains required before submission.
