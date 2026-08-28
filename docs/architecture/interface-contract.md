# Yoir Executable Architecture Interface Contract

## 1. Contract boundary

The React Native/Expo mobile app communicates with the FastAPI backend over HTTPS REST/JSON using a typed TypeScript client. FastAPI owns business rules and persists through SQLAlchemy to PostgreSQL 16. The executable slice uses a backend payment stub; Stripe Test Mode remains a fallback pending `CLIENT-02`.

```text
React Native/Expo -> FastAPI -> domain services -> PostgreSQL 16
                         |-> backend payment stub (current) / Stripe Test Mode (conditional)
                         |-> object storage / email / external meeting link
```

| Boundary | Provider | Consumer | Published form |
|---|---|---|---|
| Mobile/API | Yoir API | Mobile app | `openapi.yaml` |
| API/database | Repository layer | Application services | Domain records and invariants below |
| API/payment | Stripe webhook + PaymentIntent adapter | Order/payment service | Payment and webhook controls below |
| API/object storage | Signed upload/fetch adapter | Profile/service images | Provider-neutral object reference |
| API/email | Transactional-email adapter | Password-reset service | Reset-link request |
| API/meeting link | Stored external URL | Booking participants | Authorised booking delivery information |

### Payment gateway port

```ts
type CreatePaymentIntentRequest = {
  orderId: string;
  amountMinor: number;
  currency: "AUD";
  idempotencyKey: string;
};

type PaymentIntentResult = {
  paymentIntentId: string;
  clientSecret: string;
  status: "requires_payment_method" | "requires_action" | "processing";
};

interface PaymentGateway {
  createIntent(request: CreatePaymentIntentRequest): Promise<PaymentIntentResult>;
  verifyWebhook(rawBody: Uint8Array, signature: string): VerifiedStripeEvent;
}
```

Raw card details must never enter the Yoir API, logs or database. Stripe PaymentSheet handles them on the device. Yoir stores Stripe references only. A booking is confirmed by a verified, idempotently processed Stripe webhook—not by the mobile callback.

## 2. Published operations

`Public` means no session is required. All other roles use a bearer access token. Resource ownership checks are additional to role checks.

| operationId | Method and path | Actor | Successful effect | Requirement IDs |
|---|---|---|---|---|
| `login` | `POST /auth/sessions` | Public | Creates an authenticated session | `US-06` |
| `register` | `POST /auth/users` | Public | Creates a Job Seeker or Counsellor account | `US-01`, `US-02`, `US-03`, `US-04` |
| `refreshSession` | `POST /auth/sessions/refresh` | Authenticated | Rotates session tokens | `US-06`, session control |
| `requestPasswordReset` | `POST /auth/password-reset-requests` | Public | Sends a non-enumerating reset link | `US-70` |
| `logout` | `DELETE /auth/sessions/current` | Authenticated | Invalidates current session | `US-08` |
| `listServices` | `GET /services` | Public | Returns public active services | `US-44`, `US-45` |
| `getService` | `GET /services/{serviceId}` | Public | Returns public service and counsellor summary | `US-46` |
| `listServiceSlots` | `GET /services/{serviceId}/slots` | Public | Returns currently open slots | `US-40` |
| `createOrder` | `POST /orders` | Job Seeker | Atomically reserves slot and creates pending order | `US-41`, `US-47` |
| `createPaymentIntent` | `POST /orders/{orderId}/payment-intents` | Owning Job Seeker | Creates/reuses Stripe Test PaymentIntent; does not confirm booking | `US-47` |
| `completeStubPayment` | `POST /orders/{orderId}/payments/stub` | Owning Job Seeker | Simulates successful payment and returns a confirmed booking without card data or real money | `US-47`, `US-68` |
| `processStripeWebhook` | `POST /payments/stripe/webhook` | Stripe signature | Idempotently updates payment/order and confirms booking | `US-41`, `US-47`, `US-68` |
| `listMyBookings` | `GET /me/bookings` | Job Seeker/Counsellor | Returns only the caller's bookings | `US-42` |
| `getBooking` | `GET /bookings/{bookingId}` | Participant/Platform Owner | Returns authorised booking details | `US-43`, `US-68` |
| `rescheduleBooking` | `POST /bookings/{bookingId}/reschedule` | Authorised participant | Atomically moves an eligible booking to an open slot | `US-69` |
| `listMessages` | `GET /bookings/{bookingId}/messages` | Participant | Returns order-linked message history | `US-49`, `US-50` |
| `sendMessage` | `POST /bookings/{bookingId}/messages` | Participant | Appends message when conversation is open | `US-50`, `US-62`, `US-63` |
| `completeBooking` | `POST /bookings/{bookingId}/completion` | Booked Counsellor | Marks eligible confirmed booking completed | `US-53`, enabling control |
| `createReview` | `POST /bookings/{bookingId}/review` | Owning Job Seeker | Creates one review and updates aggregate | `US-53`, `US-54`, `US-55` |
| `listOwnServices` | `GET /me/services` | Counsellor | Returns caller-owned services | `US-34`, `US-36` |
| `createService` | `POST /me/services` | Eligible Counsellor | Creates service with modality/location validation | `US-34`, `US-35`, `US-37`, `US-38` |
| `createAvailabilitySlot` | `POST /me/availability-slots` | Counsellor | Creates a non-overlapping open slot | `US-39` |
| `getCounsellorProfile` | `GET /counsellors/{counsellorId}` | Public | Returns public professional profile | `US-30`, `US-44`, `US-46` |
| `updateOwnCounsellorProfile` | `PATCH /me/counsellor-profile` | Counsellor | Updates professional-profile fields | `US-30` |
| `submitVerification` | `POST /me/verification-submissions` | Counsellor | Submits LinkedIn URL for manual review | `US-31`, `US-32` |
| `listForumBoards` | `GET /forum/boards` | Public | Returns public Forum structure | `US-14` |
| `listForumPosts` | `GET /forum/posts` | Public | Searches/filters/sorts public posts | `US-15`, `US-22` |
| `createForumPost` | `POST /forum/posts` | Job Seeker | Publishes valid post; counsellor role rejected | `US-16`, `US-17`, `US-19` |
| `replyToForumPost` | `POST /forum/posts/{postId}/replies` | Eligible authenticated user | Adds attributable reply | `US-18`, `US-20` |
| `toggleForumLike` | `PUT /forum/posts/{postId}/like` | Authenticated | Idempotently sets requested like state/count | `US-21` |
| `submitDispute` | `POST /orders/{orderId}/disputes` | Owning Job Seeker | Records order-linked after-sales case | `US-51` |
| `listVerificationSubmissions` | `GET /admin/verifications` | Platform Owner | Returns verification review queue | `US-58` |
| `decideVerification` | `POST /admin/verifications/{submissionId}/decision` | Platform Owner | Records approve/reject decision | `US-32`, `US-58` |
| `listPaymentOversight` | `GET /admin/payments` | Platform Owner | Returns payment/order progress without card data | `US-48` |
| `resolveDispute` | `POST /admin/disputes/{disputeId}/resolution` | Platform Owner | Records resolution and updates relevant states | `US-52` |
| `healthCheck` | `GET /health` | Operations | Supports deployed-backend readiness checks used by both mobile platforms | `NFR-02` |

