# US-42 and US-43 frontend: My sessions, cancellation and receipts

Issues: [US-42 #37](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/37) and
[US-43 #38](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/38). No front-end
sub-issue exists. Cancellation and receipts have no story: the backlog's Epic H client note makes
automated cancellation and refunds lower priority, US-47 defers refunds and cancellation fees, and
US-69 leaves cancellation and refund policy open. Both follow the
[payments spec](../../payment/stripe-payment-spec.md) §10 and §11.

This slice gives both Job Seekers and Career Professionals one "My sessions" screen listing upcoming
and past bookings, with a join link for online sessions, a Cancel action on upcoming ones, and a
receipt for each booking. It reached `dev` on 18 September 2026 in
[PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157), with the bottom-bar
entries added the same day, built during Sprint 2 alongside the committed stories. US-42 and US-43
sit in the Product Backlog column, not Sprint 2, and none of this is claimed as accepted. US-42 notes
that a Job Seeker bookings list is not a story in the active backlog; this screen serves both roles.

## Screens and flow

| Route | File | What the user sees |
|---|---|---|
| `/bookings` | [`app/bookings/index.tsx`](../../../frontend/app/bookings/index.tsx) | "My sessions": Coming up and Past sections of booking cards. |
| `/bookings/{bookingId}` | [`app/bookings/[bookingId]/index.tsx`](../../../frontend/app/bookings/[bookingId]/index.tsx) | US-43 — one booking's own detail: participants, service, time, pre-session brief, and the meeting link or address. |
| `/bookings/receipt?bookingId=…` | [`app/bookings/receipt.tsx`](../../../frontend/app/bookings/receipt.tsx) | A receipt or tax invoice for one booking. |

Entry points: the Bookings tab in the Job Seeker bottom bar (a guest is sent to log in) and in the
Career Professional bottom bar; "My sessions" in the account sheet (not offered to a Platform Owner);
and the "My sessions" card on the Career Professional workspace. Each card's summary row (avatar,
title, status) opens the booking's detail screen; "View receipt" opens the receipt directly instead.
The detail screen's back action returns to `/bookings`.

## Behaviour and states

- **Guard and loading:** a spinner shows while the session restores and until the first answer.
  With no session the screen replaces itself with `/auth/login`. Pull-to-refresh re-reads the list.
- **Sections:** two tabs, Coming up and Past, both always shown regardless of which has data (US-42
  client feedback — a hidden section read as unclear, not as "confirmed empty"). Coming up holds
  bookings that are not `cancelled` or `refunded` and start in the future, soonest first; Past holds
  the rest, in the server's order (latest start first). Coming up is selected by default. A tab with
  nothing in it says so explicitly ("Nothing booked yet" / "No past sessions") rather than appearing
  blank.
- **Card:** initials, service title, "With <name>" for a Job Seeker or "For <name>" for a Career
  Professional, a status tag (Confirmed, Completed, Paid out, Cancelled or Refunded), date and time
  range with an explicit device-timezone label (US-42), modality, the service's `meetingArea` if any,
  and the price in whole dollars. On an upcoming booking, "Before the session" shows the Job Seeker's
  `preSessionBrief` (US-42/US-43) to both roles, when one was given.
- **Joining:** an upcoming booking with a `meetingUrl` shows "Join the session", which hands the URL
  to `Linking.openURL`. An upcoming in-person booking shows "Your Career Professional confirms the
  exact meeting point before the session." to either role, on the card.
- **Booking detail (US-43):** tapping a card's summary row opens `/bookings/{bookingId}`. The same
  participant, service, time-with-timezone and pre-session-brief information as the card, plus
  delivery: online repeats "Join the session"; in-person shows the service's general area and, once
  the delivering Career Professional has added one, the specific `meetingAddress`. Missing either
  shows a clear sentence rather than an empty field ("A meeting link hasn't been set up yet." /
  "You haven't added a specific meeting address yet." for the Career Professional, "Your Career
  Professional hasn't added a specific address yet." for the Job Seeker). Only the delivering Career
  Professional, and only on an upcoming in-person booking, gets "Add address" / "Edit address", opening
  an inline `Field` and Save; success updates the screen and flashes "Meeting address saved". A load
  failure shows the error banner with "Try again".
- **Cancelling:** upcoming cards have Cancel. A confirmation sheet asks "Cancel this session?" with
  "Cancelling more than 24 hours before the session refunds it in full." and Keep it / Cancel
  session. The request sends `reason: null`; the button reads "Cancelling" meanwhile. Success shows
  "Cancelled — $X refunded" when money was returned, otherwise "Session cancelled", then reloads.
  Failure, such as `409` "This booking has already been cancelled.", shows the banner.
- **Empty and error:** with no upcoming bookings, "Nothing booked yet" and role-specific text; a Job
  Seeker also gets "Browse Career Professionals". The Past tab, empty, instead reads "No past sessions"
  / "Sessions you've completed will appear here." — no CTA, nothing to act on. A failed read sets the
  list to empty, so the error banner and whichever tab's empty state show together.
- **Receipt:** a spinner until the receipt arrives, or the error banner. The sheet shows "Tax
  invoice" or "Receipt", the receipt number, issue date, From (the Career Professional as supplier),
  ABN on a tax invoice, To (the Job Seeker), service, session date and time, "Total paid" as
  `AUD $x.xx`, and either "Includes GST of …" or "No GST has been charged on this supply."

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.createOrder(…, preSessionBrief, token)` | `POST /orders` | US-42 — `preSessionBrief` is optional (trimmed server-side, 500 chars), collected on the slot-selection screen before payment and frozen on the order. |
| `api.listMyBookings` | `GET /me/bookings` | Bookings where the caller is the Job Seeker or the Career Professional, with the other party's name and role, and `preSessionBrief` read back from the order. |
| `api.getBooking(id)` | `GET /bookings/{id}` | US-43 — one booking's detail. Participants only; a non-participant gets `404` "Booking not found." (existence itself is not something a stranger is entitled to know). |
| `api.updateBookingMeetingAddress(id, address)` | `PATCH /bookings/{id}/meeting-address` | US-43 — only the delivering Career Professional (`403` for the Job Seeker or anyone else who can still see the booking); trimmed server-side, 300 chars, `null`/empty clears it. |
| `api.cancelBooking(id, reason)` | `POST /bookings/{id}/cancel` | Participants only; anyone else gets `404` "Booking not found.". `409 INVALID_STATE_TRANSITION` if already cancelled; `502 PAYMENT_PROVIDER_ERROR` if Stripe fails. Returns the booking and `refundedMinor`. |
| `api.getBookingReceipt(id)` | `GET /bookings/{id}/receipt` | Participants only (`404` otherwise). Built from the order's frozen snapshot in the Career Professional's name. |

Refund policy is the backend's: a Career Professional's cancellation always refunds in full; a Job
Seeker's refunds in full at least `cancellation_full_refund_hours` (24) before the start, otherwise
`cancellation_late_refund_percent` (0 by default). A stub-paid booking reports no refund, because no
money was taken.

## Acceptance criteria

| Criterion (story) | Frontend behaviour | Evidence |
|---|---|---|
| Upcoming shows service, Job Seeker, modality, time with timezone and pre-session brief (US-42) | Service, name, modality, local time with an explicit device-timezone label, and (when given) "Before the session" with the brief | `counsellor-bookings.test.tsx` AT-US-42-1; backend `test_a_pre_session_brief_is_trimmed_and_shown_to_both_parties`; checked live in a browser |
| A booking whose time has passed appears under Past only (US-42) | Start time compared with the device clock; the brief is not shown on a past booking | `counsellor-bookings.test.tsx` AT-US-42-2 |
| No bookings shows an empty state without an error (US-42) | "Nothing booked yet" | `counsellor-bookings.test.tsx` |
| Another user's token never returns this Career Professional's bookings (US-42) | The app sends only the caller's own token | Backend `test_a_counsellor_sees_their_own_bookings_and_a_job_seeker_sees_theirs`, `test_a_stranger_cannot_see_or_cancel_a_booking`, `test_the_list_holds_only_the_callers_own_bookings`; `counsellor-bookings.test.tsx` AT-US-42-3 |
| Backend unreachable shows an error state, not an empty list (US-42) | Banner shown, but with the empty state beneath it | `counsellor-bookings.test.tsx` AT-US-42-4 |
| Upcoming online booking shows service, Job Seeker, time with timezone, pre-session brief and the meeting link, opening outside the app (AT-US-43-1) | `/bookings/{bookingId}`: all of the above; "Join the session" hands the URL to `Linking.openURL` | `booking-detail.test.tsx` AT-US-43-1; checked live in a browser |
| Upcoming in-person booking shows the meeting address instead of a link (AT-US-43-2) | The service's general area plus the specific `meetingAddress`, with "Add address" / "Edit address" for the delivering Career Professional only | `booking-detail.test.tsx` AT-US-43-2; backend `test_the_counsellor_adds_an_address_and_both_parties_read_it_back`, `test_only_the_delivering_counsellor_can_set_the_address`; checked live in a browser |
| A non-participant is rejected and gets no delivery information (AT-US-43-3) | `getBooking` and `updateBookingMeetingAddress` both go through participant/owning-counsellor checks | Backend `test_a_stranger_cannot_see_or_cancel_a_booking`, `test_a_stranger_cannot_set_or_see_the_address`; `booking-detail.test.tsx` AT-US-43-3 |
| No link or address recorded shows a not-yet-provided state | A specific sentence for each case and role, never an empty field | `booking-detail.test.tsx` ("AC4", and the Job-Seeker-facing no-address case); backend `test_a_confirmed_booking_has_no_address_until_the_counsellor_adds_one` |
| Cancellation refunds per policy (spec §10) | Confirm sheet, then the refunded amount returned by the server | `payments/client.test.ts` "cancelling a booking sends the reason the person gave"; backend `test_cancelling_well_before_the_session_refunds_in_full`, `test_a_late_job_seeker_cancellation_follows_the_configured_policy`, `test_a_counsellor_cancelling_always_refunds_the_job_seeker_in_full`, `test_a_booking_cannot_be_cancelled_twice`, `test_cancelling_a_stub_booking_does_not_claim_a_refund_that_never_happened`. Screen: Not covered |
| Receipt in the Career Professional's name; tax invoice with ABN and GST only when GST-registered (spec §11) | Label, ABN row and GST line switch on `isTaxInvoice` | `payments/client.test.ts` "getBookingReceipt reads the authenticated booking with an escaped identifier"; backend `test_a_gst_registered_counsellor_issues_a_tax_invoice_in_their_own_name`, `test_an_unregistered_counsellor_issues_a_receipt_with_no_gst_line`, `test_a_receipt_reflects_the_snapshot_not_the_counsellors_current_settings`. Screen: Not covered |

## Tests

- [`__tests__/payments/client.test.ts`](../../../frontend/__tests__/payments/client.test.ts): the receipt
  and booking reads (escaped identifier, bearer token) and the cancel request body.
- [`__tests__/auth/refreshOn401.test.ts`](../../../frontend/__tests__/auth/refreshOn401.test.ts) uses
  `listMyBookings` to test token renewal on `401`: 6 cases.
- [`__tests__/screens/counsellor-bookings.test.tsx`](../../../frontend/__tests__/screens/counsellor-bookings.test.tsx):
  screen-level coverage of `bookings/index.tsx` for US-42's four acceptance criteria (tagged
  AT-US-42-1 through 4) plus the empty state and the brief's upcoming-only, counsellor-only display.
- [`__tests__/screens/timeslots.test.tsx`](../../../frontend/__tests__/screens/timeslots.test.tsx): the
  pre-session brief field appears only once a time is chosen, and is trimmed and sent with the order.
- [`__tests__/api/client.test.ts`](../../../frontend/__tests__/api/client.test.ts): `createOrder` sends
  a given pre-session brief.
- [`__tests__/screens/booking-detail.test.tsx`](../../../frontend/__tests__/screens/booking-detail.test.tsx):
  AT-US-43-1 through 3, the not-yet-provided states for both delivery modes and both roles, adding and
  editing the address, that only the delivering Career Professional gets edit controls, load failure
  with retry, and back navigation.
- [`backend/tests/test_booking_detail.py`](../../../backend/tests/test_booking_detail.py): the address
  round trip (added, read by both parties, updated, cleared), the owning-counsellor-only check, the
  404 for a stranger, the 300-char limit, and the existing meeting link confirmed in the detail view
  too.
- No Jest test renders `bookings/receipt.tsx`, and no Playwright spec or device run opens either
  screen. The Playwright case "US40/41/47/68 real browser booking to stub receipt" checks the stub
  payment response and the confirmation screen, not this receipt screen. The 16 September simulator
  smoke predates PR #157.

Local run on `dev` at `64cb324`, 18 September 2026: `payments/client.test.ts` 9 passed and
`refreshOn401.test.ts` 6 passed. Backend on its temporary SQLite database, 11 passed with:

```bash
pytest tests/test_payments.py -k "cancel or receipt or own_bookings or stranger"
```

The pre-session brief and timezone label landed later: full suites green (backend 582 passed; frontend
45 suites / 367 tests), `tsc --noEmit` and `eslint` clean, and checked live against a local backend —
a Job Seeker's booking (with a typed brief) read back correctly on the Career Professional's My
Bookings, timezone label included.

The booking detail screen (US-43) landed after that: full suites green (backend 589 passed; frontend
46 suites / 379 tests), `tsc --noEmit` and `eslint` clean. Checked live against a local backend: a Job
Seeker booked a Career Professional in person with a pre-session brief; the Career Professional opened
the booking from My Bookings, added a specific meeting address, and the Job Seeker's own detail view
showed that exact address and the brief, with no edit controls on their side.

## Known gaps

- The cancel sheet's 24-hour wording is fixed text. It ignores `cancellationFullRefundHours` and
  `cancellationLateRefundPercent` from `GET /payments/config`, says nothing about a late cancellation,
  and is shown to Career Professionals, whose cancellations always refund in full.
- No cancellation reason is collected, though the API accepts one. Client approval of the refund
  settings is not recorded; the [Sprint 2 review](../client-feedback/sprint-2-review-and-client-feedback.md)
  keeps automated refunds deferred.
- No reschedule (US-69), and no order-linked messaging or in-app video call — both explicitly out of
  US-43's own scope.
- The card's in-person note ("Your Career Professional confirms the exact meeting point before the
  session.") is still shown to both roles and still doesn't reflect whether an address has actually
  been added yet; only the detail screen distinguishes that. It is also still addressed to a Job
  Seeker but shown to the Career Professional too.
- Card prices and the cancel toast use whole dollars, so a price with cents is rounded; the receipt
  shows cents.
- The in-person note is addressed to a Job Seeker but also shown to the Career Professional.
- The receipt screen spins indefinitely without a `bookingId` or a session; it does not redirect.
- The receipt has no share, download or email action, and the response's `text` field is unused.
