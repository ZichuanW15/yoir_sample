# US-47 frontend: Career Professional payouts

Issue: [US-47 #44](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/44). No
front-end sub-issue covers payouts, and no backlog story does. The code labels this screen US-47,
because the Stripe design only lets a Career Professional who can be paid be found and booked. US-47
itself lists live payouts as out of scope, and `CLIENT-02` says actual settlement and payouts can wait.

This slice lets a Career Professional connect a Stripe account through Stripe-hosted onboarding, see
whether Stripe will pay them, and record the ABN and GST registration that their Job Seekers'
receipts are issued under. It reached `dev` on 18 September 2026 in
[PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157), built during
Sprint 2 alongside the committed stories. US-47 is in the Sprint 2 column, but nothing here is part
of its acceptance criteria, and nothing here is claimed as accepted. The
[Sprint 2 review](../client-feedback/sprint-2-review-and-client-feedback.md) records that live payouts
remain deferred and that the sample commission and payout settings are not client-approved.

## Screens and flow

| Route or surface | File | What the Career Professional sees |
|---|---|---|
| `/counsellor/payouts` | [`app/counsellor/payouts.tsx`](../../../frontend/app/counsellor/payouts.tsx) | "Getting paid": a Stripe status card and a Tax details form. |
| Workspace prompt | [`app/counsellor/index.tsx`](../../../frontend/app/counsellor/index.tsx) | "Set up payouts" or "Finish payout setup" until payouts are enabled; then a "Payouts" row reading "Ready · GST registered" or "Ready · not GST registered". |

Shared code: [`src/payments/payoutStage.ts`](../../../frontend/src/payments/payoutStage.ts) (stage,
button label, heading), [`src/payments/waitForPayouts.ts`](../../../frontend/src/payments/waitForPayouts.ts)
(polling), and the platform launchers [`onboarding.ts`](../../../frontend/src/payments/onboarding.ts)
(device: `WebBrowser.openAuthSessionAsync`, returning to `Linking.createURL('/counsellor/payouts')`)
and [`onboarding.web.ts`](../../../frontend/src/payments/onboarding.web.ts) (browser:
`window.location.assign`, returning to `<origin>/counsellor/payouts`). Metro picks the launcher by
platform.

Flow: the workspace card or row opens `/counsellor/payouts`. The main button asks the backend for a
fresh Account Link, opens Stripe with it, and re-reads the status once the Career Professional is back.

## Behaviour and states

- **Guard:** no session, or any role other than `counsellor`, redirects to `/`.
- **Reading:** the status is read each time the screen gains focus, because onboarding finishes in a
  browser. The ABN and GST fields are filled from the response.
- **Stage:** `payoutStage` gives `not_started` (no status, or no account), `in_progress` (an account
  but `onboardingRequired`) or `ready` (the server reports `onboardingRequired: false`). Headings are
  "Payouts not set up", "Setup not finished" and "Ready to be paid". The button reads "Set up payouts",
  "Continue payout setup" or "Update payout details".
- **Tags:** "Charges enabled/pending" follows `chargesEnabled`; "Payouts enabled/pending" follows the
  stage, not the raw `payoutsEnabled` flag.
- **Waiting for Stripe:** when an account exists but is not ready, `waitForPayouts` polls up to 12
  times, 2.5 s apart (about 30 seconds). It updates the card on every answer, ignores a failed poll,
  stops once ready, and stops when the screen loses focus. Meanwhile the heading reads "Confirming
  with Stripe…". If the window ends first, the card says "Stripe still needs something from you.
  Until it is done, your services stay hidden from Explore."
- **Onboarding errors:** shown in the banner, for example `503 PAYMENTS_UNAVAILABLE` ("Payouts are
  not configured on this server.") or `502 PAYMENT_PROVIDER_ERROR`.
- **Tax details:** the ABN field keeps digits only, at most 11, displayed as "12 345 678 901".
  "An ABN is 11 digits." and "Required when you are registered for GST." are checked in the app
  before any request. The GST chips (Not registered, Registered) change the hint about what receipts
  will show. Saving shows "Tax details saved"; a server `abn` field error shows under the field, and
  the message shows in the banner.
- **Build note:** when `GET /payments/config` reports a provider other than `stripe`, the form says
  "This build is not connected to Stripe, so no real payouts are made yet."
- **Workspace:** its status read uses `.catch(() => null)`, so a failure never blocks the workspace;
  it also hides both the prompt and the Payouts row.

Transfers themselves are made by a backend job after each session (payments spec §9). The app shows
no transfer history or earnings on this screen.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getPayoutStatus` | `GET /me/payout-status` | Career Professional only. When payments are configured and an account exists but payouts are off, the backend reads the account from Stripe once before answering. |
| `api.startStripeOnboarding(token, returnTo)` | `POST /me/stripe-onboarding` | Body `{returnTo}`. Creates the connected account once, then a new single-use Account Link on every call. `returnTo` is honoured only for the app's scheme or an origin the server serves. |
| `api.updateTaxDetails(update)` | `PUT /me/tax-details` | Body `{abn, gstRegistered}`. `400` if GST-registered without an ABN. Affects bookings made from then on; earlier orders keep their snapshot. |
| `api.getPaymentConfig` (via `usePaymentConfig`) | `GET /payments/config` | Public; `provider` selects the build note. |

Readiness is never reported by the app: the backend updates `charges_enabled` and `payouts_enabled`
from Stripe's `account.updated` webhook or that single read-back.

## Acceptance criteria

No story has acceptance criteria for payouts. The rows below use the
[payments spec](../../payment/stripe-payment-spec.md) requirements that this screen implements.

| Criterion (story) | Frontend behaviour | Evidence |
|---|---|---|
| "Set up payouts" requests a fresh onboarding link, opens it, then re-reads status (spec §7, §12) | New link per press; status re-read on return and on focus | `payments/client.test.ts` "onboarding always asks the server for a new link rather than reusing one"; backend `test_onboarding_creates_the_account_once_and_a_fresh_link_every_time`, `test_onboarding_returns_the_counsellor_to_the_app_they_started_in`. Stripe sandbox and device return: Not covered |
| Prompt to finish onboarding while payouts are not enabled (spec §12) | Workspace card and payouts screen copy | `payoutStage.test.ts` "nothing started yet", "an account exists but Stripe is still verifying". Screens: Not covered |
| Readiness comes from the server, not the app (spec §7, §13) | Stage read from `onboardingRequired`; polling only reads | `payoutStage.test.ts` "readiness follows the server, not the raw flag", "fully set up is not told to continue setting up"; backend `test_payout_readiness_needs_a_connected_account_not_just_the_flag`, `test_onboarding_never_reports_readiness_from_the_app` |
| Status keeps updating after return while Stripe decides (spec §8 webhook timing) | `waitForPayouts` polling window | `waitForPayouts.test.ts`, all seven cases, including "keeps asking while Stripe is still deciding" and "stops immediately when the screen has gone away" |
| ABN optional, validated as 11 digits; GST-registered toggle (spec §12) | App checks, then `PUT` | `payments/client.test.ts` "tax details are sent with PUT, the method the contract publishes"; backend `test_tax_details_validate_the_abn_and_require_one_for_gst`. Screen validation: Not covered |
| Only Career Professionals Stripe can pay appear in search (spec §8) | Copy says services stay hidden from Explore until ready | Backend `test_the_marketplace_hides_counsellors_who_cannot_be_paid` |

## Tests

- [`__tests__/payments/payoutStage.test.ts`](../../../frontend/__tests__/payments/payoutStage.test.ts): 5 cases.
- [`__tests__/payments/waitForPayouts.test.ts`](../../../frontend/__tests__/payments/waitForPayouts.test.ts): 7 cases.
- [`__tests__/payments/client.test.ts`](../../../frontend/__tests__/payments/client.test.ts): 9 cases, two of
  them for payouts (tax details, onboarding).
- The workspace tests' shared mock ([`counsellor-screen-utils.tsx`](../../../frontend/__tests__/screens/counsellor-screen-utils.tsx))
  always returns a ready payout status, so the workspace prompt is never rendered in a test.
- `payouts.tsx` has no screen test. `onboarding.ts` and `onboarding.web.ts` are excluded from coverage
  in `jest.config.js` as platform seams. No Playwright spec, Stripe sandbox run or device run covers
  onboarding; the [dev-sync review](../qa/dev-sync-review-20260918.md) records that provider payments
  were not exercised.

Local run on `dev` at `64cb324`, 18 September 2026: the three frontend files passed (21 tests).
Backend on its temporary SQLite database, 27 passed with:

```bash
pytest tests/test_payments.py -k "onboarding or payout or tax_details or marketplace_hides"
```

## Known gaps

- No backlog story or client approval for payouts; the fee, delay and payout settings are samples.
- No earnings, transfer history or commission statements in the app. The backend serves
  `GET /me/commission-statements/{year}/{month}`, but the client has no call for it.
- The form never sends `legalName`, although `TaxDetailsUpdate` and the backend accept it.
- After the 30-second polling window, the Career Professional must leave and return to re-check.
- If the workspace's status read fails, it shows no payout prompt at all.
- The device return link from Stripe (`openAuthSessionAsync`) has not been verified on iOS or Android.
