# US-42 frontend: My sessions with the brief, the timezone and tabs

Issues: front-end sub-issue [#202](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/202),
under [US-42 #37](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/37).

The Sprint 2 "My sessions" screen ([US-42 and US-43, Sprint 2](../../sprint2/frontend/us42-us43-my-sessions-cancellation-and-receipts.md))
already listed upcoming and past bookings for both roles. US-42 adds what the story asks for and the
screen lacked: the Job Seeker's pre-session brief, collected before payment and shown on the booking,
and a timezone on every booking time. The two stacked sections also became Coming up and Past tabs, so
an empty Past reads as "nothing here" rather than a section that never appeared. This closes the
timezone and pre-session brief parts of the Sprint 2 gap "No booking detail screen, timezone label,
pre-session brief or reschedule (US-69)"; the detail screen and rescheduling are in
[US-43 and US-69](us43-us69-booking-detail-and-reschedule.md). It reached `dev` directly on 7 October
2026 in commit `c53bd0b`, with no pull request. The Sprint 2 document has since been edited in place to
describe these additions.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 32, 37, 57
and 58.

## Screens and flow

| Route | File | Change |
|---|---|---|
| `/services/[serviceId]/timeslots` | [`app/services/[serviceId]/timeslots.tsx`](../../../frontend/app/services/[serviceId]/timeslots.tsx) | An optional brief field once a time is chosen. |
| `/bookings` | [`app/bookings/index.tsx`](../../../frontend/app/bookings/index.tsx) | Coming up and Past tabs, a timezone on each time, and "Before the session" on upcoming cards. |

One screen serves both roles, because `GET /me/bookings` returns every booking the caller is a party
to. The issue scopes US-42 to the Career Professional; a Job Seeker sees the same screen with "With
<name>" in place of "For <name>". Entry points are unchanged from Sprint 2.

## Behaviour and states

### The brief, before payment

- Once a time is chosen, the field "Anything to share before the session? (optional)" appears, with
  the placeholder "What would you like to cover?". It takes several lines, up to 500 characters.
- The brief is trimmed and sent with the reservation; a blank one is sent as `null`. It is collected
  only here and cannot be changed after the order is placed.

### My sessions

- **Tabs:** "Coming up" (selected by default) and "Past", both always shown, with tab roles and the
  selected state for screen readers.
- **Which tab:** Coming up holds bookings that are not cancelled or refunded and start in the future,
  soonest first. Past holds the rest, in the back end's order.
- **Time:** "<date> · <time range> · <timezone>", for example "… · Australia/Melbourne". The time and
  the zone are the viewer's device's; the zone falls back to `Australia/Melbourne` if the device
  reports none.
- **Brief:** an upcoming card shows "Before the session" and the brief, to both roles (US-43 widened
  this from Career Professionals only). A past card, or a booking with no brief, shows none.
- **Empty:** Coming up says "Nothing booked yet", with "Sessions job seekers book with you will appear
  here." for a Career Professional, or "Find a Career Professional and book a session; it will appear
  here." and "Browse Career Professionals" for a Job Seeker. Past says "No past sessions" and
  "Sessions you've completed will appear here."
- **Failed read:** the error banner shows the reason, for example "We could not reach Yoir. Check your
  connection and try again." The list is set to empty, so the tab's empty state shows under the banner.
  Pull to refresh reads again.
- **Card actions:** the summary row opens the booking detail ([US-43](us43-us69-booking-detail-and-reschedule.md)).
  View receipt and Cancel are as in Sprint 2; "Write a review" ([US-53](us53-us55-reviews-and-ratings.md)) sits beside them on a past
  booking.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.createOrder(serviceId, startsAt, modality, timezone, preSessionBrief, token)` | `POST /orders` | New `preSessionBrief` argument, `null` when blank. The back end trims it, refuses more than 500 characters with `400 VALIDATION_ERROR`, and keeps it on the order. |
| `api.listMyBookings` | `GET /me/bookings` | Each booking now carries `preSessionBrief`, empty when none was given. Only the caller's own bookings. |

The service title on each booking is the one frozen on the order at purchase
([US-36 backend](../backend/us36-service-edit-and-removal.md)), so renaming a service does not change
bookings already made.

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| Upcoming shows each booking's service, Job Seeker, modality, time with timezone and pre-session brief as returned by the back end | Card: service title, "For <name>", modality, time with the device zone, "Before the session" | `counsellor-bookings.test.tsx` AT-US-42-1; walkthrough 57 |
| A booking whose time has passed appears under Past, not Coming up | Start time compared with the device clock | AT-US-42-2; walkthrough 37 |
| No bookings shows an empty state without an error | "Nothing booked yet" and "No past sessions" | "AC3: no bookings at all shows an explicit empty state on each tab, without an error" |
| Another user's token never returns this Career Professional's bookings | The app sends only the caller's token; the back end scopes the list | AT-US-42-3; back end `test_the_list_holds_only_the_callers_own_bookings` |
| Back end unreachable shows an error state rather than an empty list | Banner with the reason, but the empty state shows beneath it | AT-US-42-4 and "a backend error response also shows the error state rather than an empty list", which check the message only. Partly met |

## Tests

- [`__tests__/screens/counsellor-bookings.test.tsx`](../../../frontend/__tests__/screens/counsellor-bookings.test.tsx),
  12 tests, new in this change: AT-US-42-1 to 4, both tabs, the empty Past tab, the brief's
  upcoming-only display for both roles, and "US-43: tapping a booking opens its detail screen".
- [`__tests__/screens/timeslots.test.tsx`](../../../frontend/__tests__/screens/timeslots.test.tsx):
  "[US-42] an entered pre-session brief is trimmed and sent with the reservation" and "[US-42] the
  pre-session brief field only appears once a time is chosen".
- [`__tests__/api/client.test.ts`](../../../frontend/__tests__/api/client.test.ts): "createOrder sends a
  given pre-session brief (US-42)".
- Back end: [`backend/tests/test_my_bookings.py`](../../../backend/tests/test_my_bookings.py)
  (`test_a_pre_session_brief_is_trimmed_and_shown_to_both_parties`) and
  [`backend/tests/test_payments.py`](../../../backend/tests/test_payments.py) (the 500-character limit).

Run from `frontend/`: `npx jest __tests__/screens/counsellor-bookings.test.tsx __tests__/screens/timeslots.test.tsx __tests__/api/client.test.ts`.
Local run on `dev` at `0df4068`, 17 October 2026, Node 22.14.0: 41 passed (12, 13 and 16).

## Known gaps

- **Error state:** a failed read still shows "Nothing booked yet" under the banner, so AT-US-42-4's
  "rather than an empty list" is only partly met. There is no Try again button; only pull to refresh.
- **Timezone:** each party sees the time in their own device's zone, correctly labelled. The booking's
  stored `timezone` is not shown.
- **Brief:** cannot be added or changed once the order is placed.
- Sprint 2 gaps still open: the fixed 24-hour wording on the cancel sheet, whole-dollar card prices,
  and the in-person note addressed to a Job Seeker but shown to both roles.
- The issue asks for iOS and Android screenshots; the walkthrough is iOS only.
