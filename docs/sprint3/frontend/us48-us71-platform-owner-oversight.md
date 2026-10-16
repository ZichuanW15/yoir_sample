# US-48 and US-71 frontend: order detail, Users and the Overview

Issues: front-end sub-issues [#208](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/208)
and [#229](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/229), under
[US-48 #45](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/45) and
[US-71 #77](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/77).

This closes the two gaps the [Sprint 2 administration document](../../sprint2/frontend/us48-us58-us71-platform-owner-administration.md)
left: there was no order detail screen (US-48) and no list of Job Seekers (US-71). It also redesigns
the Overview. It reached `dev` on 5 October 2026 in
[PR #232](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/232) (commits `6f11b90`
and `7dc5527`). The verification screens in the same PR are documented in
[US-33 and US-58](us33-us58-verification-review.md).

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 61, 62,
67, 68 and 70.

## Screens and flow

| Route | File | What the Platform Owner sees |
|---|---|---|
| `/admin` | [`app/admin/index.tsx`](../../../frontend/app/admin/index.tsx) | Overview: gross taken, the people-to-sessions flow, Needs you, Activity and Money. |
| `/admin/payments` | [`app/admin/payments.tsx`](../../../frontend/app/admin/payments.tsx) | Orders, newest first; each row now opens its detail. |
| `/admin/payments/[orderId]` | [`app/admin/payments/[orderId].tsx`](../../../frontend/app/admin/payments/[orderId].tsx) | New. One order: progress, who and when, money. |
| `/admin/counsellors?role=` | [`app/admin/counsellors.tsx`](../../../frontend/app/admin/counsellors.tsx) | Users (was Professionals): Career Professionals or Job Seekers. |

The bottom-bar tab "Professionals" is now "Users" ([`src/admin/shell.tsx`](../../../frontend/src/admin/shell.tsx)).
A detail screen keeps its tab lit and shows a back link named after its list.

## Behaviour and states

### Order detail (US-48)

- **Progress:** Payment, Order and Session tags. Session reads "Not booked" when the order has no
  booking.
- **Who and when:** Job Seeker, Career Professional, Service, and the session time in the booking's
  own timezone with the zone beside it, so the two always agree. An unknown zone falls back to the
  device's time. Delivery shows Online or In person.
- **Money:** service price, Yoir commission, Career Professional amount and any refund, to the cent.
- **Payment reference** at the foot, selectable. No card data is requested or shown.
- Read again on every opening; nothing on the screen changes an order. "This order could not be
  found." for an unknown id.

### Payments list

- Rows show the payment-status tag, "Job Seeker paid Career Professional", the split and "Order:
  <status>". Back-end values read as words: `readable` replaces every underscore, so
  `refunded_slot_taken` reads "Refunded slot taken" (Sprint 2 showed "refunded slot_taken").
- Reloads on focus, so an order reopened from its detail is read again.

### Users (US-71)

- Two chips, "Career Professionals · n" and "Job Seekers · n". The choice lives in the address
  (`role=job_seeker`), so the Overview can open either list and a reload stays where it was.
- **Career Professional row:** name, email, "Career Professional" tag, verification tag in the shared
  wording, "Email confirmed" and "Payouts ready" flags (or their negatives), the warning "Verified but
  cannot be paid, so nothing they list can be booked." when it applies, Services, Bookings, Gross,
  Earned and the joining date. The row opens their verification submission.
- **Job Seeker row:** name, email, "Job Seeker" tag, number of bookings, email flag and joining date.
  Read-only.
- Empty: "No Career Professionals yet." or "No Job Seekers yet."

### Overview

- **Hero:** "Taken through Yoir" with the gross counting up, the number of sessions, and a Job Seekers
  → Career Professionals → Sessions booked flow with animated arrows. Each step opens its list.
- **Needs you:** pending verifications and verified-but-unpayable Career Professionals, each opening
  its list, or "Nothing is waiting on you."
- **Activity:** Active services, Holds awaiting payment, and "Sessions by status" as bars (opens
  Bookings).
- **Money, "Where it went":** a split bar of Career Professional payouts and Yoir commission, plus a
  "No split recorded" part when needed, so the bar always adds up to the gross. Then commission GST,
  session GST and refunded.
- Side by side from 860 px wide; stacked on a phone.

### All admin screens

A failed read shows `LoadFailed`: the reason and Try again, instead of the Sprint 2 banner over an empty
list.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getPlatformStats` | `GET /admin/stats` | Overview. |
| `api.listPaymentOversight` | `GET /admin/payments` | Payments list; the order detail picks its row from it. |
| `api.listAllBookings` | `GET /admin/bookings` | The order detail takes the session time and status from the matching booking. |
| `api.listAllCounsellors` | `GET /admin/counsellors` | Users, Career Professionals. |
| `api.listAllJobSeekers` | `GET /admin/job-seekers` | New. Users, Job Seekers: name, email, email confirmed, bookings, joined; newest first. |

`GET /admin/job-seekers` was added in the same PR (`7dc5527`) so the Users screen had something to
read, with its OpenAPI entry, traceability row and back-end test
(`test_the_job_seeker_list_counts_what_each_has_booked`). Back-end sub-issue
[#230](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/230) is still open on the
board.

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| US-48: orders list with payment status, price, commission, Career Professional amount and progress | Payments rows | `verification-admin-client.test.ts` "listPaymentOversight reads /admin/payments…"; walkthrough 67 |
| US-48: an order opens a detail screen with status, participants, service, slot, amounts and progress | Order detail | Walkthrough 68; back end `test_one_order_shows_its_parties_session_split_and_progress`. Screen: not unit tested |
| US-48: reopened order matches the back end | Read on every opening and on focus | Checked manually |
| US-48: other roles refused; no oversight navigation | Back end; the shell redirects other roles | Back end `test_the_admin_area_is_closed_to_everyone_else` |
| US-48: failed read shows an error, no stale data | `LoadFailed` with Try again | Not unit tested |
| US-71: Job Seekers and Career Professionals listed with role and status | Users screen, both lists | `verification-admin-client.test.ts` "listAllJobSeekers reads /admin/job-seekers…" and "listAllCounsellors…"; walkthrough 70 |
| US-71: Career Professional status consistent with US-32 and US-58 | Same `VerificationTag` as the queue and the Career Professional's own screens | Walkthrough 63, 70 |
| US-71: other roles refused; no oversight navigation | As US-48 | As US-48 |
| US-71: failed read shows an error, no stale data | `LoadFailed`; no list shown | Not unit tested |

## Tests

- [`__tests__/api/verification-admin-client.test.ts`](../../../frontend/__tests__/api/verification-admin-client.test.ts):
  the five admin reads (stats, payments, bookings, counsellors, job seekers) each carry the caller's
  bearer token. The Job Seeker case is new.
- Back end, [`backend/tests/test_admin.py`](../../../backend/tests/test_admin.py):
  `test_the_job_seeker_list_counts_what_each_has_booked`.
- No Jest test renders the Overview, Users or order detail screen.

Run from `frontend/`: `npx jest __tests__/api/verification-admin-client.test.ts`. Local run on `dev` at
`d3b7026`, 16 October 2026, Node 22.14.0: 13 passed.

## Known gaps

- **Single read:** the order detail loads every order and every booking to show one.
  `GET /admin/payments/{orderId}` was added on 14 October (`6b9a7d8`, Jashan), with the hold expiry,
  completion and payout times, and is not called yet. Until then an order older than the list's
  200-row default reads "could not be found".
- Bookings and payments still stop at 200 rows, with no paging.
- No screen tests for the admin area.