The executable demo may implement the primary path first. An operation is not considered implemented merely because it appears in this contract.

## 3. Published domain data

### Identity and roles

```text
Role = job_seeker | counsellor | platform_owner
```

An access token identifies one user and one role. The API derives identity from the token; clients must not select an acting user through request fields.

### Core records

| Record | Required information |
|---|---|
| `User` | `id`, `name`, `email`, `role` |
| `CounsellorSummary` | `id`, `displayName`, `introduction`, `verificationStatus`, `overallRating`, `reviewCount` |
| `Service` | `id`, `counsellor`, `title`, `description`, `priceMinor`, `currency`, `modalities`, `location`, `active`, rating fields |
| `AvailabilitySlot` | `id`, `serviceId`, `startsAt`, `endsAt`, `status` |
| `Order` | `id`, `jobSeekerId`, `counsellorId`, `service snapshot`, `slotId`, `timezone`, `modality`, monetary fields, statuses |
| `Booking` | `id`, `orderId`, participants, start/end, modality, delivery information, `status`, `conversationStatus` |
| `Payment` | `id`, `orderId`, amount/currency, `status`, provider reference; never raw card data |
| `Message` | `id`, `bookingId`, `senderId`, `content`, `createdAt` |
| `Review` | `id`, `bookingId`, `serviceId`, `jobSeekerId`, integer rating 1–5, comment, `createdAt` |

### Representation rules

- Identifiers are opaque strings; consumers must not infer meaning from them.
- Timestamps use RFC 3339 UTC instants, for example `2026-08-26T09:30:00Z`.
- The booking retains the user's IANA timezone, for example `Australia/Sydney`, for display.
- Money is an integer in minor units plus ISO currency; `12500 AUD` means AUD 125.00.
- Optional fields are omitted or `null` only where the OpenAPI schema permits it.
- System-provided messages are English.

## 4. Published control rules

### Authentication and authorisation

1. Failed login returns the same generic error for unknown email and wrong password (`US-07`).
2. Private records require both an allowed role and relationship to the resource.
3. A Job Seeker can view only their bookings, orders, payments and conversations.
4. A Counsellor can view only bookings and conversations for their own services.
5. A Platform Owner receives oversight fields only; raw payment credentials are never exposed.
6. Public service endpoints expose only active services and deliberately public counsellor fields (`NFR-05`).

### Order, payment and booking state

