# US-48 and US-71 backend: order oversight and user lists for the Platform Owner

Issues: back-end sub-issues [#209](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/209)
and [#230](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/230), under
[US-48 #45](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/45) and
[US-71 #77](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/77).

Read-only endpoints for the Platform Owner: every order's payment and progress (US-48) and every
account by role (US-71). The lists of orders, bookings and Career Professionals, and the dashboard
totals, reached `dev` on 18 September 2026 in
[PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157) (commit `70232ce`).
Manu added the Job Seeker list on 5 October 2026 in
[PR #232](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/232) (commit `7dc5527`),
so the Users screen had something to read. Sprint 3 adds `GET /admin/payments/{orderId}`, one order
with its progress found by id however old it is, in
[PR #238](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/238) (commit `6b9a7d8`,
14 October 2026). The screens are documented in
[US-48 and US-71 frontend](../frontend/us48-us71-platform-owner-oversight.md); the verification queue
is in [US-58 backend](us58-verification-review.md).

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 61, 62,
67, 68 and 70.

## Endpoints and flow

All in [`app/routers/admin.py`](../../../backend/app/routers/admin.py).

| Endpoint | Code | What it does |
|---|---|---|
| `GET /admin/payments` | `list_payment_oversight` | US-48: every order's payment status and split, newest first. `limit` defaults to 200, at most 1,000. |
| `GET /admin/payments/{orderId}` | `get_payment_oversight` | US-48: one order end to end. `404` for an unknown id. |
| `GET /admin/bookings` | `list_all_bookings` | US-48: every booking, both parties named, latest session first. Same `limit`. |
| `GET /admin/stats` | `get_platform_stats` | US-48: counts and money totals for the Overview. |
| `GET /admin/counsellors` | `list_all_counsellors` | US-71: every Career Professional, newest first, with what they have sold. |
| `GET /admin/job-seekers` | `list_all_job_seekers` | US-71: every Job Seeker, newest first, with how many sessions they have booked. |

## Behaviour and states

### All six

- **Platform Owner only:** each route depends on `require_platform_owner`, which reads the role from
  the database row, never from the token. Other roles get `403 FORBIDDEN`, and no session gets `401`.
  A correctly signed token claiming `platform_owner` for a Job Seeker's account is still refused.
- **Read-only:** nothing here changes an order, a payment or an account.
- **Money is read, not recomputed:** every amount is the breakdown frozen on the order at purchase,
  the same figures as the buyer's receipt. Changing the commission setting later does not restate past
  orders.
- **No card data:** none is stored, so none can be returned. `paymentId` is the Stripe PaymentIntent
  id, or the order id for a stub-paid order.
- **Titles as purchased:** the service title is the one frozen on the order
  ([US-36](us36-service-edit-and-removal.md)), so renaming a service does not rewrite old orders.

### Orders (US-48)

- **List row:** both parties' names, the service, total, Yoir commission, Career Professional amount,
  refund, payment status, order status, booking id and creation time.
- **Order detail:** the list row unchanged, plus:
  - both parties' ids and emails, and the service id;
  - the session's start, end, timezone and modality, read off the order so an unpaid order still
    shows the time it holds;
  - session GST and the GST on the commission;
  - `holdExpiresAt`, set only while the order is awaiting payment;
  - the booking's status (`null` until there is a booking), and when it completed, was paid out or
    was cancelled, and by which role.
- **One source for both:** the list and the detail share one query and one field mapping, so they
  cannot disagree.
- **Progress:** an order moves from `awaiting_payment` to `confirmed`, `cancelled` or
  `refunded_slot_taken`. Its booking moves from `confirmed` to `completed` when the scheduled job sees
  the session has ended, then to `paid_out` after the payout delay, or to `cancelled` or `refunded`.
- **Dashboard totals:** count money only from orders where it moved (`confirmed`,
  `refunded_slot_taken`, `cancelled`); an unpaid hold is not money.

### Users (US-71)

- **Career Professionals:** name, email, email confirmed, verification status, submission time,
  charges and payouts enabled, number of services and bookings, gross and payout to the cent, and the
  joining date.
- **Job Seekers:** name, email, email confirmed, number of bookings and the joining date.
- **Role:** each list holds one role, so the role is given by the endpoint rather than a field.
- **Status:** a Career Professional's `verificationStatus` is the same column the verification queue
  decides and the Career Professional's own screens read, so all three always agree.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listPaymentOversight` | `GET /admin/payments` | Payments list. |
| Not called yet | `GET /admin/payments/{orderId}` | The order screen still picks its row from the two lists. |
| `api.listAllBookings` | `GET /admin/bookings` | The order screen takes the session from the matching booking. |
| `api.getPlatformStats` | `GET /admin/stats` | Overview. |
| `api.listAllCounsellors` | `GET /admin/counsellors` | Users, Career Professionals. |
| `api.listAllJobSeekers` | `GET /admin/job-seekers` | Users, Job Seekers. |

## Acceptance criteria

| Criterion | Backend behaviour | Evidence |
|---|---|---|
| US-48: orders list with payment status, price, commission, Career Professional amount and progress | `GET /admin/payments` | `test_payment_oversight_names_both_parties_and_no_card_details`, `test_the_dashboard_totals_are_the_frozen_order_breakdown`, `test_an_unpaid_hold_is_not_counted_as_money` |
| US-48: an order opens with its status, participants, service, slot, amounts and progress | `GET /admin/payments/{orderId}` | `test_one_order_shows_its_parties_session_split_and_progress`, `test_an_order_shows_how_far_its_session_has_got`, `test_an_unpaid_order_shows_the_time_it_holds_and_no_booking` |
| US-48: a reopened order matches the back end's record | Read from the order on every request; nothing cached | `test_one_order_shows_its_parties_session_split_and_progress` (the detail repeats the list row exactly), `test_an_order_is_found_however_far_down_the_list_it_has_fallen` |
| US-48 and US-71: other roles refused | `401` or `403` on every route | `test_the_admin_area_is_closed_to_everyone_else` (all six lists, three callers each), `test_single_records_are_closed_to_everyone_else`, `test_a_forged_owner_claim_does_not_open_the_admin_area` |
| US-48 and US-71: a failed read shows an error, no stale data | A structured error, such as `404 NOT_FOUND` for an unknown order; the error screen is the app's | `test_an_unknown_order_is_a_404` |
| US-71: Job Seekers and Career Professionals listed with role and relevant status | Two lists, one per role | `test_the_job_seeker_list_counts_what_each_has_booked`, `test_the_counsellor_list_totals_what_each_has_sold`, `test_a_counsellor_who_has_sold_nothing_still_appears`, `test_verified_counsellors_who_cannot_be_paid_are_counted` |
| US-71: Career Professional status consistent with US-32 and US-58 | Same `verification_status` column | No test reads one Career Professional through both the list and the queue |

## Tests

- [`tests/test_admin.py`](../../../backend/tests/test_admin.py): 52 tests. The file also covers the
  verification queue ([US-58](us58-verification-review.md)) and submissions (US-31–33). The role tests
  run once per list for each of three callers.

Run from `backend/`:

```bash
env -u DATABASE_URL uv run pytest tests/test_admin.py -q
```

Local run on `dev` at `a6eeb35`, 18 October 2026, Python 3.12.14, temporary SQLite database: 52 passed.

## Known gaps

- **The order screen does not use the order endpoint yet.** It loads the payments and bookings lists
  and picks its row, so an order older than the newest 200 reads "could not be found" in the app,
  although the endpoint finds it.
- Lists stop at `limit` (at most 1,000) with no paging, search or filter.
- Neither user list carries a `role` field, and Platform Owner accounts appear in neither.
- The order detail exposes both parties' emails to the Platform Owner. That is intended for oversight,
  but no story records it.
