# US-43 and US-69 frontend: booking detail and rescheduling

Issues: front-end sub-issues [#205](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/205)
and [#223](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/223), under
[US-43 #38](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/38) and
[US-69 #40](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/40).

In Sprint 2 a booking was only a card in My sessions. US-43 adds a detail screen for one booking,
opened from the card, where the Career Professional can add the exact meeting address for an
in-person session. US-69 adds Reschedule to that screen: either party can move a confirmed upcoming
booking to another open time, on the same order. US-43 reached `dev` directly on 8 October 2026 in
commit `de52c29`, and US-69 the same day in commit `06c5446`, both with no pull request. The back end
is in [US-43 and US-69 backend](../backend/us43-us69-booking-detail-and-reschedule.md), and the list
the detail opens from is [US-42](us42-my-bookings.md).

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 33, 36 and
58–60. The walkthrough was captured on 8 October, before rescheduling reached `dev`, so it has no
US-69 screens.

## Screens and flow

| Route | File | What the user sees |
|---|---|---|
| `/bookings/[bookingId]` | [`app/bookings/[bookingId]/index.tsx`](../../../frontend/app/bookings/[bookingId]/index.tsx) | New. "Booking details": who, when, the brief, and how to join or where to meet. |
| `/bookings/[bookingId]/reschedule` | [`app/bookings/[bookingId]/reschedule.tsx`](../../../frontend/app/bookings/[bookingId]/reschedule.tsx) | New. "Reschedule": pick another open time and confirm. |

Flow: My sessions → a card's summary row ("<service>, booking details") → the detail → Reschedule →
a time → "Confirm new time" → back on the same booking's detail with the new time. Back from the
detail replaces it with `/bookings`, so the list is read again. Only the summary row opens the detail,
so View receipt, Cancel and Write a review stay separate buttons for screen readers.

## Behaviour and states

### Booking detail (US-43)

- **Loading and guard:** a spinner until the booking arrives; with no session, `/auth/login`.
- **Head:** initials, service title, "With <name>" for a Job Seeker or "For <name>" for a Career
  Professional, and the status tag in the list's wording (Confirmed, Completed, Paid out, Cancelled,
  Refunded). Then "<date> · <time range> · <device timezone>" and the modality.
- **Brief:** "Before the session" with the Job Seeker's brief, shown to both parties whenever one was
  given, past bookings included.
- **Online ("Joining online"):** "Join the session" opens the link outside the app through
  `Linking.openURL`. With no link: "A meeting link hasn't been set up yet."
- **In person ("Where to meet"):** "General area: <area>" when the service has one, then the specific
  address. Until it is added: "You haven't added a specific meeting address yet." for the Career
  Professional, "Your Career Professional hasn't added a specific address yet." for the Job Seeker.
- **Adding the address:** only the Career Professional, and only on an upcoming in-person booking, sees
  "Add address", or "Edit address" once there is one. It opens the field "Meeting address" (placeholder
  "e.g. Level 4, 123 Collins St, Melbourne", up to 300 characters) with Cancel and "Save address". The
  address is trimmed and an empty one is sent as `null`, which clears it. On success the screen shows
  the booking the back end returns and the toast "Meeting address saved". On failure the error shows
  under the field and the draft is kept.
- **Failed read:** the error banner and "Try again", with nothing of the booking shown. Someone not on
  the booking gets the back end's "Booking not found.".
- **Reschedule** shows on an upcoming booking whose status is Confirmed.

### Rescheduling (US-69)

- **Eligibility:** the screen reads the booking first. Only a confirmed upcoming booking goes on to read
  the open times for the same service, in the booking's own delivery method. Otherwise it shows "This
  session can't be rescheduled", "Only an upcoming, confirmed session can be moved to a new time." and
  "Back to booking", and asks for no times.
- **Booking not readable:** the error, for example "Booking not found.", or "That booking is not
  available.", and no picker.
- **Picker:** "Pick a new time" and "Currently <date>, <time range>. Choose another open time for
  <service> with <name>." Times are grouped by day as radio rows with the range and length, under
  "Times are shown in your device timezone (<zone>).". With none: "No open times right now. Try again
  later."
- **Confirm:** "Confirm new time" is disabled until a time is chosen; the footer then shows the chosen
  day and range. The button stays busy for at least `RESERVE_MS` while the request runs.
- **Success:** the toast "Session rescheduled", then the same booking's detail, read again.
- **Failure,** for example `409` "This time is no longer available.": the choice is cleared, the
  booking and times are read again, and the error shows above the times. The move is never shown as
  done.
- Either party can reschedule. The delivery method cannot be changed: the request sends the booking's
  own.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getBooking(id)` | `GET /bookings/{id}` | Detail and reschedule. Participants only; anyone else gets `404`. |
| `api.updateBookingMeetingAddress(id, address)` | `PATCH /bookings/{id}/meeting-address` | New. `{meetingAddress}`, `null` clears it. The delivering Career Professional only; `403` for the Job Seeker. 300 characters. |
| `api.listServiceSlots(serviceId, modality)` | `GET /services/{serviceId}/slots?modality=` | The US-40 open times, reused for the picker. |
| `api.rescheduleBooking(id, startsAt, modality, timezone)` | `POST /bookings/{id}/reschedule` | New. `{startsAt, modality, timezone}` with the device's zone. `409 SLOT_UNAVAILABLE` when the time is taken, `409 INVALID_STATE_TRANSITION` when the booking is not eligible. Returns the booking, same id. |

Booking ids are escaped with `encodeURIComponent`.

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| US-43: an online booking shows service, Job Seeker, time with timezone, brief and the link, which opens outside the app | Detail head, brief card, "Join the session" | `booking-detail.test.tsx` AT-US-43-1; walkthrough 33, 58 |
| US-43: an in-person booking shows the meeting address instead of a link | General area and the address; Career Professional adds or edits it | AT-US-43-2, "an existing address can be edited", "a Job Seeker sees the address once added, but has no edit controls"; walkthrough 36, 59, 60 |
| US-43: a non-participant is rejected and gets no delivery information | Error only; no booking content | AT-US-43-3; back end `test_a_stranger_cannot_set_or_see_the_address` |
| US-43: no link or address recorded shows a not-yet-provided state | A sentence for each case and role | "AC4: a confirmed online booking with no link recorded…", AT-US-43-2, "a Job Seeker with no address yet sees a Career-Professional-facing message instead"; back end `test_a_confirmed_booking_has_no_address_until_the_counsellor_adds_one` |
| US-69: either party taps Reschedule and sees only that Career Professional's open times | Reschedule on the detail; the picker shows the service's open times | `reschedule.test.tsx` "an upcoming confirmed booking offers Reschedule, which opens the picker for that booking", AT-US-69-1, "the counsellor delivering the session can reschedule it too" |
| US-69: the same order and booking show the new time; old time free, new time taken; no second order or booking | Returns to the same booking's detail and reads it again | AT-US-69-1 (request body, same booking id); back end `test_the_job_seeker_can_reschedule_to_another_open_time`, `test_reschedule_reflects_in_my_bookings_and_booking_detail` |
| US-69: a time someone else took first is rejected; the original is kept; the move is not shown as done | Error shown, choice cleared, booking and times read again | AT-US-69-2; back end `test_rescheduling_onto_a_slot_someone_else_holds_is_rejected_and_keeps_the_original` and the PostgreSQL concurrency test |
| US-69: a failure part-way leaves exactly one booking on its original time | Any failure re-reads the booking rather than assuming | Back end, one transaction. Not covered: no test injects a failure part-way |
| US-69: a non-participant, or a past, cancelled or unconfirmed booking, is rejected and unchanged | No picker on the screen; the back end refuses the request | AT-US-69-3 (cancelled, past, non-participant), "a cancelled booking offers no Reschedule action"; back end `test_a_stranger_cannot_reschedule_someone_elses_booking`, `test_a_past_booking_cannot_be_rescheduled`, `test_a_cancelled_booking_cannot_be_rescheduled` |

## Tests

- [`__tests__/screens/booking-detail.test.tsx`](../../../frontend/__tests__/screens/booking-detail.test.tsx),
  9 tests: AT-US-43-1 to 3, the not-yet-provided states for both delivery methods and both roles,
  adding and editing the address (with the request body), load failure with Try again, and back.
- [`__tests__/screens/reschedule.test.tsx`](../../../frontend/__tests__/screens/reschedule.test.tsx),
  8 tests: AT-US-69-1 to 3, the Career Professional rescheduling, and the Reschedule action on the
  detail screen.
- [`__tests__/screens/counsellor-bookings.test.tsx`](../../../frontend/__tests__/screens/counsellor-bookings.test.tsx):
  "US-43: tapping a booking opens its detail screen".
- [`__tests__/payments/client.test.ts`](../../../frontend/__tests__/payments/client.test.ts): `getBooking`
  escapes the id and sends the bearer token. `updateBookingMeetingAddress` and `rescheduleBooking`
  have no client-level test; the screen tests check their request bodies.
- No Playwright spec or device run opens either screen.

Run from `frontend/`: `npx jest __tests__/screens/booking-detail.test.tsx __tests__/screens/reschedule.test.tsx`.
Local run on `dev` at `0df4068`, 17 October 2026, Node 22.14.0: 17 passed (9 and 8).

## Known gaps

- **A failed read of open times looks like none:** if `GET /services/{id}/slots` fails, for example
  `404` for a service withdrawn since the booking (US-36), the picker says "No open times right now.
  Try again later." and the error is not shown. The US-40 picker got this fix on 14 October
  (`800e63d`); the reschedule picker did not.
- **Small moves are not offered:** the open-times list counts this booking as busy, so a start that
  overlaps its current time never appears, though the back end accepts such a move.
- **Late-cancellation rule:** a session inside the 24-hour refund window can be rescheduled further out
  and then cancelled for a full refund. See the [back-end document](../backend/us43-us69-booking-detail-and-reschedule.md).
  The app gives no notice either.
- The delivery method cannot be changed while rescheduling, and neither party is told when the other
  reschedules.
- The My sessions card still says "Your Career Professional confirms the exact meeting point before
  the session." to both roles, whether or not an address has been added.
- Times show in the viewer's device zone, not the booking's stored `timezone`.
- No US-69 screenshots, and no iOS or Android recording, which the issue asks for.
