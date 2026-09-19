# US-48, US-58 and US-71 frontend: Platform Owner administration

Issues: [US-58 #28](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/28),
[US-48 #45](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/45) and
[US-71 #77](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/77). No front-end
sub-issue exists; the FE sub-tasks in each issue body are unconverted checklist items.

This slice gives a Platform Owner a read-mostly administration area at `/admin`: an overview of
people, activity and money, the Career Professional verification queue, a Career Professional list,
every booking and every order's payment split. It reached `dev` on 18 September 2026 in
[PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157) (admin panel) and
[PR #159](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/159) (overview tiles,
bottom navigation, role-aware landing), built alongside the committed Sprint 2 stories. All three
issues sit in the Product Backlog column, not Sprint 2, and none is claimed as accepted. The client's
scope note in the backlog files basic owner user and booking/order views under US-57 and US-59, which
have no tracker issue; this document follows the issues, which place them in US-48 and US-71.

## Screens and flow

| Route | File | What the Platform Owner sees |
|---|---|---|
| `/admin` | [`app/admin/index.tsx`](../../../frontend/app/admin/index.tsx) | Overview: People, Activity and Money sections. |
| `/admin/verifications` | [`app/admin/verifications.tsx`](../../../frontend/app/admin/verifications.tsx) | Verification queue with Approve and Reject. |
| `/admin/counsellors` | [`app/admin/counsellors.tsx`](../../../frontend/app/admin/counsellors.tsx) | Career Professionals, newest first, with their trade. |
| `/admin/bookings` | [`app/admin/bookings.tsx`](../../../frontend/app/admin/bookings.tsx) | Every booking, latest session start first. |
| `/admin/payments` | [`app/admin/payments.tsx`](../../../frontend/app/admin/payments.tsx) | Every order's payment status and split, newest first. |

Every screen renders inside `AdminShell` in [`src/admin/shell.tsx`](../../../frontend/src/admin/shell.tsx):
the Yoir wordmark, an avatar that opens the account sheet (where Log out lives), the "Yoir
administration" heading, and a bottom bar with five tabs (Overview, Verify, Professionals, Bookings,
Payments) that switch with `router.replace`. Content is capped at 1080 px wide for desktop reading.

Entry: `homeFor('platform_owner')` in [`src/navigation.ts`](../../../frontend/src/navigation.ts)
returns `/admin`, and both the login screen and the entry screen use it. The entry screen's "Already
have an account? Log in" link is how an administrator reaches the login form. The Platform Owner
account is created from `ADMIN_EMAIL`/`ADMIN_PASSWORD` on backend start-up; it cannot self-register.

## Behaviour and states

- **Guard:** while the stored session is restoring, the shell shows a spinner. No session redirects
  to `/auth/login`; any other role redirects to `/`. The shell's own comment calls this a
  convenience: the backend refuses every `/admin/*` call from other roles.
- **Other roles:** the Job Seeker and Career Professional bottom bars and the account sheet contain
  no admin link. The account sheet hides "My sessions" from a Platform Owner.
- **Loading:** each screen reads once on mount and shows a spinner until the first answer. There is
  no pull-to-refresh or retry button; revisiting a tab mounts the screen and reads again.
- **Errors:** `userFacingError` text in an `ErrorBanner`. On the four list screens a failed read also
  sets the list to empty, so the empty-state line ("Nothing has been booked yet.", "No orders yet.",
  "No Career Professionals yet.", "Nobody is waiting on a decision.") shows under the banner.
- **Overview:** a callout "n Career Professional(s) waiting on a decision" when any are pending. Tiles:
  Job seekers, Career Professionals, Awaiting review, Cannot be paid (verified but payouts not set up;
  tinted when above nought), Active services, Holds awaiting payment, then one tile per booking status
  present. Linked tiles open the matching tab. Four tiles to a row from 860 px wide. The Money card
  shows gross taken, Career Professional payouts, Yoir commission and its GST, session GST and
  refunded, all summed by the backend from each order's frozen breakdown.
- **Verifications:** filter chips Waiting (default), Approved, Rejected and Everyone; changing the
  filter clears the list and reloads. Each card shows name, email, a status tag with the raw value
  (`pending`, `verified`, `rejected`), the application date, the LinkedIn URL (tapped, it goes to
  `Linking.openURL`) or "No LinkedIn profile supplied — there is nothing to check.", the introduction,
  background and experience, and the last decision reason if any.
- **Deciding:** only pending cards have actions. Approve sends at once. Reject opens a "Why are you
  rejecting this?" field and becomes "Confirm rejection"; an empty reason is refused in the app
  ("Say why, so the Career Professional knows what to change.") with no request sent. During the call
  both buttons are busy. Success shows a toast ("… is verified" / "… was rejected") and reloads, so an
  approved card leaves the Waiting list. A failure shows the banner and leaves the card as last read,
  still pending. There is no Leave pending button; not deciding leaves the submission pending.
- **Career Professionals:** status tag, "Email confirmed" and "Payouts ready" flags, the warning
  "Verified but cannot be paid, so nothing they list can be booked.", services, bookings, gross and
  earned (whole dollars) and the joining date. Read-only.
- **Bookings:** service, status tag (raw value), "Job Seeker with Career Professional", date and time
  with the booking's `timezone` in brackets, modality, amount and any refund. Read-only.
- **Payments:** service, payment-status tag, "Job Seeker paid Career Professional", Total, Career
  Professional, Yoir and Refunded amounts in cents, then date, order status and payment id (the Stripe
  PaymentIntent id, or the order id for a stub-paid order). No card data is requested or shown.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getPlatformStats` | `GET /admin/stats` | Counts and money totals. Money counts only `confirmed`, `refunded_slot_taken` and `cancelled` orders. |
| `api.listVerificationSubmissions(status)` | `GET /admin/verifications?status=` | `pending`, `verified`, `rejected` or `all`; oldest first; `400` for other values. |
| `api.decideVerification(id, decision, reason)` | `POST /admin/verifications/{id}/decision` | Body `{decision, reason}`. `400` if rejected without a reason; `404` if not a Career Professional. The decision email is sent after commit and cannot undo it. |
| `api.listAllCounsellors` | `GET /admin/counsellors` | All Career Professionals, newest first, with service and booking counts, gross and payout. |
| `api.listAllBookings` | `GET /admin/bookings` | Default limit 200, `starts_at` descending. |
| `api.listPaymentOversight` | `GET /admin/payments` | Default limit 200, `created_at` descending. |

Every endpoint requires `require_platform_owner`, which reads the role from the database, not the token.

## Acceptance criteria

| Criterion (story) | Frontend behaviour | Evidence |
|---|---|---|
| Queue lists pending submissions with name and LinkedIn URL; the URL opens outside the app (US-58) | Waiting filter by default; name and URL on each card; URL goes to `Linking.openURL` | `verification-admin-client.test.ts` "the verification queue filters by status in the query string"; backend `test_the_queue_shows_only_pending_by_default`, `test_the_queue_lists_pending_counsellors_oldest_first`. Screen and device link-out: Not covered |
| Approve and confirm; Verified shown only after the backend stores it; leaves the pending list (US-58) | No confirmation step for Approve; toast and reload only after success | Backend `test_approving_a_counsellor_records_it_and_tells_them`. Screen: Not covered (PR #159 records that Approve/Reject were not clicked) |
| Reject and confirm, with any reason entered (US-58) | Two-step reject; reason required by app and backend | `verification-admin-client.test.ts` "a decision carries its reason, which the counsellor is emailed"; backend `test_rejecting_requires_a_reason_and_passes_it_on`. Screen: Not covered |
| Leave pending or go back keeps it pending and queued (US-58) | No explicit action; no request is made unless a decision is sent | Not covered |
| Job Seeker or Career Professional sessions are rejected (US-58, US-48, US-71) | Shell redirects other roles; no admin navigation for them | Backend `test_the_admin_area_is_closed_to_everyone_else`, `test_a_forged_owner_claim_does_not_open_the_admin_area`. Frontend redirect: Not covered |
| A failed decision shows an error and the submission stays Pending (US-58) | Banner; card not reloaded | Not covered |
| Orders list with payment status, price, commission, Career Professional amount and progress (US-48) | Payments tab: status tag, Total, Career Professional, Yoir, order status | `verification-admin-client.test.ts` "listPaymentOversight reads /admin/payments with the caller's bearer token"; backend `test_payment_oversight_names_both_parties_and_no_card_details`. Screen: Not covered |
| Tapping an order opens a detail screen with participants, service, slot, amounts and progress (US-48) | No detail screen; payment cards omit the slot time | Not met |
| Reopened order matches the backend record (US-48) | Every visit re-reads; nothing cached | Not covered |
| Failed oversight read shows an error, not stale data (US-48, US-71) | Banner, no stale rows; the empty-state line also shows | Not covered |
| User oversight lists Job Seekers and Career Professionals with role and status (US-71) | Career Professionals listed; Job Seekers only counted on Overview | Partly met. `verification-admin-client.test.ts` "listAllCounsellors reads /admin/counsellors with the caller's bearer token"; backend `test_the_counsellor_list_totals_what_each_has_sold` |
| Career Professional rows show pending, verified or rejected consistently (US-71) | Tag from the same `verification_status` the queue uses | Screen: Not covered |

## Tests

- [`__tests__/api/verification-admin-client.test.ts`](../../../frontend/__tests__/api/verification-admin-client.test.ts),
  "administration calls": seven cases pin each admin URL, bearer header, query string, decision body
  and path escaping.
- [`__tests__/navigation.test.ts`](../../../frontend/__tests__/navigation.test.ts): "a Platform Owner
  opens on the dashboard, not the marketplace". [`__tests__/screens/navigation.test.tsx`](../../../frontend/__tests__/screens/navigation.test.tsx):
  "[QA-100] an existing platform_owner session opens its signed-in destination".
- The archived probe [`__tests__/planned/admin-landing.test.tsx`](../../../frontend/__tests__/planned/admin-landing.test.tsx)
  ("a backend-confirmed Platform Owner reaches a distinct landing area") now passes under
  `jest.config.planned.js`. It is outside the QA totals and has not been promoted.
- No Jest test renders an admin screen or `AdminShell`, and no Playwright spec or device run covers
  them. The [dev-sync review](../qa/dev-sync-review-20260918.md) lists them as unexercised new admin
  screens in whole-frontend coverage.
- Manual: the PR #159 author drove all five screens at 390 px and 1440 px as a Platform Owner and
  reported `200` for the owner and `403` for a Job Seeker on every admin endpoint.

Local run on `dev` at `64cb324`, 18 September 2026: the three frontend files above passed
(24 tests), and the planned probe passed (1). Backend on its temporary SQLite database:
`tests/test_admin.py` 27 passed, `tests/test_admin_bootstrap.py` 6 passed.

## Known gaps

- No Job Seeker list (US-71) and no order or booking detail screen (US-48).
- Approve has no confirmation step, and there is no explicit Leave pending action (US-58 scope).
- Decided submissions have no actions, so there is no re-review from this screen (US-33 territory).
- Status tags show raw backend values, and the payments meta line replaces only the first underscore,
  so `refunded_slot_taken` reads "refunded slot_taken".
- Booking times are formatted in the viewing device's time zone but labelled with the booking's
  `timezone`; the two disagree when they differ.
- Bookings and payments stop at the backend's default 200 rows, with no paging in the app.
- A failed read shows the error banner and the empty-state line together, with no retry control.
