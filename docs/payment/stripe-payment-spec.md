# Payments Spec: Career Counselling Marketplace (Stripe + Connect)

This document describes the payments feature to add to our existing FastAPI backend and Expo (React Native) app. **Fit everything into the existing project structure, ORM, auth, and conventions.** Code snippets here show intent, not files to copy verbatim.

## 1. Business context

- Marketplace app: **job seekers** book live **1:1 career counselling sessions** with **independent counsellors**.
- The **client** (business owner) runs the platform and takes a commission.
- The platform acts as an **agent** for GST purposes: the counsellor supplies the session to the job seeker; the platform supplies a booking service to the counsellor.
- Everything is **Australia-only** for now: currency `aud`, country `AU`.
- Sessions are **scheduled in advance** (no instant/per-minute sessions, no wallet, no stored balance).
- Only live 1:1 sessions are sold via Stripe. This relies on Apple App Store guideline 3.1.3(d) (person-to-person services). Do not add group sessions, recorded content, assessments, or subscriptions to this payment flow; those would need Apple/Google in-app purchase.

## 2. Architecture overview

```
Job seeker (Expo app)
  → POST /bookings (backend holds slot, creates PaymentIntent)
  → Stripe PaymentSheet (cards + Apple Pay)
  → Stripe webhook payment_intent.succeeded → booking confirmed
  → session happens
  → backend transfers counsellor share to their Stripe connected account
```

- Stripe **Connect** with **separate charges and transfers**: the job seeker is charged at booking into the platform balance; the counsellor is paid via a Transfer **after the session is completed**.
- Counsellors onboard via **Stripe-hosted onboarding** (Account Links), Accounts v1 API with controller properties.

## 3. Open decisions (make these configurable, not hard-coded)

These are still being confirmed with the client and their accountant:

| Setting | Placeholder | Notes |
|---|---|---|
| `PLATFORM_FEE_PERCENT` | 20 | Commission percentage |
| `PLATFORM_GST_REGISTERED` | true | Whether the platform charges GST on its commission |
| `COMMISSION_BASE` | `gst_inclusive` | Whether commission is taken from the GST-inclusive or exclusive price |
| `CANCELLATION_FULL_REFUND_HOURS` | 24 | Full refund if cancelled this many hours before |
| `SLOT_HOLD_MINUTES` | 15 | How long a slot is held during checkout |
| `PAYOUT_DELAY_HOURS` | 24 | Hours after session end before transferring to counsellor |
| Use `on_behalf_of` | no | Pending accountant advice; don't implement yet |

## 4. Environment variables (backend only)

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...          # platform events
STRIPE_CONNECT_WEBHOOK_SECRET=whsec_...  # connected account events
APP_BASE_URL=https://api.example.com     # HTTPS, used for onboarding return/refresh URLs
```

The Expo app only gets the **publishable** key (`pk_test_...`). Secret keys must never be in the app or committed to git.

## 5. Data model changes

**Counsellor** (add fields):
- `stripe_account_id` (nullable string)
- `charges_enabled` (bool, default false)
- `payouts_enabled` (bool, default false)
- `abn` (nullable, 11 digits)
- `gst_registered` (bool, default false)
- `legal_name`, `date_of_birth`, `address`, `phone` (for ATO Sharing Economy Reporting Regime, if not already stored)
- Session pricing per counsellor (e.g. a `counsellor_session_types` table: counsellor_id, session_type, duration_minutes, price_cents)

**Booking** (new or extend existing):
- `id`, `job_seeker_id`, `counsellor_id`, `session_type`, `start_time`, `end_time`
- `status`: `pending_payment` | `confirmed` | `completed` | `paid_out` | `cancelled` | `refunded` | `refunded_slot_taken`
- `hold_expires_at`
- `payment_intent_id`, `transfer_id` (nullable)
- Amount breakdown, **stored at booking time and never recalculated**:
  - `total_cents` (what the job seeker pays)
  - `session_gst_cents` (counsellor's GST, 0 if not registered)
  - `platform_fee_cents` (includes platform GST)
  - `platform_fee_gst_cents`
  - `counsellor_payout_cents`
  - `counsellor_gst_registered_at_booking` (bool snapshot)
  - `counsellor_abn_at_booking` (snapshot)

**Processed webhook events** (for idempotency): store Stripe event IDs already handled.

## 6. Amount calculation

```python
def calculate_booking_amounts(price_cents, counsellor_gst_registered):
    session_gst = round(price_cents / 11) if counsellor_gst_registered else 0
    platform_fee = round(price_cents * PLATFORM_FEE_PERCENT / 100)
    platform_fee_gst = round(platform_fee / 11) if PLATFORM_GST_REGISTERED else 0
    return {
        "total_cents": price_cents,
        "session_gst_cents": session_gst,
        "platform_fee_cents": platform_fee,
        "platform_fee_gst_cents": platform_fee_gst,
        "counsellor_payout_cents": price_cents - platform_fee,
    }
