# US-68 frontend: booking confirmation

Issue: [#125](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/125),
under [US-68 #39](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/39).

This slice is the final booking step. It tells the Job Seeker what they booked,
gives the references to quote, and says what happens next. The screen has a
confirmed form and a pending form. The pending form is used when a card payment
cleared but the backend had not yet confirmed the booking. A failed payment never
reaches this screen: the Job Seeker stays on checkout ([US-47](us47-test-purchase.md)).
The My sessions list, cancellation and receipts screens are documented separately.

## Screens and flow

The route is `/bookings/confirmation`,
[confirmation.tsx](../../../frontend/app/bookings/confirmation.tsx). Checkout opens
it with `router.replace`, passing `bookingId`, `paymentId`, `serviceId`,
`modality`, `startsAt`, `endsAt`, `amountMinor` and `pending`. Swipe-back is off
(`gestureEnabled: false` in the root layout). The screen shows:

- The progress bar at its last step, labelled "Step 3 of 3: Confirmed".
- An animated seal and a headline: "You’re booked", or "Payment received" when
  `pending=1`.
- A seal message:
  - Stub: "Payment successful. No real money was charged — this build uses a payment stub."
  - Card, confirmed: "Payment successful. Your Career Professional is paid after the
    session takes place."
  - Card, pending: "Your card was charged and we are confirming the booking now.
    This usually takes a few seconds."
- A summary: the service title, "with {Career Professional}", then When (long date),
  Session (time range), Delivery, and Paid ("{amount} · Paid").
- "References", set in monospace:
  - Booking: the id, or "Confirming…" when there is none.
  - Payment: the stub payment id or the Stripe PaymentIntent id.
  - Receipt: the receipt number, once `GET /bookings/{id}/receipt` returns one.
- "Joining your session" with an "Open the meeting room" button. This appears only
  when `GET /bookings/{id}` returns a `meetingUrl`.
- A next-steps note:
  - In person: "In person · {area}. Your Career Professional confirms the exact
    meeting point before the session."
  - Online: "Online. The same joining link is in your confirmation email.", or
    "Online. Joining details are sent to your registered email before the session."
    when there is no link.
  - It then ends with "Keep the booking reference — your Career Professional can see
    the booking now." In the pending form, it ends with "Your confirmation will
    arrive by email shortly; you do not need to pay again."
- A footer "Back to Explore" button. It calls `router.dismissAll()` when the stack
  can be dismissed, then `router.push('/marketplace')`.

## Behaviour and states

- **Where the data comes from.**
  - The title and Career Professional name come from public `GET /services/{id}`.
  - The time, modality and amount come from the route parameters, which checkout
    took from the slot picker. The backend booking is not used for them.
  - The booking and payment ids come from the payment response, or from polling on
    the card path.
  - The meeting link and receipt number come from authenticated reads.
- **Failed reads.** If any of these three reads fails, it is ignored and the rest of
  the screen still renders. The service read is `getService`; the other two are
  `getBooking` and `getBookingReceipt`.
- **Session.** There is no auth guard. Without a session, or without a
  `bookingId`, the authenticated reads are skipped, but the headline, "Paid" and the
  success message are still rendered from the route parameters.
- **Status.** The screen never reads the booking's `status` or `paymentStatus`.
  "Confirmed" and "Paid" are fixed text chosen by the `pending` flag.
- **Pending form.** It does not poll. Polling happens once, on checkout, in
  `waitForBooking`.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getService(serviceId)` | `GET /services/{serviceId}` | Public; supplies the title and Career Professional name. |
| `api.getBooking(bookingId, token)` | `GET /bookings/{bookingId}` | Bearer token. Only `meetingUrl` is used. |
| `api.getBookingReceipt(bookingId, token)` | `GET /bookings/{bookingId}/receipt` | Bearer token. Only `receiptNumber` is used. |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| A confirmed booking shows the reference, both participants, service, time with timezone, modality, payment status and delivery information from the backend response | Partly met. The references, Career Professional, service, time, modality, "Paid" and delivery note are shown. The Job Seeker participant and the timezone are not. The time, modality and amount come from route parameters, not the backend booking. | `confirmation.test.tsx` "[characterization] renders route-provided confirmation references and stub disclosure", "[characterization] an in-person route includes the meeting area"; `web.spec.ts` "US40/41/47/68 real browser booking to stub receipt (not provider acceptance)". Defect `public-acceptance.test.tsx` "[QA-127][DEF-CONFIRM-RECEIPT] confirmation uses the server-confirmed booking time and modality" fails. |
| When payment is pending, failed or unknown, that status is shown and the booking is not presented as confirmed | Partly met. A failure stays on checkout, and card-pending shows "Payment received" with "Confirming…". An unknown state, such as a URL without a booking id, still shows "You’re booked". | Defect "[QA-127][DEF-CONFIRM-UNVERIFIED] a direct confirmation URL without a receipt cannot claim payment success" fails; `web.spec.ts` "US68 forged anonymous confirmation URL must not claim success @defect" fails. |
| Next actions stay within the active backlog, with no order-linked conversation | Met. The actions are "Back to Explore", "Open the meeting room" (when a link exists) and the delivery note. | `confirmation.test.tsx` "[QA-127] leaving confirmation clears an existing booking stack before browsing"; "[characterization] unavailable service copy retains route references". |
| If the backend response has not arrived, a pending state is shown, and confirmation only after a re-read shows it confirmed | Partly met. The card path polls `GET /orders/{id}` before opening this screen, and falls back to the pending form. The screen itself never re-reads the booking, and the stub path does not poll. | `waitForBooking.test.ts` "returns the booking as soon as the webhook has been processed", "keeps asking while the webhook is still in flight", "gives up after the configured attempts rather than hanging the screen". There is no screen test of the pending form. |
| A non-participant requesting the booking is rejected | Backend. The app sends the Job Seeker's token on `GET /bookings/{id}`. | Not covered by a frontend test. The 16 September QA snapshot excluded a participant-protected read. `getBooking` was added to `dev` after that, and its backend restriction is not verified here. |

## Tests

- [confirmation.test.tsx](../../../frontend/__tests__/screens/confirmation.test.tsx): four cases.
  Three are tagged `[characterization]`: they record current rendering and are not
  acceptance evidence.
- [public-acceptance.test.tsx](../../../frontend/__tests__/defects/public-acceptance.test.tsx):
  the two "[QA-127]" defect assertions. Both fail.
- [waitForBooking.test.ts](../../../frontend/__tests__/payments/waitForBooking.test.ts);
  [payments/client.test.ts](../../../frontend/__tests__/payments/client.test.ts) "%s reads the
  authenticated booking with an escaped identifier" (`getBooking`, `getBookingReceipt`).
- Playwright: [web.spec.ts](../../../frontend/e2e/web.spec.ts) (the stub journey, and the
  forged-URL `@defect` case). Native, authored only:
  [guest-booking.yaml](../../../frontend/e2e/native/guest-booking.yaml).

From `frontend/`:

```bash
npm test -- __tests__/screens/confirmation.test.tsx __tests__/payments/waitForBooking.test.ts
npm run test:defects -- __tests__/defects/public-acceptance.test.tsx
```

## Known gaps

- The screen trusts its route parameters. A forged or stale URL renders "You’re
  booked" and "Paid" (DEF-CONFIRM-UNVERIFIED), and the time and modality are not
  taken from the server booking (DEF-CONFIRM-RECEIPT). Both still fail at the
  [18 September review](../qa/dev-sync-review-20260918.md).
- There is no failed form on this screen, and the booking status is never re-read.
  The pending form never turns into the confirmed form without leaving the screen.
- The Job Seeker participant and the session timezone are not shown.
- On the card path, a `refunded_slot_taken` order lands on the pending form, which
  says the card was charged and the booking is being confirmed (see
  [US-47](us47-test-purchase.md)).
- Stripe's `returnURL` / `return_url` for 3-D Secure points at
  `/bookings/confirmation` with no booking parameters. Because of the route trust
  above, that return would show "You’re booked" before any backend check. This path
  is not tested.
- The amount is rounded to whole dollars (F01 / DEF-MONEY-CENTS). The stub
  `paymentId` can change on retry (backend xfail B03).
- Native: QA #127 records that the booking reference matched the database on both
  simulators. Toolbar Back after payment on Android is unverified, and cases N03 and
  N10 have not been run.
