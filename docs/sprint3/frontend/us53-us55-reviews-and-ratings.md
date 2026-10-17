# US-53, US-54 and US-55 frontend: reviews, service ratings and the overall rating

Issues: front-end sub-issues [#211](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/211),
[#214](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/214) and
[#217](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/217), under
[US-53 #52](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/52),
[US-54 #53](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/53) and
[US-55 #54](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/54).

A Job Seeker can now rate and review a session they have had. The service page lists its reviews
under the average and count, and the Career Professional's overall rating shows on Explore. The
review screen, the "Write a review" action and the Reviews section are new. The rating values on
Explore, service detail and the Career Professional profile already showed in Sprint 2 (US-44, US-46).
It reached `dev` on 7 October 2026 in
[PR #234](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/234) (commit `ce745fe`),
before the back end. The back end ([US-53 to US-55 back end](../backend/us53-us55-reviews-and-ratings.md))
reached `dev` on 14 October in [PR #239](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/239).
The three front-end sub-issues were closed on 7 October.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 02, 04,
05 and 37–39. They were captured on 8 October, before the back end merged, so screen 39 shows a
submission returning *Not Found*.

## Screens and flow

| Route | File | What the user sees |
|---|---|---|
| `/bookings` (Past tab) | [`app/bookings/index.tsx`](../../../frontend/app/bookings/index.tsx) | My sessions. A completed session not yet reviewed has **Write a review**. |
| `/bookings/[bookingId]/review` | [`app/bookings/[bookingId]/review.tsx`](../../../frontend/app/bookings/[bookingId]/review.tsx) | New. "Review your session": five stars and a written review. |
| `/services/[serviceId]` | [`app/services/[serviceId].tsx`](../../../frontend/app/services/[serviceId].tsx) | Service detail: the rating in the header, the Career Professional's overall rating, and a new Reviews section. |
| `/professionals/[counsellorId]` | [`app/professionals/[counsellorId].tsx`](../../../frontend/app/professionals/[counsellorId].tsx) | Career Professional profile: the overall rating tag. |
| `/marketplace` | [`app/marketplace/index.tsx`](../../../frontend/app/marketplace/index.tsx) | Explore cards: the service rating and, new, the Career Professional's overall rating. |

Flow: My sessions, Past, **Write a review**, choose stars, write, **Submit review**. The app then opens
the service's detail page, which reads the service again and so shows the new review.

## Behaviour and states

### Writing a review (US-53)

- **Write a review** shows only to a Job Seeker, only on the Past tab, and only for a booking whose
  status is `completed` or `paid_out` and which has no `review` yet. A booking that is confirmed,
  cancelled or already reviewed has no action.
- The review screen reads the booking with `GET /bookings/{bookingId}` and shows a spinner first.
  - Signed out: sent to log in. A Career Professional or Platform Owner: sent to their own home.
  - A booking that cannot be read (including another Job Seeker's): the back end's message, or "That
    booking is not available."
  - Not completed: "This session is not ready to review" with "Reviews become available after the
    session is completed." and **Back to My sessions**.
  - Already reviewed: "Review already submitted" with "Each completed booking can be reviewed once."
- An eligible booking shows "Completed session", the service title the order was bought under, and
  "How was your session with <Career Professional>?".
- **Star rating:** five buttons in a radio group, named "1 star" to "5 stars". The chosen star and those
  below it fill.
- **Your review:** multi-line, placeholder "What was useful about the session?", at most 2,000
  characters.
- **Submit review**, checked before sending:
  - no star: "Choose a star rating from 1 to 5."
  - an empty or blank review: "Write a short review before submitting."
- The comment is sent trimmed. The button is busy while the request is out. On success the toast
  "Review submitted" shows and the service detail replaces the review screen. A back-end refusal (for
  example "This booking has already been reviewed.") shows above the button, and what was typed stays.

### Service feedback (US-54)

- **Header tag:** "★ <average> · <count> reviews", or "New on Yoir" when the average is `null`.
- **Reviews section:** "Reviews" with "<average> · <count>" or "No reviews yet". Each review shows a
  name, "<rating>/5", the comment as returned, and the date in `en-AU` form ("21 Aug 2026"). With no
  reviews: "No written reviews yet."
- The detail is read each time the page is opened. A failed read shows the reason and **Try again**.
- Nobody needs to be logged in.

### Overall rating (US-55)

The Career Professional's `overallRating` and `reviewCount` come with every service and profile. One
decimal place everywhere:

| Where | With a rating | With none |
|---|---|---|
| Explore card | "Career Professional · ★ 4.8 (21)" | "Career Professional · New" |
| Service detail, Career Professional card | "4.8 · 21 reviews" | "No reviews yet" |
| Career Professional profile | Tag "★ 4.8 · 21 reviews" | No tag |
| Best matches after the diagnosis | "★ 4.8 (21)" | Nothing shown |

A profile that comes back without `overallRating` is read as `null`, so no screen shows "0.0" or
invents a value. A restricted profile shows "This profile is restricted" and no rating (US-28).

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listMyBookings` | `GET /me/bookings` | Each booking carries `review` once written, which hides Write a review. |
| `api.getBooking` | `GET /bookings/{bookingId}` | The review screen's eligibility check. |
| `api.createReview(bookingId, draft)` | `POST /bookings/{bookingId}/review` | Body `{rating, comment}`; `201`. |
| `api.getService` | `GET /services/{serviceId}` | `averageRating`, `reviewCount`, `reviews`, and the Career Professional's `overallRating`. |
| `api.listServices` | `GET /services` | Explore cards. |
| `api.getCounsellorProfile` | `GET /counsellors/{counsellorId}` | Profile rating. |

The request matches the back end: the same path, and a body of `rating` and `comment` only, which is
all `SubmitReviewRequest` accepts. The app does not use the review it gets back. Read from the code and
the contract; the walkthrough has not been captured again since the back end merged.

Each review the back end returns is `{id, bookingId, serviceId, jobSeekerId, rating, comment,
createdAt}`. The app's `Review` type expects `authorName` instead of `jobSeekerId` (see Known gaps).

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| US-53: the buyer of a completed order opens it and gets a 1–5 star selector and a comment field | Write a review on the Past tab opens the review screen | `privacy-reviews.test.tsx` "offers the review action only from a completed, unreviewed session"; walkthrough 37–38 |
| US-53: shown as submitted only after the back end stores it | Toast and navigation wait for `createReview` | `privacy-reviews.test.tsx` "submits a 1–5 star rating and written comment, then returns to the service" (body asserted, trimmed); back end `test_the_buyer_of_a_completed_booking_can_review_it` |
| US-53: a missing or out-of-range rating is rejected and shown; nothing stored | The app stops it first; a back-end `400` would show its message | Back end `test_an_invalid_rating_or_missing_comment_is_rejected_and_stores_nothing`. App message: not unit tested |
| US-53: an order not completed has no review action; a direct submission is rejected | No button; the screen says it is not ready; back end `409` | Back end `test_a_booking_that_is_not_yet_completed_cannot_be_reviewed`, `test_a_cancelled_booking_cannot_be_reviewed`. The not-ready screen: not unit tested |
| US-53: a non-buyer is refused | Other roles redirected; another Job Seeker cannot read the booking; back end `403` or `404` | Back end `test_only_the_buyer_may_review_their_own_booking` |
| US-54: anyone sees the average, count and list as returned | Header tag and Reviews section, no login | `service-detail.test.tsx` "[US-54] shows backend-provided review rows and aggregate feedback"; walkthrough 04 |
| US-54: a new review shows on the next load, consistent | Submitting opens the detail, which reads it again | Back end `test_service_detail_is_public_and_reflects_a_stored_review`. Screen: checked by reading the code |
| US-54: no reviews gives a clear zero state and no invented rating | "New on Yoir", "No reviews yet", "No written reviews yet." | `service-detail.test.tsx` "[QA-115] unrated pending counsellors do not acquire invented ratings or verification" |
| US-54: a rejected submission leaves the numbers unchanged | Nothing changes until the back end stores a review | Back end `test_a_rejected_submission_leaves_the_service_aggregate_unchanged` |
| US-54: each entry shows the stars and comment as returned | "<rating>/5" and the comment unchanged | `service-detail.test.tsx` "[US-54] …" |
| US-55: profile and listing show the same overall rating | Both print the back end's `overallRating` to one decimal | Walkthrough 02 and 05. Not unit tested on the profile or Explore card |
| US-55: the rating follows the recorded formula after a new review | The app does not compute it | Back end `test_the_counsellors_overall_rating_spans_every_one_of_their_services` |
| US-55: no reviews shows a no-rating state, not zero | "New" or "No reviews yet"; `null` kept as `null` | `service-detail.test.tsx` "[QA-115] …"; `client.test.ts` "Career Professionals are listed and read publicly, without authentication" (a missing `overallRating` becomes `null`) |
| US-55: every screen matches the API on iOS and Android | | Not recorded |

## Tests

- [`__tests__/screens/privacy-reviews.test.tsx`](../../../frontend/__tests__/screens/privacy-reviews.test.tsx),
  "completed-booking reviews — US-53": 2 tests.
- [`__tests__/screens/service-detail.test.tsx`](../../../frontend/__tests__/screens/service-detail.test.tsx):
  "[US-54] shows backend-provided review rows and aggregate feedback" and "[QA-115] unrated pending
  counsellors do not acquire invented ratings or verification".
- [`__tests__/api/client.test.ts`](../../../frontend/__tests__/api/client.test.ts): "Career
  Professionals are listed and read publicly, without authentication".
- No test covers the not-ready or already-reviewed states, the client-side messages, the profile tag or
  the Explore card's overall rating.

Run from `frontend/`:

```bash
npx jest __tests__/screens/privacy-reviews.test.tsx __tests__/screens/service-detail.test.tsx \
  __tests__/api/client.test.ts
```

Local run on `dev` at `0df4068`, 17 October 2026, Node 22.14.0: 3 suites, 27 passed (the files also
cover US-27, US-28, the rest of service detail and the rest of the public client).

## Known gaps

- **Reviewer name:** the back end returns `jobSeekerId` and no name, but the app reads `authorName`, so
  every review shows as "Yoir member". The two front-end tests mock an `authorName` the back end never
  sends. Reviews stay anonymous in practice; if a name is wanted, the back end needs to send one that
  respects the reviewer's visibility (US-27).
- **Seed data:** seeded services and Career Professionals carry ratings and counts with no review rows,
  so a seeded service shows, for example, "4.8 · 28" over "No written reviews yet." (back-end gap).
- **Not captured since the back end merged:** walkthrough 39 still shows *Not Found*.
- **Review entry** is on the My sessions card only, not on the booking detail screen.
- **Comment limit:** the app stops at 2,000 characters; the back end allows 4,000.
- A restricted Career Professional's profile hides the rating that Explore still shows.
- No device run on iOS or Android compares the API's rating with each screen (US-55).
