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
| `/bookings/receipt?bookingId=…` | [`app/bookings/receipt.tsx`](../../../frontend/app/bookings/receipt.tsx) | A receipt or tax invoice for one booking. |

Entry points: the Bookings tab in the Job Seeker bottom bar (a guest is sent to log in) and in the
Career Professional bottom bar; "My sessions" in the account sheet (not offered to a Platform Owner);
and the "My sessions" card on the Career Professional workspace. Each card's "View receipt" opens the
receipt, whose back action returns to `/bookings`.

## Behaviour and states

- **Guard and loading:** a spinner shows while the session restores and until the first answer.
  With no session the screen replaces itself with `/auth/login`. Pull-to-refresh re-reads the list.
- **Sections:** Coming up holds bookings that are not `cancelled` or `refunded` and start in the
  future, soonest first. Past holds the rest, in the server's order (latest start first).
- **Card:** initials, service title, "With <name>" for a Job Seeker or "For <name>" for a Career
  Professional, a status tag (Confirmed, Completed, Paid out, Cancelled or Refunded), date and time
  range in the device's time zone, modality, the service's `meetingArea` if any, and the price in
  whole dollars.
- **Joining:** an upcoming booking with a `meetingUrl` shows "Join the session", which hands the URL
  to `Linking.openURL`. An upcoming in-person booking shows "Your Career Professional confirms the
  exact meeting point before the session." to either role.
- **Cancelling:** upcoming cards have Cancel. A confirmation sheet asks "Cancel this session?" with
  "Cancelling more than 24 hours before the session refunds it in full." and Keep it / Cancel
  session. The request sends `reason: null`; the button reads "Cancelling" meanwhile. Success shows
  "Cancelled — $X refunded" when money was returned, otherwise "Session cancelled", then reloads.
  Failure, such as `409` "This booking has already been cancelled.", shows the banner.
- **Empty and error:** with no bookings, "Nothing booked yet" and role-specific text; a Job Seeker
  also gets "Browse Career Professionals". A failed read sets the list to empty, so the error banner
  and the empty state show together.