```

Example: $88 session, counsellor GST-registered, 20% fee → session GST $8, platform fee $17.60 (GST $1.60), counsellor payout $70.40.

Write unit tests for this function, including non-registered counsellors and rounding.

## 7. Backend endpoints

### Job seeker
- `POST /bookings` — body: `counsellor_id`, `session_type`, `start_time`.
  1. Look up price **on the server** from the counsellor's session types. Never accept a price from the app.
  2. Reject if counsellor `payouts_enabled` is false.
  3. Check slot availability (guard against double-booking with a DB constraint or row lock).
  4. Create booking with `status=pending_payment`, `hold_expires_at`, and the stored amount breakdown.
  5. Create PaymentIntent:
     ```python
     stripe.PaymentIntent.create(
         amount=booking.total_cents,
         currency="aud",
         automatic_payment_methods={"enabled": True},
         transfer_group=f"booking_{booking.id}",
         metadata={"booking_id": booking.id, "counsellor_id": ..., "job_seeker_id": ...},
         idempotency_key=f"booking-{booking.id}",
     )
     ```
  6. Return `{ paymentIntent: client_secret, bookingId }`.
- `GET /bookings/{id}` — the app uses this as source of truth for booking status after payment.
- `POST /bookings/{id}/cancel` — apply refund policy (see section 9).

### Counsellor
- `POST /counsellors/me/stripe-onboarding` — create connected account if missing, then return a fresh Account Link URL.
  ```python
  stripe.Account.create(
      country="AU",
      email=counsellor.email,
      business_type="individual",
      controller={
          "stripe_dashboard": {"type": "express"},
          "fees": {"payer": "application"},
          "losses": {"payments": "application"},
      },
      capabilities={"card_payments": {"requested": True}, "transfers": {"requested": True}},
      metadata={"counsellor_id": counsellor.id},
  )
  stripe.AccountLink.create(
      account=account_id,
      type="account_onboarding",
      refresh_url=f"{APP_BASE_URL}/stripe/onboarding/refresh",
      return_url=f"{APP_BASE_URL}/stripe/onboarding/return",
  )
  ```
  Account Links are single-use, expire within minutes, and require HTTPS URLs. Always generate a new one on request.
- `GET /stripe/onboarding/return` — redirect to the app deep link (e.g. `myapp://onboarding-complete`). Do not treat this as "onboarding finished"; status comes from webhooks.
- `GET /stripe/onboarding/refresh` — create a new Account Link and redirect to it.
- `GET /counsellors/me/payout-status` — returns `charges_enabled`, `payouts_enabled`.

## 8. Webhooks

Both handlers must read the **raw request body** (`await request.body()`) for signature verification, verify with the correct secret, and be idempotent (skip already-processed event IDs).

### `POST /webhook` (platform events, `STRIPE_WEBHOOK_SECRET`)
- `payment_intent.succeeded`:
  - Load booking from `metadata.booking_id`.
  - If already `confirmed`, return 200.
  - If the slot is still held or free → set `confirmed`, send confirmation to job seeker and counsellor, create meeting link if applicable.
  - If the hold expired and the slot was taken → `stripe.Refund.create(payment_intent=...)`, set `refunded_slot_taken`, notify job seeker.
- `payment_intent.payment_failed`: log; leave booking `pending_payment` (cleanup job releases it).
- `charge.dispute.created`: flag booking for admin review.

### `POST /webhook/connect` (connected account events, `STRIPE_CONNECT_WEBHOOK_SECRET`)
- `account.updated`: update counsellor's `charges_enabled` and `payouts_enabled` by `stripe_account_id`.

Only counsellors with `payouts_enabled=true` should appear in search and accept bookings.

## 9. Background jobs

