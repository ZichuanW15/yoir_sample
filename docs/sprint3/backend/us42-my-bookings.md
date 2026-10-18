# US-42 backend: the bookings list, scoped to the caller

Issues: back-end sub-issue [#203](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/203),
under [US-42 #37](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/37).

`GET /me/bookings` returns every booking the caller is a party to, each naming the other person. A
Career Professional gets the sessions they deliver, which is what US-42 asks for. A Job Seeker gets
the sessions they bought from the same endpoint, because the "My sessions" screen serves both roles.
The endpoint reached `dev` on 18 September 2026 in
[PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157) (commit `70232ce`).
Sprint 3 added the Job Seeker's pre-session brief: Ariz stored it on the order and returned it on each
booking in commit `c53bd0b`, pushed to `dev` on 7 October 2026 without a pull request.
[PR #239](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/239) (14 October) added
the buyer's review to each booking ([US-53](us53-us55-reviews-and-ratings.md)). The screen is
documented in [US-42 frontend](../frontend/us42-my-bookings.md).

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 32, 37, 57
and 58.

## Endpoints and flow

| Endpoint | Code | What it does |
|---|---|---|
| `GET /me/bookings` | `list_bookings` in [`app/routers/bookings.py`](../../../backend/app/routers/bookings.py) | Every booking where the caller is the Job Seeker or the Career Professional, latest session first. |
| `POST /orders` | `create_order` in the same file | Takes the optional `preSessionBrief` and freezes it on the order. |
| `GET /bookings/{bookingId}` | `get_booking` in the same file | One of those bookings on its own, for a party to it ([US-43](us43-us69-booking-detail-and-reschedule.md)). |

Flow: the Job Seeker chooses a time, types an optional brief and places the order. Once payment
confirms it, the booking appears in both parties' lists with the brief.

## Behaviour and states

- **Scope:** the query keeps bookings where `job_seeker_id` or `counsellor_id` is the caller. Nothing
  else is returned, whatever the role. A Platform Owner is party to no booking and gets an empty list.
  No session is `401`.
- **Order:** `startsAt` descending. Splitting into Coming up and Past is done by the app.
- **Each booking carries:**
  - the service title as purchased, frozen on the order ([US-36](us36-service-edit-and-removal.md));
  - start, end and the booking's `timezone`;
  - modality, status, payment status, amount and any refund;
  - the other party's name and role, worked out from the caller's side;
  - the meeting link for an online session, or the meeting area for an in-person one;
  - the specific meeting address once the Career Professional adds it (US-43);
  - `preSessionBrief`, empty when none was given;
  - the buyer's `review` once written (US-53).
- **Brief:** optional. Trimmed on the way in; a blank one is stored as `null` and returned as `""`.
  More than 500 characters is `400 VALIDATION_ERROR`, and no order is created. Nothing can change it
  after the order is placed, so both parties read what the Career Professional first saw.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listMyBookings` | `GET /me/bookings` | Only the caller's own bookings. |
| `api.createOrder(serviceId, startsAt, modality, timezone, preSessionBrief, token)` | `POST /orders` | `preSessionBrief` is `null` or up to 500 characters. |

## Acceptance criteria

| Criterion | Backend behaviour | Evidence |
|---|---|---|
| Upcoming shows each booking's service, Job Seeker, modality, time with timezone and pre-session brief | All returned on each booking | `test_each_party_sees_the_other_one_named`, `test_a_pre_session_brief_is_trimmed_and_shown_to_both_parties`, `test_an_online_booking_carries_its_room_to_both_parties`, `test_an_in_person_booking_carries_the_meeting_area_instead` |
| A booking whose time has passed appears under Past, not Coming up | Start and end times returned, latest first; the split is the app's | `test_bookings_come_back_newest_session_first`; the split is frontend AT-US-42-2 |
| No bookings shows an empty state without an error | `200` with an empty list | Not covered on the back end; frontend AC3 |
| Another user's token never returns this Career Professional's bookings | Scoped to the caller in the query | `test_the_list_holds_only_the_callers_own_bookings`, `test_a_counsellor_sees_their_own_bookings_and_a_job_seeker_sees_theirs`, `test_a_stranger_cannot_see_or_cancel_a_booking`, `test_the_list_needs_a_session` |
| Back end unreachable shows an error state rather than an empty list | Frontend criterion | See [US-42 frontend](../frontend/us42-my-bookings.md), AT-US-42-4 |

## Tests

- [`tests/test_my_bookings.py`](../../../backend/tests/test_my_bookings.py): 9 tests, including
  `test_a_booking_made_without_a_pre_session_brief_reads_as_empty` and
  `test_a_single_booking_also_names_the_other_party`.
- [`tests/test_payments.py`](../../../backend/tests/test_payments.py):
  `test_a_counsellor_sees_their_own_bookings_and_a_job_seeker_sees_theirs`,
  `test_a_stranger_cannot_see_or_cancel_a_booking` and
  `test_a_pre_session_brief_over_the_limit_is_rejected`.

Run from `backend/`:

```bash
env -u DATABASE_URL uv run pytest tests/test_my_bookings.py tests/test_payments.py -q \
  -k "test_my_bookings or own_bookings or stranger_cannot_see or brief_over_the_limit"
```

Local run on `dev` at `a6eeb35`, 18 October 2026, Python 3.12.14, temporary SQLite database: 13 passed.

## Known gaps

- No paging: the whole history comes back in one response.
- Every status is returned, including cancelled and refunded; the app decides what goes in each tab.
- No back-end test for an empty list, or for a Platform Owner's empty list.
- The brief cannot be edited after the order is placed; no story asks for that.
- `timezone` is the zone the Job Seeker's device reported when ordering. The app labels each time in
  the viewer's own zone instead, so the field is returned but not shown.
