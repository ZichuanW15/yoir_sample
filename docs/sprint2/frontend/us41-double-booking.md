# US-41 frontend: reserve a slot and recover from a conflict

Issue: [#119](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/119),
under [US-41 #36](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/36).

This is the client side of double-booking prevention. When the Job Seeker presses
"Continue to payment", the app creates an order, and the backend holds the slot
**before** any payment. If someone else has already taken the time, the request
fails at this step. The app then clears the choice, reloads the open times and
explains what happened. Atomic reservation and the concurrency guarantee are
backend work (#120). The picker itself is described in [US-40](us40-slot-selection.md),
and the hold countdown on checkout in [US-47](us47-test-purchase.md).

## Screens and flow

Everything happens in `reserve()` in
[timeslots.tsx](../../../frontend/app/services/%5BserviceId%5D/timeslots.tsx):

1. The guard returns early unless there is a session, a loaded service, a chosen
   slot and a modality.
2. `busy` is set, which disables "Continue to payment" and shows its spinner.
   `slotsError` is cleared. A 700 ms beat (`RESERVE_MS` in
   [booking.tsx](../../../frontend/src/components/booking.tsx)) starts alongside the request.
3. The app calls `api.createOrder(service.id, chosen.startsAt, modality, deviceTimezone(), accessToken)`.
4. On success, it waits out the beat and pushes `/bookings/checkout` with the order
   id, amount and `holdExpiresAt` returned by the backend.
5. On any error:
   - The app reads `fieldErrors(error).startsAt`, clears the selected slot and
     awaits `load()`, so the list is refreshed from the backend.
   - It then waits out the beat and sets the banner text: `userFacingError(error)`,
     followed by the `startsAt` field detail when one is present.
   - The refresh deliberately runs before the message is set, so reloading cannot
     wipe out the reason.
   - The app does not navigate.

## Behaviour and states

- **Conflict.** For a taken time, the backend returns `409` with
  `SLOT_UNAVAILABLE` and the message "This time is no longer available."
  ([bookings.py](../../../backend/app/routers/bookings.py)). The response has no
  `fieldErrors`, so the banner shows that message alone. Unit tests also cover the
  variant with a `startsAt` detail.
- **Other rejections** use the same path and show the backend's message:
  - An elapsed start (`400`): "That time has already passed."
  - An unsupported modality: "Choose a supported service modality."
  - When payments are enabled and the Career Professional cannot take payouts (`409`
    `COUNSELLOR_PAYOUTS_UNAVAILABLE`): "This Career Professional cannot accept
    bookings yet. Please try another Career Professional."
  - An unconfirmed email: "Confirm your email address to continue. Check your inbox
    for the link."
  - A non-Job-Seeker role (`403`).
- **Nothing created on failure.** No order id reaches the UI, the app does not
  navigate, and the selection is cleared. "Continue to payment" stays disabled until
  a new slot is chosen.
- **Double press.** While the first request is pending, the button is disabled, so
  only one `POST /orders` is sent.
- **Expired token.** A `401` on a request that carried a token triggers one refresh
  and one retry in the API client ([client.ts](../../../frontend/src/api/client.ts)).
- **Holds.** The server sets `holdExpiresAt`, and checkout counts down to it. The app
  never releases a hold. Leaving checkout keeps the time held until it lapses. The
  backend excludes unexpired `awaiting_payment` orders from `/slots` (`busy_periods`
  in [availability.py](../../../backend/app/availability.py)), so the time does not
  reappear, even for the same Job Seeker, until the hold lapses.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.createOrder(serviceId, startsAt, modality, timezone, token)` | `POST /orders` | Bearer token. The body is `{ serviceId, startsAt, modality, timezone }`. The price is taken from the server, never from the app. Returns an `Order` with `holdExpiresAt`. |
| `api.listServiceSlots(serviceId, modality)` | `GET /services/{serviceId}/slots` | Re-read after any reservation failure. |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| A reserved slot is returned as unavailable and appears unavailable in the Career Professional's calendar and other Job Seekers' pickers | Backend. The picker re-reads `/slots` on every load and renders only what is returned. The Career Professional's calendar is covered by [US-39](us39-availability.md). | Backend (#120). QA #121: "Same-slot PostgreSQL requests yield one reservation". |
| A second order for a reserved or confirmed slot is rejected with a conflict, creating nothing | Backend. The frontend creates nothing and does not navigate on the error. | Backend tests listed for QA #121 in [issue-evidence.json](../qa/issue-evidence.json). |
| Two simultaneous requests: exactly one succeeds | Backend only. The client sends one request per press. | QA #121 (PostgreSQL). `timeslots.test.tsx` "[QA-121] double press while the reservation is pending sends one order" covers the client's single request. |
| On a double-booking rejection the app says the slot is gone, shows nothing as created, and reloads the open slots | Met. | `timeslots.test.tsx` "[QA-121] a reservation conflict refreshes availability, clears selection and keeps the reason"; "[QA-100/121] a server role rejection cannot advance to checkout". |

## Tests

- [timeslots.test.tsx](../../../frontend/__tests__/screens/timeslots.test.tsx): the "[QA-121]" cases above,
  plus "[QA-118/121] selection reserves through the real client with identity and
  passes server order data", which checks the Bearer header and the exact request body.
- [client.test.ts](../../../frontend/__tests__/api/client.test.ts): "createOrder sends the booking
  payload with Bearer authentication" and "converts a structured non-2xx response into ApiError".
- Playwright: [web.spec.ts](../../../frontend/e2e/web.spec.ts) "US40/41/47/68 real browser
  booking to stub receipt (not provider acceptance)". It checks that `POST /orders`
  returns `201`. There is no browser conflict case.

From `frontend/`:

```bash
npm test -- __tests__/screens/timeslots.test.tsx __tests__/api/client.test.ts
```

## Known gaps

- The conflict path has been tested only with mocked HTTP. No browser or device run
  has shown two users contending for one time. Native case N05, a second session
  taking the slot before the device user continues, has not been run. The native
  observations for QA #121 are a single booking only.
- The screen treats every error the same way. A network failure also clears the
  selection and reloads, although the slot may still be free.
- The app never releases a hold. A Job Seeker who backs out of checkout cannot pick
  the same time again until `holdExpiresAt` passes. Releasing a hold after an
  abandoned payment is out of scope for the parent story.
- Two backend strict xfails at the [18 September review](../qa/dev-sync-review-20260918.md)
  affect this step. One is `test_orders_have_a_database_invariant_against_overlapping_holds`.
  The other is `test_committed_booking_write_does_not_depend_on_a_second_database_read[create_order]`:
  the order is committed, but a later read failure returns `500`. The app would then
  show an error for an order that exists.
