# US-44–46 backend: public discovery and service evaluation

Backend tasks: [US-44 #108](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/108),
[US-45 #111](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/111) and
[US-46 #114](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/114).
Parent stories: [#41](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/41),
[#42](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/42) and
[#43](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/43).

This document records the public backend contract on `dev` commit `33027e0`, reviewed
on 19 September 2026. The API router retains the internal `Marketplace` tag for
compatibility; the current user-facing discovery label is `Explore`.

## API contract

| Request | Result |
| --- | --- |
| `GET /api/v1/services` | Active services that satisfy payout-listing eligibility |
| `GET /api/v1/services?query=...` | Title or counsellor-name keyword filter |
| `GET /api/v1/services?modality=...` | Offered-modality filter |
| `GET /api/v1/services/{service_id}` | Public service detail or `404 NOT_FOUND` |
| `GET /api/v1/services/{service_id}/slots` | Currently derived bookable starts |
| `GET /api/v1/counsellors` | Professionals behind the listed services |
| `GET /api/v1/counsellors/{counsellor_id}` | One public professional profile |

The public service representation contains:

```json
{
  "id": "service-id",
  "counsellor": {
    "id": "counsellor-id",
    "displayName": "Maya Chen",
    "introduction": "Career transition specialist.",
    "verificationStatus": "verified",
    "overallRating": 4.8,
    "reviewCount": 12
  },
  "title": "Interview preparation",
  "description": "A structured interview coaching session.",
  "priceMinor": 9500,
  "durationMinutes": 60,
  "currency": "AUD",
  "modalities": ["online"],
  "location": null,
  "active": true,
  "averageRating": 4.7,
  "reviewCount": 8
}
```

The owner-only `meetingUrl` is deliberately absent. Anyone holding a standing room
URL may be able to enter a session, so it is not public discovery content.

## Listing and search behaviour

Inactive services are omitted from the collection and hidden behind `404` at the
detail route. When Stripe payments are enabled, a service is also excluded unless
its counsellor has both a connected Stripe account ID and payouts enabled. When
payments are disabled, that payout filter is skipped so local/test discovery is not
emptied by missing provider accounts.

The implemented search behaviour is:

- case-insensitive substring matching across service title and counsellor name;
- trimming surrounding whitespace from a supplied keyword;
- filtering by a modality offered by the service;
- combining keyword and modality in the same request; and
- returning `200` with an empty list when no service matches.

The professional collection follows the same active and payout-listing rule, removes
duplicate owners and orders professionals by overall rating, then display name.

## Detail and profile composition

`GET /api/v1/services/{service_id}` returns service description, price, duration,
modalities, conditional location, service rating aggregates and a smaller counsellor
summary. Live bookable starts remain a separate request because they are recalculated
from availability windows, service duration, bookings and unexpired order holds.

The separate professional profile supplies introduction, background, experience,
qualifications, expertise, languages, LinkedIn, base location, default modality and
professional rating aggregates. A consumer can combine the two public responses
before purchase. The service response itself does not duplicate the complete
professional profile or provide a review-comment list.

Keeping live availability outside the detail representation prevents a cached
service response from claiming that a time remains available after another order has
placed a hold.

## Known acceptance gaps

The title of task #111 is broader than the implemented backend query. The server
supports keyword and modality, but it does not accept minimum/maximum price or rating
parameters. Service sorting and pagination are also absent.

An unsupported modality such as `telepathy` currently returns `200` with an empty
list rather than `400 VALIDATION_ERROR`. The strict invalid-modality regression
remains a documented XFail because the OpenAPI enum is not enforced by the router's
plain string query parameter.

`averageRating`, `overallRating` and `reviewCount` are exposed, but these endpoints do
not implement review submission or a public review-comment collection. Therefore the
presence of rating fields does not by itself complete every US-46 acceptance
criterion. Parent stories #41–43 remain open and require full product acceptance.

## Verification and QA handoff

From `backend/` on the integrated `dev` revision, using the locked dependencies:

```bash
uv sync --locked
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest \
  tests/test_api.py \
  tests/test_counsellor_profile_details.py \
  tests/test_sprint2_acceptance_regressions.py -q
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest \
  tests -m "not live" --cov=app
uv run --no-sync ruff check app tests reset_db.py
```

Backend coverage includes active/inactive visibility, keyword and modality filtering,
combined and empty results, service detail, public professional data, derived starts
and payout-listing eligibility. The strict XFail cases above remain failures for
their documented reasons and must not be counted as passing acceptance evidence.

Frontend rendering, native-device interaction, client sign-off and external Stripe
acceptance are outside this backend verification boundary.

## Integration verification — 19 September 2026

- The dated QA baseline at `8aa2428` recorded **564 passed, 15 strict XFail and
  7 deselected** against PostgreSQL.
- [Application CI run 35414587950](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/runs/35414587950)
  completed all seven jobs successfully for `dev` commit `33027e0`, including the
  backend PostgreSQL and coverage job.
- This documentation change did not rerun the suite locally. The linked results are
  repository integration evidence, not a new local execution claim.

## Documentation assistance disclosure

Codex was used on 19 September 2026 to inspect the backend schemas, routers,
availability logic, tests, linked issues and CI metadata and to help draft and verify
this document. It was used to improve traceability and identify mismatches, not to
invent implementation or test results. Human review remains required before
submission.
