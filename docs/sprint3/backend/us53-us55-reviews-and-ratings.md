# US-53, US-54 and US-55 backend: reviews, service ratings and the overall rating

Issues: back-end sub-issues [#212](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/212),
[#215](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/215) and
[#218](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/218), under
[US-53 #52](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/52),
[US-54 #53](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/53) and
[US-55 #54](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/54).

This slice adds reviews from nothing: a `reviews` table, the route a buyer uses to rate a session
they have had, and the two ratings it keeps up to date, one per service (US-54) and one per Career
Professional across all their services (US-55). US-54 and US-55 have no route of their own; they are
the service and Career Professional fields that every review submission recomputes. The table, route
and aggregates were written in commit `8836b72` on 12 October 2026. They reached `dev` on 14 October
2026 in [PR #239](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/239), where
jashan-arora renumbered the migration after the diagnosis one, let a paid-out session still be
reviewed, refused whitespace-only comments, and added the buyer's review to their bookings.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 38 and 39.

## Endpoints and flow

| Endpoint | Code | What it does |
|---|---|---|
| `POST /bookings/{bookingId}/review` | `create_review` in [`app/routers/bookings.py`](../../../backend/app/routers/bookings.py) | US-53: stores one rating and comment, then recomputes both ratings in the same transaction. |
| `GET /services/{serviceId}` | `get_service` in [`app/routers/services.py`](../../../backend/app/routers/services.py) | US-54: the service with `averageRating`, `reviewCount` and its `reviews`, newest first. |
| `GET /services`, `GET /counsellors`, `GET /counsellors/{counsellorId}` | same file | US-55: the Career Professional's `overallRating` and `reviewCount`. |
| `GET /bookings/{bookingId}`, `GET /me/bookings` | `app/routers/bookings.py` | Each booking carries its `review` once written, so the app stops offering a second one. |

The aggregates live in [`app/reviews.py`](../../../backend/app/reviews.py); the table is
`Review` in [`app/models.py`](../../../backend/app/models.py), created by migration `0010_reviews`.

Flow: after a session, the booking moves to `completed` (and later `paid_out`). The buyer opens it,
rates it and writes a comment. The service page and the Career Professional's listings show the new
numbers on their next load.

## Behaviour and states

- **Who can review:** the booking's Job Seeker only. `require_job_seeker` refuses a Career
  Professional or Platform Owner with `403` before the booking is read. Another Job Seeker gets `404`,
  the same as for a booking that does not exist.
- **When:** the booking must be `completed` or `paid_out`. A confirmed session that has not happened,
  or a cancelled one, is `409 INVALID_STATE_TRANSITION`.
- **Once:** one review per booking, enforced by a unique constraint on `booking_id` as well as a check
  that returns `409`.
- **What:** `rating` is an integer 1–5; `comment` is required, at most 4,000 characters, and stored
  trimmed. A whitespace-only comment is refused. Anything invalid is `400` and nothing is stored.
- **The ratings are recomputed, not incremented.** Each submission re-runs `COUNT` and `AVG` over the
  stored reviews and overwrites the cached columns, so the numbers cannot drift from the table.
- **The recorded formula:** a service's rating is the mean of that service's reviews. A Career
  Professional's overall rating is the mean of every review on every one of their services, each review
  counting once, so a service with many reviews weighs more than one with few. With no reviews the
  rating is `null` and the count `0`, never a made-up value.
- **Public:** the service detail and the rating fields need no login. Ratings are returned at every
  profile visibility level.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.createReview(bookingId, draft)` | `POST /bookings/{bookingId}/review` | Body `{rating, comment}`; `201` with the stored review. |
| `api.getService` | `GET /services/{serviceId}` | `averageRating`, `reviewCount`, `reviews`. |
| `api.getBooking`, `api.listMyBookings` | `GET /bookings/{bookingId}`, `GET /me/bookings` | `review` is present once written. |

Each review is returned as `{id, bookingId, serviceId, jobSeekerId, rating, comment, createdAt}`, the
shape the executable contract already published before this was built.

## Acceptance criteria

| Criterion | Backend behaviour | Evidence |
|---|---|---|
| US-53: an eligible buyer submits a rating and comment | Stored against the booking, its order, service and Career Professional | `test_the_buyer_of_a_completed_booking_can_review_it`, `test_a_session_whose_counsellor_has_been_paid_can_still_be_reviewed` |
| US-53: a missing or out-of-range rating is rejected, nothing stored | `400` | `test_an_invalid_rating_or_missing_comment_is_rejected_and_stores_nothing` (5 cases), `test_a_review_is_stored_without_surrounding_space` |
| US-53: an order not completed cannot be reviewed | `409` | `test_a_booking_that_is_not_yet_completed_cannot_be_reviewed`, `test_a_cancelled_booking_cannot_be_reviewed` |
| US-53: a non-buyer is rejected | `403` or `404` | `test_only_the_buyer_may_review_their_own_booking`, `test_a_stranger_job_seeker_gets_the_same_not_found_as_a_nonexistent_booking` |
| US-53 assumption: one review per order | Unique per booking | `test_a_review_cannot_be_submitted_twice_for_the_same_booking`, `test_the_buyers_booking_carries_its_review_once_written` |
| US-54: any user, logged in or not, sees average, count and list | Public detail route | `test_service_detail_is_public_and_reflects_a_stored_review` |
| US-54: a new review updates average, count and list consistently | Recomputed in the same write | `test_service_detail_is_public_and_reflects_a_stored_review`, `test_the_service_average_is_the_mean_of_its_own_reviews_only` |
| US-54: no reviews shows a zero count and no fabricated rating | `null` and `0` | `test_a_service_with_no_reviews_shows_a_clear_zero_state`; but see the seed data under Known gaps |
| US-54: a rejected submission leaves the numbers unchanged | No write | `test_a_rejected_submission_leaves_the_service_aggregate_unchanged` |
| US-55: profile and listing show the same overall rating | Both read `User.overall_rating` | Listing: `test_the_counsellors_overall_rating_spans_every_one_of_their_services`. Profile route: not covered |
| US-55: the overall rating follows the recorded formula across all services | Mean of all the Career Professional's reviews | `test_the_counsellors_overall_rating_spans_every_one_of_their_services` |
| US-55: no reviews shows a no-rating state | `null` and `0` | Not covered at the Career Professional level |

## Tests

- [`tests/test_reviews.py`](../../../backend/tests/test_reviews.py): 19 tests (15 functions; the invalid
  input test runs 5 cases).

Run from `backend/`:

```bash
env -u DATABASE_URL pytest tests/test_reviews.py -q
```

Local run on `dev` at `03978fd`, 16 October 2026, Python 3.12.8, temporary SQLite database: 19 passed.

## Known gaps

- **The seed data shows ratings no review supports.** `app/seed_data.json` gives three Career
  Professionals ratings of 4.7–4.9 from 21–46 reviews, and six services ratings of 4.5–4.9 from 6–28
  reviews, but loads no review rows. Every seeded environment therefore shows a count that does not
  match the review list, which is what US-54 and US-55 forbid. The first real review on a seeded
  service resets its count to 1. The seed values should be `null` and `0`, or real review rows.
- **The two recompute functions do not lock the row they update.** Two reviews landing on one Career
  Professional's services at the same moment can each recompute without seeing the other, and the
  later write wins, undercounting by one. Elsewhere in the codebase a read-then-write like this locks
  the row first with `.with_for_update()` (`reschedule_booking`, `cancel_booking_endpoint`).
- **Each public review includes the reviewer's `jobSeekerId`.** It is an opaque ID, not a name, but it
  lets anyone link one Job Seeker's reviews across services, whatever that Job Seeker's visibility
  setting. US-54 assumes reviewer attribution respects US-27 and US-28. The field comes from the
  contract published in Sprint 1.
- No test reads the overall rating through `GET /counsellors/{counsellorId}`, and no test covers a
  Career Professional with no reviews.
- Reviews cannot be edited or deleted, and Career Professionals cannot reply; no baseline story asks
  for either.
