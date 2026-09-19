# US-34–41 backend: services, availability and reservation integrity

Backend tasks: [US-34 #132](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/132),
[US-35 #135](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/135),
[US-37 #138](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/138),
[US-38 #141](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/141),
[US-39 #144](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/144),
[US-40 #117](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/117) and
[US-41 #120](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/120).

This document records the integrated backend contract on `dev` commit `33027e0`,
reviewed on 19 September 2026. The original feature branch introduced service-level
availability slots. Integration replaced them with counsellor-owned availability
windows so every service shares one real calendar.

## Service API contract

| Request | Access and result |
| --- | --- |
| `GET /api/v1/me/services` | Counsellor; all owned services, including inactive rows |
| `POST /api/v1/me/services` | Verified counsellor with verified email; `201` service |
| `PATCH /api/v1/me/services/{service_id}` | Owner; replace the editable service form |
| `DELETE /api/v1/me/services/{service_id}` | Owner; empty `204` after soft deletion |

A representative create or update body is:

```json
{
  "title": "Interview preparation",
  "description": "A structured interview coaching session.",
  "priceMinor": 9500,
  "durationMinutes": 60,
  "currency": "AUD",
  "modalities": ["online", "in_person"],
  "location": {
    "state": "Victoria",
    "cityOrRegion": "Melbourne"
  },
  "meetingUrl": null
}
```

The backend trims title and description before applying their length rules. Price is
an integer in minor currency units and cannot be negative. Duration is 15–480
minutes in 15-minute increments. Currency is `AUD`; modalities are `online` and/or
`in_person`, without duplicates. An in-person service requires a nonblank state and
city or region.

Creating a service requires both Platform Owner verification and verified email.
Editing an existing owned service uses the whole create-service schema. Historical
orders and bookings retain their frozen commercial and time values when the listing
changes. Deletion sets `active=false`; it does not erase the row or its history, and
repeating deletion leaves the same final state.

The owner response includes `meetingUrl`. Public `ServiceOut` deliberately omits it
because a standing meeting-room URL is an access credential rather than public
listing content.

## Availability API contract

| Request | Access and result |
| --- | --- |
| `GET /api/v1/me/availability-windows` | Counsellor; owned windows in start-time order |
| `POST /api/v1/me/availability-windows` | Counsellor; `201` future window |
| `PATCH /api/v1/me/availability-windows/{window_id}` | Owner; move boundaries and optionally modalities |
| `DELETE /api/v1/me/availability-windows/{window_id}` | Owner; `204` only when no live booking remains |
| `GET /api/v1/services/{service_id}/slots` | Public; derived starts for that service |

A window request contains timestamps and the ways the professional can work during
that period:

```json
{
  "startsAt": "2026-10-01T09:00:00+10:00",
  "endsAt": "2026-10-01T12:00:00+10:00",
  "modalities": ["online", "in_person"]
}
```

The start must be in the future and the end must be later than the start. An update
must supply a new `startsAt` or `endsAt`; a modality-only update is not accepted by
the current router. Overlapping or adjacent windows merge only when their modality
sets match. A window reports `hasBookings` so the owner interface can explain why a
destructive edit or deletion is refused.

Foreign and missing service/window identifiers both return `404 NOT_FOUND`. This
avoids revealing whether another counsellor owns a guessed identifier. A window
cannot be shortened past a live booked session and cannot be deleted while one
remains; those operations return `409 SLOT_UNAVAILABLE`.

## Shared-calendar design decision

Availability belongs to the counsellor, not to one service. Public start times are
derived from:

- the counsellor's availability windows;
- the selected service duration;
- the requested modality and the window's supported modalities;
- confirmed, completed and paid-out bookings; and
- unexpired unpaid order holds.

Starts are generated on a 15-minute grid and only when the full service duration fits
inside one suitable window. Booking one service consumes the same time for every
other service owned by that counsellor. This removes the contradictory state where
two service-specific slot rows could both claim the same person's hour.

## Atomic order reservation

`POST /api/v1/orders` requires a verified-email Job Seeker. The backend reads the
service price rather than accepting an amount from the client, calculates `endsAt`
from the stored duration and rejects past starts or unsupported modalities.

The PostgreSQL path locks the counsellor row before checking the shared calendar.
The selected interval must fit inside a suitable window and overlap neither a live
booking nor an unexpired hold. Success creates an awaiting-payment order containing
the service reference and frozen amount, currency, time, timezone, modality and
payment breakdown. A second attempt for the occupied interval returns
`409 SLOT_UNAVAILABLE`.

Service and availability response preparation occurs before commit, with rollback on
failure. The acceptance regression also verifies that a failed booking commit does
not leave a partial order, payment state or hold.

## Known contract gap

`CreateServiceRequest` does not currently set Pydantic `extra="forbid"`. An unknown
request property can therefore be silently dropped while the service is persisted.
The strict `S2-BE-SERVICE-EXTRAS` regression remains an XFail. This document does not
claim that unknown service fields are rejected or that all US-35 acceptance criteria
have passed.

Editing and withdrawing services are present in the integrated router for US-36, but
their separately assigned story retains its own acceptance ownership. Payment
configuration can also hide services whose counsellor cannot receive a payout.

## Verification and QA handoff

From `backend/` on the integrated `dev` revision, using the locked dependencies:

```bash
uv sync --locked
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest \
  tests/test_counsellor.py \
  tests/test_sprint2_counsellor_acceptance.py \
  tests/test_sprint2_acceptance_regressions.py \
  tests/test_api.py -q
env -u DATABASE_URL -u YOIR_QA_ALLOW_DATABASE_RESET uv run --no-sync pytest \
  tests -m "not live" --cov=app
uv run --no-sync ruff check app tests reset_db.py
```

SQLite is suitable for isolated behaviour tests. Concurrent reservation and database
locking claims require the QA-controlled PostgreSQL database whose name ends in
`_test`, together with explicit reset consent. Never point the destructive fixture
harness at a shared development or deployed database.

Coverage includes role and ownership guards, validation, rollback, window merging,
modality-specific availability, derived starts, booking-protected edits, expired
holds and concurrent attempts for one counsellor calendar. Device interaction and
client acceptance remain outside this backend evidence.

## Integration verification — 19 September 2026

- The dated QA run at `8aa2428` collected **94 cases** across the two Sprint 2
  backend suites; its repeated PostgreSQL run recorded **90 passed and 4 strict
  XFail**.
- The same baseline's full PostgreSQL backend suite recorded **564 passed,
  15 strict XFail and 7 deselected**.
- [Application CI run 35414587950](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/actions/runs/35414587950)
  completed all seven jobs successfully for `dev` commit `33027e0`.
- This documentation change did not rerun the suite locally. The linked results are
  repository integration evidence, not a new local execution claim.

Backend completion supports but does not by itself close the parent stories or prove
frontend, native-device, external-payment or client acceptance.

## Documentation assistance disclosure

Codex was used on 19 September 2026 to inspect the backend model, schema, routers,
availability logic, tests, linked issues and CI metadata and to help draft and verify
this document. It was used to improve traceability and identify mismatches, not to
invent implementation or test results. Human review remains required before
submission.
