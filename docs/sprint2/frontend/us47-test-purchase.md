# US-47 frontend: review and pay for a held slot

Issue: [#122](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/122),
under [US-47 #44](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/44).

This slice is the "Review and pay" step between reserving a slot
([US-41](us41-double-booking.md)) and the confirmation ([US-68](us68-booking-confirmation.md)).
The Job Seeker sees the session details, the total, a countdown for the hold and
the cancellation policy, then pays. The backend decides the payment method:

- **Stub.** The backend payment stub, clearly labelled as test mode. This is the
  only path exercised by automated or device QA.
- **Stripe.** A card payment through Stripe, following the
  [payments spec](../../payment/stripe-payment-spec.md): the native PaymentSheet on
  a device, or Stripe.js on the web.

Card entry never happens in Yoir's own UI. The Career Professional's side of
payments (Stripe onboarding and payout status) is covered in
[US-47 payouts](us47-career-professional-payouts.md).

## Screens and flow

The route is `/bookings/checkout`,
[checkout.tsx](../../../frontend/app/bookings/checkout.tsx). It is pushed by the
slot picker with `orderId`, `serviceId`, `modality`, `amountMinor`, `startsAt`,
`endsAt` and `holdExpiresAt`. It loads the service for its title, the Career
Professional's name and the meeting area. The screen shows:

- A `BackBar` titled "Review and pay". Back (label "Go back") returns to the slot picker.
- The progress bar, labelled "Step 2 of 3: Payment".
- "Almost there" and "Your slot is reserved while the timer runs.", beside a
  countdown ring (`m:ss`).
- A summary: the title, "with {Career Professional}", then Date, Time, Timezone
  (the device's IANA zone), Delivery, Meeting area (for in person only), and Total
  (`amountMinor` from the order).
- "Cancellation policy": "Cancel at least {n} hours before the session for a full
  refund of {total}." This is followed by the late-cancellation rule and "If your
  Career Professional cancels, you are always refunded in full." The values come from
  `/payments/config`. The defaults are 24 hours and no late refund.
- A payment panel, chosen by `config.provider`:
  - `stripe`: "Secure card payment". The panel says card details are entered
    directly with Stripe and never reach Yoir's servers, and that the Career
    Professional is paid after the session. It also shows a "Booking reference"
    (the order id).
  - Anything else, including a failed config fetch: "Test-mode payment". The panel
    reads "Yoir never collects or stores card details. This build uses the backend
    payment stub, so no real money moves.", with the method "Yoir test payment" and
    an "Order reference".
- A footer button, "Pay {total}".

## Behaviour and states

- **Hold countdown.** The ring counts down to the server's `holdExpiresAt`. Without
  one, it runs for `slotHoldMinutes` from config, or 15 minutes (`HOLD_MS`). At
  zero, an alert reads: "Reservation expired. Your slot was released so someone else
  could book it. Choose another time to continue." The footer then becomes "Choose
  another time", which replaces checkout with the slot picker.
- **Pay guard.** `pay()` does nothing if there is no session, the hold has expired,
  or the card path is unavailable. The button stays disabled for at least 1100 ms
  (`PAY_MS`) while busy, so a double press sends one request. A guest who reaches
  this route gets no redirect: the button does nothing.
- **Stub path.** The app posts `POST /orders/{id}/payments/stub`, then calls
  `router.replace` to open the confirmation with the returned `booking.id` and
  `paymentId`. It passes the checkout's own `startsAt`, `endsAt`, `modality` and
  `amountMinor`. Replacing checkout means Back cannot return to it and pay again.
- **Card path.**
  1. `POST /orders/{id}/payment-intents` returns a client secret.
  2. `present()` opens the sheet. On native, this is
     [sheet.tsx](../../../frontend/src/payments/sheet.tsx): PaymentSheet with Apple
     Pay, and delayed payment methods switched off. On the web, it is
     [sheet.web.tsx](../../../frontend/src/payments/sheet.web.tsx): a "Pay by card"
     overlay with the Stripe Payment Element, "Pay now" and "Cancel".
  3. Outcomes:
     - `cancelled`: the app returns quietly.
     - `failed`: the sheet's message, or "The payment could not be completed.", is shown on checkout.
     - `paid`: [waitForBooking.ts](../../../frontend/src/payments/waitForBooking.ts)
       polls `GET /orders/{id}` up to 10 times, 900 ms apart. It stops early on
       `refunded_slot_taken`. If a booking appears, the confirmation opens with the
       booking id and PaymentIntent id. Otherwise it opens in its pending form
       (`pending=1`, no booking id).
- **Failure.** Any thrown error is shown with `userFacingError` in an
  `ErrorBanner`. The Job Seeker stays on checkout, and a retry reuses the same order.
- **Card path not configured.** If the backend reports `stripe` but publishes no
  `publishableKey`, the web sheet reports itself unsupported. The page then reads
  "Card payments are not set up on this server yet. Your slot stays reserved while
  the timer runs." and Pay is disabled.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getPaymentConfig()` | `GET /payments/config` | Public. Read once by `PaymentConfigProvider` in the root layout. |
| `api.getService(id)` | `GET /services/{serviceId}` | Public; used for the summary copy. |
| `api.completeStubPayment(order, token)` | `POST /orders/{orderId}/payments/stub` | Bearer token. Returns `{ paymentId, paymentStatus: 'paid', booking }`. |
| `api.createPaymentIntent(orderId, token)` | `POST /orders/{orderId}/payment-intents` | Bearer token; card path only. |
| `api.getOrderStatus(orderId, token)` | `GET /orders/{orderId}` | Bearer token. Polled after the sheet reports `paid`. |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| Before paying, a review shows the service, slot time with timezone, modality, price, Yoir commission and Career Professional amount | Partly met. Everything is shown except the commission and the Career Professional amount. The order carries an `amounts` breakdown, but checkout does not display it. Commission figures appear only on the Platform Owner screens. There is no pre-session brief to show. | `checkout.test.tsx` "[QA-124] shows the selected order, session details and explicit test-mode payment"; "[QA-127] in-person checkout shows the meeting area and supports returning to the previous screen". |
| On success, the backend records the order and transaction, and the app shows the state it returns | Met for the stub path. The confirmation uses the returned booking and payment ids. The time and modality come from route parameters (see US-68). The card path waits for the backend booking. | `checkout.test.tsx` "[QA-124/127] successful payment submits the held order token and replaces checkout with confirmation"; `waitForBooking.test.ts` (6 cases); `web.spec.ts` "US40/41/47/68 real browser booking to stub receipt (not provider acceptance)"; QA #124 records one stub purchase on each simulator. |
| On failure or an unknown result, the state is non-successful and the app does not claim success | Met for stub failures and network errors. On the card path, a `refunded_slot_taken` order is shown as the pending confirmation (see Known gaps). | `checkout.test.tsx` "[QA-124] a failed payment remains on checkout and retry uses the same order"; "[QA-124] a network failure shows recovery guidance without displaying success". |
| A repeated confirmation creates no duplicates | Backend. The client sends one request per press. | `checkout.test.tsx` "[QA-124] duplicate pay presses while pending send only one payment request". Backend xfail B03: a stub retry returns a different `paymentId`. |
| Yoir stores no raw card number, expiry or CVV | The stub checkout has no card fields. Card entry happens only inside Stripe's SDK or Stripe.js iframes. | `checkout.test.tsx` "[QA-124] shows the selected order, …" asserts that no card-number field exists. Database and log inspection is backend QA. |
| Creating or paying an order without a valid session is rejected | Backend enforces this. The client sends no payment without a session. | `checkout.test.tsx` "[QA-124] an unauthenticated checkout cannot send a payment" |

## Tests

- [checkout.test.tsx](../../../frontend/__tests__/screens/checkout.test.tsx): seven cases, all
  on the stub path. The test harness mocks the payment sheet as unsupported.
- [waitForBooking.test.ts](../../../frontend/__tests__/payments/waitForBooking.test.ts),
  [config.test.tsx](../../../frontend/__tests__/payments/config.test.tsx),
  [payments/client.test.ts](../../../frontend/__tests__/payments/client.test.ts)
  ("creating a payment intent posts to the order and authenticates", "an order id is
  escaped rather than pasted into the path").
- Playwright: [web.spec.ts](../../../frontend/e2e/web.spec.ts) (stub journey). Native, authored only:
  [guest-booking.yaml](../../../frontend/e2e/native/guest-booking.yaml).

From `frontend/`:

```bash
npm test -- __tests__/screens/checkout.test.tsx __tests__/payments
```

## Known gaps

- The commission and the Career Professional amount are not shown to the Job
  Seeker (AC1).
- The Stripe card path has no screen, browser or device test. `sheet.tsx` and
  `sheet.web.tsx` are excluded from coverage. The
  [18 September review](../qa/dev-sync-review-20260918.md) states that provider
  card payments were not exercised.
- `PaymentConfigProvider` records "Payment settings are unavailable." when the
  config fetch fails, but checkout never displays it. It silently falls back to the
  stub panel.
- `waitForBooking` returns `null` for `refunded_slot_taken`. Checkout then opens
  the pending confirmation, which says the card was charged and the booking is being
  confirmed, when the payment has in fact been refunded.
- The Stripe panel does not say "test mode". Only the stub panel is labelled.
- Prices are rounded to whole dollars (F01 / DEF-MONEY-CENTS).
- Backend xfails affecting this step: B03 (the stub `paymentId` changes on retry),
  and `…second_database_read[pay_order]` (a committed payment can return `500`, which
  the app shows as a failure).
- Native case N10 (stub failure and recovery) has not been run.
