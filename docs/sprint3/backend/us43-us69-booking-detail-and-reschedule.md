# US-43 and US-69 backend: booking detail and rescheduling

Issues: back-end sub-issues [#206](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/206)
and [#224](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/224), under
[US-43 #38](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/38) and
[US-69 #40](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/40).

This slice covers what either party sees when they open one booking, and moving a confirmed booking
to another open time without creating a second order. The booking detail route came from Sprint 2's
[PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157). In Sprint 3 it
gained the pre-session brief and timezone (commit `c53bd0b`, 7 October 2026) and the Career
Professional's meeting address (commit `de52c29`, 8 October 2026). Rescheduling reached `dev` in
commit `06c5446` on 8 October 2026. All three Sprint 3 commits were pushed to `dev` directly rather
than through a pull request.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 33, 36,
58, 59 and 60. The Sprint 2 [My Sessions frontend document](../../sprint2/frontend/us42-us43-my-sessions-cancellation-and-receipts.md)
describes the screens before these additions.

## Endpoints and flow

| Endpoint | Code | What it does |
|---|---|---|
| `GET /bookings/{bookingId}` | `get_booking` in [`app/routers/bookings.py`](../../../backend/app/routers/bookings.py) | US-43: one booking as one of its two parties sees it. |
| `PATCH /bookings/{bookingId}/meeting-address` | `set_booking_meeting_address` in the same file | US-43: the delivering Career Professional sets or clears the in-person meeting point. |
| `POST /bookings/{bookingId}/reschedule` | `reschedule_booking` in the same file | US-69: moves the booking and its order to a new start time and modality. |
| `GET /services/{serviceId}/slots` | `list_service_slots` in [`app/routers/services.py`](../../../backend/app/routers/services.py) | US-40: the open starts the app offers when rescheduling. |

Flow: a party opens a booking from My Bookings. For an in-person session the Career Professional adds
the meeting address once it is known. Either party can tap Reschedule, pick an open start from the
slots list, and confirm; the booking then shows the new time.

## Behaviour and states

**Booking detail (US-43)**

- **Who can read it:** only the Job Seeker who bought it and the Career Professional delivering it.
  Anyone else gets `404 NOT_FOUND`, the same as for a booking that does not exist, so no delivery
  information is returned and the ID's existence is not revealed.
- **What it carries:** service title, start and end, the booking's timezone, modality, status, the
  other party's name and role, the pre-session brief (empty if none was given), and delivery details:
  `meetingUrl` for an online session; `meetingArea` (the service's state and city) and
  `meetingAddress` for an in-person one.
- **Meeting address:** only the delivering Career Professional may set it; the Job Seeker party gets
  `403`. At most 300 characters, trimmed; an empty value clears it. Until it is set, `meetingAddress`
  is `""`, which the app shows as not yet provided.

**Rescheduling (US-69)**

- **Who can reschedule:** either party, through the same participant check as the detail route.
- **What can be rescheduled:** a `confirmed` booking whose session has not started. Anything else is
  `409 INVALID_STATE_TRANSITION`. The new start must be in the future and its modality one the
  service offers (`400`).
- **One transaction, rows locked:** the booking row is locked for the whole call, as cancellation does,
  so a reschedule cannot interleave with a cancel or a second reschedule. The Career Professional's
  row is then locked, as order creation does, so two requests cannot take the same time.
- **The new time must be genuinely free:** it must sit inside one of the Career Professional's
  availability windows that offers the modality, and clash with no other booking or live hold. The
  booking's own current time is excluded from that check, so moving a session by a few minutes into
  its own slot is not mistaken for a clash. Otherwise `409 SLOT_UNAVAILABLE`.
- **Nothing new is created:** the same booking and order rows are updated in place (start, end,
  window, timezone, modality). No payment is retaken and the amount is unchanged. The old time becomes
  free again as soon as the change commits.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getBooking` | `GET /bookings/{bookingId}` | Either party. |
| `api.updateBookingMeetingAddress` | `PATCH /bookings/{bookingId}/meeting-address` | Body `{meetingAddress}`; Career Professional only. |
| `api.listServiceSlots` | `GET /services/{serviceId}/slots` | The choices shown when rescheduling. |
| `api.rescheduleBooking` | `POST /bookings/{bookingId}/reschedule` | Body `{startsAt, modality, timezone}`; `200` with the updated booking. |

## Acceptance criteria

| Criterion | Backend behaviour | Evidence |
|---|---|---|
| US-43: an online booking shows service, Job Seeker, time with timezone, brief and the link | All in `BookingOut` | `test_an_online_booking_carries_its_meeting_link_in_the_detail_view`, `test_a_single_booking_also_names_the_other_party`, `test_a_pre_session_brief_is_trimmed_and_shown_to_both_parties` |
| US-43: an in-person booking shows the address instead of a link | `meetingArea` and `meetingAddress`, no `meetingUrl` | `test_an_in_person_booking_carries_the_meeting_area_instead`, `test_the_counsellor_adds_an_address_and_both_parties_read_it_back`, `test_the_address_can_be_updated_and_cleared` |
| US-43: a non-participant is rejected and gets no delivery information | `404` | `test_a_stranger_cannot_set_or_see_the_address`, `test_only_the_delivering_counsellor_can_set_the_address` |
| US-43: no link or address yet shows a not-yet-provided state | Empty `meetingAddress` | `test_a_confirmed_booking_has_no_address_until_the_counsellor_adds_one` |
| US-69: only the Career Professional's open times are selectable | Slots route; the move is re-checked server-side | `test_rescheduling_outside_every_availability_window_is_rejected` |
| US-69: same order and booking show the new time; old time free; no second order or booking | Updated in place | `test_the_job_seeker_can_reschedule_to_another_open_time` (same IDs, one booking and one order, old time bookable again), `test_reschedule_reflects_in_my_bookings_and_booking_detail`, `test_the_counsellor_can_also_reschedule_a_booking_they_deliver` |
| US-69: a time someone else took first is rejected; the original is kept | `409 SLOT_UNAVAILABLE` | `test_rescheduling_onto_a_slot_someone_else_holds_is_rejected_and_keeps_the_original`; `test_postgresql_concurrent_reschedules_onto_the_same_slot_move_exactly_one` (PostgreSQL only) |
| US-69: a failure part-way leaves exactly one booking on its original time | Single transaction, rolled back on error | Not covered: no test injects a failure mid-reschedule |
| US-69: a non-participant, or a past, cancelled or unconfirmed booking, is rejected | `404`, `409` | `test_a_stranger_cannot_reschedule_someone_elses_booking`, `test_a_past_booking_cannot_be_rescheduled`, `test_a_cancelled_booking_cannot_be_rescheduled`, `test_an_unauthenticated_request_cannot_reschedule`, `test_rescheduling_to_a_time_that_has_already_passed_is_rejected` |

## Tests

- [`tests/test_booking_detail.py`](../../../backend/tests/test_booking_detail.py): 7 tests, the meeting
  address and detail view.
- [`tests/test_my_bookings.py`](../../../backend/tests/test_my_bookings.py): 10 tests, of which the
  detail-view ones are named above.
- [`tests/test_reschedule.py`](../../../backend/tests/test_reschedule.py): 12 tests, including
  `test_a_reschedule_that_partially_overlaps_its_own_current_time_succeeds`. The concurrency test is
  skipped on SQLite and runs in CI's PostgreSQL job.

Run from `backend/`:

```bash
env -u DATABASE_URL pytest tests/test_booking_detail.py tests/test_my_bookings.py tests/test_reschedule.py -q
```

Local run on `dev` at `03978fd`, 16 October 2026, Python 3.12.8, temporary SQLite database: 28 passed,
1 skipped (the PostgreSQL concurrency test).

## Known gaps

- **Rescheduling gets around the late-cancellation rule.** The refund on a Job Seeker's cancellation
  depends on how far away the session is when they cancel. A booking already inside the
  `CANCELLATION_FULL_REFUND_HOURS` window (24 hours by default) can still be rescheduled, because the
  only time check is that it has not started. Checked by hand on `dev` at `03978fd`: a session 3 hours
  away was moved to 5 days away with `200`, after which cancelling counts as outside the window and is
  refunded in full. While `CANCELLATION_LATE_REFUND_PERCENT` is 0 this turns a no-refund cancellation
  into a full refund. Applying the same notice window to rescheduling, or keeping the original start
  for the refund rule, would close it.
- Neither party is told when the other reschedules; there is no email or notification.
- No test covers a failure part-way through a reschedule, or asserts directly that the new time is
  unavailable to others afterwards.
- None of the Sprint 3 changes here went through a pull request review.