- **Release expired holds**: bookings in `pending_payment` past `hold_expires_at` → `cancelled`, slot freed. If a PaymentIntent exists, cancel it with `stripe.PaymentIntent.cancel`.
- **Mark completed**: confirmed bookings whose `end_time` has passed → `completed` (unless flagged for no-show/dispute).
- **Pay counsellors**: `completed` bookings past `PAYOUT_DELAY_HOURS` with no `transfer_id`:
  ```python
  intent = stripe.PaymentIntent.retrieve(booking.payment_intent_id)
  transfer = stripe.Transfer.create(
      amount=booking.counsellor_payout_cents,
      currency="aud",
      destination=counsellor.stripe_account_id,
      transfer_group=f"booking_{booking.id}",
      source_transaction=intent.latest_charge,
      idempotency_key=f"transfer-{booking.id}",
  )
  ```
  Set `transfer_id` and `status=paid_out`. Never transfer if `transfer_id` is already set.

Use whatever scheduler the project already has (or suggest one, e.g. APScheduler / Celery / cron).

## 10. Cancellations and refunds

- **Before payout** (no `transfer_id`): refund job seeker per policy with `stripe.Refund.create(payment_intent=..., amount=...)`. Full refund if cancelled ≥ `CANCELLATION_FULL_REFUND_HOURS` before start; otherwise per client policy (TBD).
- **After payout**: first `stripe.Transfer.create_reversal(transfer_id, amount=...)` to recover the counsellor's share, then refund the job seeker.
- Counsellor cancels: always full refund to job seeker.

## 11. Receipts and statements (GST, agent model)

- **Job seeker receipt**: issued in the **counsellor's name** as supplier. If the counsellor is GST-registered, it's a tax invoice showing counsellor ABN and GST amount. Otherwise a plain receipt with no GST line. Generated and emailed by the backend on confirmation.
- **Counsellor commission statement**: monthly tax invoice from the platform to each counsellor listing bookings, commission, and platform GST, with the platform ABN.

Build receipt generation from the stored booking snapshot fields only.

## 12. Expo app

- Install: `npx expo install @stripe/stripe-react-native expo-linking expo-web-browser`
- `app.json` plugin:
  ```json
  ["@stripe/stripe-react-native", {
    "merchantIdentifier": "merchant.com.yourcompany.yourapp",
    "enableGooglePay": false
  }]
  ```
- Wrap app in `StripeProvider` with publishable key, `merchantIdentifier`, and `urlScheme`.
- **Booking flow**: select counsellor + session type + time → `POST /bookings` → `initPaymentSheet({ merchantDisplayName, paymentIntentClientSecret, returnURL, applePay: { merchantCountryCode: 'AU' } })` → `presentPaymentSheet()` → on success, poll/fetch `GET /bookings/{id}` until `confirmed` and show confirmation. Treat `Canceled` error code as user cancel, not failure.
- Show the cancellation policy **before** payment.
- **Counsellor onboarding**: "Set up payouts" button → `POST /counsellors/me/stripe-onboarding` → `WebBrowser.openAuthSessionAsync(url, 'myapp://onboarding-complete')` → refetch payout status. Show a prompt to finish onboarding if `payouts_enabled` is false.
- Counsellor profile form: ABN (optional, validate 11 digits) and GST-registered toggle.
- Apple Pay requires a development build (not Expo Go).

## 13. Security rules

- Never trust prices, amounts, or booking status from the app.
- Secret keys only on the backend, loaded from env.
- Verify webhook signatures on the raw body.
- Use idempotency keys on PaymentIntent and Transfer creation.
- Authorise every booking/counsellor endpoint (job seekers only see their bookings; counsellors only their own onboarding).

## 14. Local testing

```bash
stripe listen --forward-to localhost:8000/webhook --forward-connect-to localhost:8000/webhook/connect
```

- Test cards: `4242 4242 4242 4242` (success), `4000 0000 0000 0002` (decline), `4000 0025 0000 3155` (3D Secure).
- Onboarding URLs must be HTTPS: use a tunnel (e.g. ngrok) for `APP_BASE_URL` when testing locally.
- Mock Stripe calls in pytest; test amount calculation, slot double-booking, webhook idempotency, expired-hold refund path, and no double transfers.

## 15. Suggested implementation phases

1. Data model + migrations + amount calculation (with tests)
2. Counsellor Stripe onboarding + Connect webhook
3. Booking creation + PaymentIntent + platform webhook + hold expiry job
4. Expo booking/payment screen + counsellor onboarding screen
5. Session completion + payout job
6. Cancellations/refunds
7. Receipts and commission statements
8. Apple Pay configuration and dev build testing