- **Receipt:** a spinner until the receipt arrives, or the error banner. The sheet shows "Tax
  invoice" or "Receipt", the receipt number, issue date, From (the Career Professional as supplier),
  ABN on a tax invoice, To (the Job Seeker), service, session date and time, "Total paid" as
  `AUD $x.xx`, and either "Includes GST of …" or "No GST has been charged on this supply."

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listMyBookings` | `GET /me/bookings` | Bookings where the caller is the Job Seeker or the Career Professional, with the other party's name and role. |
| `api.cancelBooking(id, reason)` | `POST /bookings/{id}/cancel` | Participants only; anyone else gets `404` "Booking not found.". `409 INVALID_STATE_TRANSITION` if already cancelled; `502 PAYMENT_PROVIDER_ERROR` if Stripe fails. Returns the booking and `refundedMinor`. |
| `api.getBookingReceipt(id)` | `GET /bookings/{id}/receipt` | Participants only (`404` otherwise). Built from the order's frozen snapshot in the Career Professional's name. |

Refund policy is the backend's: a Career Professional's cancellation always refunds in full; a Job
Seeker's refunds in full at least `cancellation_full_refund_hours` (24) before the start, otherwise
`cancellation_late_refund_percent` (0 by default). A stub-paid booking reports no refund, because no
money was taken.

## Acceptance criteria

| Criterion (story) | Frontend behaviour | Evidence |
|---|---|---|
| Upcoming shows service, Job Seeker, modality, time with timezone and pre-session brief (US-42) | Service, name, modality and local time shown; no timezone label; no brief (the `Booking` type has none) | Partly met. Backend `test_a_counsellor_sees_their_own_bookings_and_a_job_seeker_sees_theirs`. Screen: Not covered |
| A booking whose time has passed appears under Past only (US-42) | Start time compared with the device clock | Not covered |
| No bookings shows an empty state without an error (US-42) | "Nothing booked yet" | Not covered |
| Another user's token never returns this Career Professional's bookings (US-42) | The app sends only the caller's own token | Backend `test_a_counsellor_sees_their_own_bookings_and_a_job_seeker_sees_theirs`, `test_a_stranger_cannot_see_or_cancel_a_booking` |
| Backend unreachable shows an error state, not an empty list (US-42) | Banner shown, but with the empty state beneath it | Partly met. Not covered |
| Upcoming online booking shows details and a link that opens outside the app (US-43) | No detail screen; the card's "Join the session" opens `meetingUrl` | Partly met. Not covered |
| Upcoming in-person booking shows the meeting address (US-43) | The service's `meetingArea` and a note that the exact point will be confirmed | Partly met. Not covered |
| A non-participant is refused delivery information (US-43) | Receipt and cancel go through participant-only endpoints | Backend `test_a_stranger_cannot_see_or_cancel_a_booking` |
| No link or address recorded shows a not-yet-provided state (US-43) | Online without `meetingUrl` shows nothing | Not met |
| Cancellation refunds per policy (spec §10) | Confirm sheet, then the refunded amount returned by the server | `payments/client.test.ts` "cancelling a booking sends the reason the person gave"; backend `test_cancelling_well_before_the_session_refunds_in_full`, `test_a_late_job_seeker_cancellation_follows_the_configured_policy`, `test_a_counsellor_cancelling_always_refunds_the_job_seeker_in_full`, `test_a_booking_cannot_be_cancelled_twice`, `test_cancelling_a_stub_booking_does_not_claim_a_refund_that_never_happened`. Screen: Not covered |
| Receipt in the Career Professional's name; tax invoice with ABN and GST only when GST-registered (spec §11) | Label, ABN row and GST line switch on `isTaxInvoice` | `payments/client.test.ts` "getBookingReceipt reads the authenticated booking with an escaped identifier"; backend `test_a_gst_registered_counsellor_issues_a_tax_invoice_in_their_own_name`, `test_an_unregistered_counsellor_issues_a_receipt_with_no_gst_line`, `test_a_receipt_reflects_the_snapshot_not_the_counsellors_current_settings`. Screen: Not covered |

## Tests

- [`__tests__/payments/client.test.ts`](../../../frontend/__tests__/payments/client.test.ts): the receipt
  and booking reads (escaped identifier, bearer token) and the cancel request body.
- [`__tests__/auth/refreshOn401.test.ts`](../../../frontend/__tests__/auth/refreshOn401.test.ts) uses
  `listMyBookings` to test token renewal on `401`: 6 cases.
- No Jest test renders `bookings/index.tsx` or `bookings/receipt.tsx`, and no Playwright spec or device
  run opens them. The Playwright case "US40/41/47/68 real browser booking to stub receipt" checks the
  stub payment response and the confirmation screen, not this receipt screen. The 16 September
  simulator smoke predates PR #157.

Local run on `dev` at `64cb324`, 18 September 2026: `payments/client.test.ts` 9 passed and
`refreshOn401.test.ts` 6 passed. Backend on its temporary SQLite database, 11 passed with:

```bash
pytest tests/test_payments.py -k "cancel or receipt or own_bookings or stranger"
```

## Known gaps

- The cancel sheet's 24-hour wording is fixed text. It ignores `cancellationFullRefundHours` and
  `cancellationLateRefundPercent` from `GET /payments/config`, says nothing about a late cancellation,
  and is shown to Career Professionals, whose cancellations always refund in full.
- No cancellation reason is collected, though the API accepts one. Client approval of the refund
  settings is not recorded; the [Sprint 2 review](../client-feedback/sprint-2-review-and-client-feedback.md)
  keeps automated refunds deferred.
- No booking detail screen, timezone label, pre-session brief or reschedule (US-69).
- Card prices and the cancel toast use whole dollars, so a price with cents is rounded; the receipt
  shows cents.
- The in-person note is addressed to a Job Seeker but also shown to the Career Professional.
- The receipt screen spins indefinitely without a `bookingId` or a session; it does not redirect.
- The receipt has no share, download or email action, and the response's `text` field is unused.