```text
Order:   pending -> awaiting_payment -> confirmed -> completed
             |             |             |
             +-> expired   +-> expired   +-> cancelled / disputed

Payment: not_started -> requires_action -> processing -> paid
                     |
                     +-> failed -> processing (retry)

Booking: held -> confirmed -> completed
            |          |
            +-> expired+-> cancelled / disputed
```

- `createOrder` must reserve the slot and create the pending order atomically. The hold expires after 15 minutes.
- A slot can belong to at most one non-cancelled order. A conflict returns `SLOT_UNAVAILABLE`.
- `createPaymentIntent` requires an idempotency key. Repeating it must not create a second PaymentIntent.
- `completeStubPayment` is the active executable-architecture boundary while `CLIENT-02` is unresolved. It accepts no card fields, is idempotent for an already-paid order, and confirms exactly one booking.
- `processStripeWebhook` verifies the signature against the raw body and stores a unique Stripe `event_id`. A replay returns success as a no-op.
- Booking confirmation occurs only after a valid success webhook and committed state transition. A PaymentSheet/client callback never confirms it.
- Payment failure leaves an unexpired order recoverable as `awaiting_payment`; it must not produce a confirmed booking.
- Payment amount and service identity come from the server-side order snapshot, not client-supplied values.
- PostgreSQL transaction/concurrency primitives and a uniqueness constraint over the held/booked slot protect against double-booking; no Redis lock is used in the MVP.

### Conversation state

```text
open -> closed
```

- A successful paid order has exactly one conversation.
- Only booking participants can read or send messages.
- Completing or cancelling the booking closes the conversation.
- The backend rejects sends to a closed conversation with `CONVERSATION_CLOSED`; hiding the UI input alone is insufficient.

### Review state

- Only the Job Seeker attached to a completed booking can review it.
- A booking accepts at most one review.
- Rating is an integer from 1 through 5.
- Review creation and aggregate rating/count update must be one transaction.

### Counsellor control

- Only an eligible counsellor can publish a service.
- Online services require online delivery information before fulfilment.
- In-person services require state and city/region.
- Availability start must precede end and must not overlap the counsellor's existing open/reserved slots.
- Under the working `CLIENT-01` assumption, a submitted LinkedIn URL is manually reviewed; no LinkedIn API claim is made.

## 5. Common error contract

All non-2xx responses use:

```json
{
  "code": "SLOT_UNAVAILABLE",
  "message": "The selected slot is no longer available.",
  "fieldErrors": {
    "slotId": "Choose another available slot."
  },
  "requestId": "req_01"
}
```

| HTTP | Stable code | Meaning |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | Request shape or field value is invalid |
| 401 | `AUTHENTICATION_REQUIRED` | Token absent, expired or invalid |
| 401 | `INVALID_CREDENTIALS` | Generic login failure |
| 403 | `FORBIDDEN` | Authenticated actor lacks permission/ownership |
| 404 | `NOT_FOUND` | Resource absent or deliberately hidden |
| 409 | `SLOT_UNAVAILABLE` | Slot was reserved or booked concurrently |
| 409 | `INVALID_STATE_TRANSITION` | Operation is invalid in current lifecycle state |
| 409 | `ALREADY_REVIEWED` | Booking already has a review |
| 409 | `CONVERSATION_CLOSED` | Sending is disabled but history remains readable |
| 422 | `PAYMENT_FAILED` | Sandbox provider declined/failed safely |

Clients branch on `code`, not English `message`. Unknown error codes must fall back to a generic error UI.

## 6. Executable architecture acceptance scenarios

### EA-00 — First deployed walking skeleton

Given a new user on either supported simulator, the user can register, log in, browse the Marketplace and open service detail, with every screen reading from the deployed FastAPI/PostgreSQL backend.

### EA-01 — Extended successful critical path

Given seeded active service and open slot data, a Job Seeker logs in, retrieves the service, selects its slot, creates an order, completes the clearly labelled backend payment stub and sees a persisted confirmed booking. No card details or real money are involved.

### EA-02 — Concurrent slot protection

Given one slot has already been reserved, a second create-order request receives HTTP 409 `SLOT_UNAVAILABLE` and no second active order is stored.

### EA-03 — Payment safety

Given sandbox payment failure, the order remains pending, no confirmed booking is presented, and no raw card details appear in application storage or logs.

### EA-04 — Resource authorisation

Given another authenticated user, attempts to read the booking or conversation fail without exposing private details.

### EA-05 — Conversation closure

Given a completed booking, message history remains readable but a send attempt receives `CONVERSATION_CLOSED`.

### EA-06 — Verified review

Given the owning Job Seeker and a completed booking, one valid review is persisted and the service/counsellor rating aggregates update consistently; a second review is rejected.

## 7. Out of scope for this executable slice

- Diagnosis/recommendation (`US-09`–`US-13`)
- Unsolicited direct messaging
- Stripe live-mode/production payment processing
- Complete UI polish and every validation edge case
- General user administration beyond active Platform Owner stories
- Multilingual UI and saved language preference
- Nearby/geolocation discovery
