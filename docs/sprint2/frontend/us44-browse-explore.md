# US-44 frontend: browse Explore without an account

Issue: [#107](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/107),
under [US-44 #41](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/41).

This slice gives any visitor, signed in or not, the Explore screen: a list of the
active services the backend returns, with loading, empty and error states. Tapping a
listing opens the service detail, documented in [US-46](us46-service-evaluation.md).
The search box, filter panel and sort order on the same screen belong to
[US-45](us45-search-filter-sort.md). The sub-issue title also names a Career
Professional listing; Explore has no such listing on `dev` (see Known gaps).

## Screens and flow

Explore is the route `/marketplace`, implemented in
[marketplace/index.tsx](../../../frontend/app/marketplace/index.tsx). No session is
required to reach it. Entry points:

- The entry screen's "Just looking? Browse as a guest" link
  ([app/index.tsx](../../../frontend/app/index.tsx)) and the Job Seeker welcome
  screen's "Continue as a guest" button both `router.replace('/marketplace')`.
- The Explore tab in the Job Seeker bottom navigation
  ([JobSeekerNav.tsx](../../../frontend/src/components/JobSeekerNav.tsx)). The bar
  also shows Home and Bookings; Bookings sends a guest to login. The bar is hidden
  for `counsellor` and `platform_owner` sessions.
- "View all Career Professionals" on the Job Seeker home and "View Career
  Professionals" after the Yoir Diagnosis. Both are documented in
  [US-09–13](us09-us13-yoir-diagnosis.md).
- "Back to Explore" on the booking confirmation ([US-68](us68-booking-confirmation.md)).

The screen shows the top bar, the eyebrow "Explore" and a greeting: "Find the Career
Professional for your next step" for a guest, or "Find your next step, {first name}"
when signed in. For a signed-in person whose email is not confirmed,
`VerifyEmailBanner` shows "Confirm your email to book a session" with a Resend
action. Browsing is not blocked.

Each listing is a card showing:

- The Career Professional's display name and initials avatar.
- "Verified" (with a shield icon) or "Verification pending", from `counsellor.verificationStatus`.
- The price from `priceMinor`, formatted by `money()` in [format.ts](../../../frontend/src/format.ts).
- The title, and the description clamped to two lines.
- One tag per modality ("Online", "In person"), plus a "{city or region}, {state}" tag when the service has a `location`.
- The average rating to one decimal place, or "New" when the backend returns `null`, with the review count in brackets.

The card's accessibility label is `"{title} by {display name}, {price}"`. Tapping it
pushes `/services/[serviceId]` with the service id.

## Behaviour and states

- **Loading.** The screen calls `api.listServices()` on mount. While that request is
  in flight, and for at least 900 ms (`SKELETON_MS`), the result row reads "Loading
  services" and three shimmer placeholders replace the list. No listing data is shown
  until the response arrives.
- **Success.** The result row reads "{shown} of {total} services" beside the current
  sort label. The default order is "Recommended", a client-side ranking described in
  [US-45](us45-search-filter-sort.md). No listing data is hard-coded; every card
  field comes from the `Service` response.
- **Empty.** With no services to show, the list area shows "No services match your
  search." and "Try a different keyword, or widen the filters you have applied.",
  with a "Clear filters" button. An empty catalogue uses the same copy, with the
  count "0 of 0 services".
- **Error.** A failed request shows `userFacingError(error)` in an `ErrorBanner`
  (`accessibilityRole="alert"`), with a "Try again" button. That is the backend
  `message`, or "We could not reach Yoir. Check your connection and try again." for
  a network `TypeError`. No cards are rendered while the error is shown. "Try again"
  clears the error, shows the skeleton again and repeats the request.
- **Roles.** The screen has no role guard; any session or none can browse.

Tests find elements by these labels: "Search services or Career Professionals",
"Try again", "Clear filters", and the card label pattern above.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listServices()` | `GET /services` | Public; no `Authorization` header. Explore sends no query parameters. The backend returns only active, bookable services. |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| With no session, Explore shows the backend's service listings without prompting for login | Met. Guest entry points route to `/marketplace`, which loads `GET /services` without a token. | `marketplace.test.tsx` "[QA-109] guests see loading then public services without authentication"; `navigation.test.tsx` "[QA-109] guests can browse without creating a session"; `welcome.test.tsx` "[QA-87/91] job seekers can choose registration, login or anonymous browsing"; `web.spec.ts` "US44/45/46 public Web catalogue, search, detail and back"; QA #109 records guest catalogue and detail observed on iOS and Android. |
| Switching to a Career Professional listing shows backend entries limited by visibility settings | Not met. Explore has no Career Professional listing. `api.listCounsellors()` exists but is used only by the Yoir Diagnosis best matches. | Planned probe `counsellor-discovery.test.tsx` "[QA-109][US44-AC2] public marketplace offers a separate counsellor-list entry" fails (run 18 Sept 2026 at `64cb324`). QA #109: "Counsellor directory is absent." |
| Every field on a service entry is a backend service field; no placeholder data | Mostly met. All card values come from the `Service` response. Prices lose their cents: 7050 minor units display as "$71". The card also shows rating and verification, which the parent story leaves to US-55 and US-32. | `marketplace.test.tsx` (card labels built from fixture data); defect `format-planner-acceptance.test.ts` "F01 / QA #115 #124: displayed AUD prices preserve the charged cents" fails; `integrity.spec.ts` "DEF-MONEY-CENTS: … @defect". |
| A service removed under US-36 is absent from the listing | Backend. The screen renders exactly the list the backend returns. | No frontend test. The backend filters on `Service.active`. |
| Loading state with no listing data until the backend responds | Met. | `marketplace.test.tsx` "[QA-109] guests see loading then public services without authentication" |
| On failure, a backend-error message and no stale or empty list presented as current | Met for structured and network errors. A null error body and a malformed 200 body are not rejected as structured failures (F06, F07). | `marketplace.test.tsx` "[QA-109] a failed catalogue request shows a retry that restores the list"; `web.spec.ts` "US44 Web network failure exposes retry and recovers @injected-network"; defects `client-acceptance.test.ts` F06 and F07 fail. |

## Tests

- [marketplace.test.tsx](../../../frontend/__tests__/screens/marketplace.test.tsx): the three
  "[QA-109]" cases for loading, error with retry, and the empty catalogue.
- [navigation.test.tsx](../../../frontend/__tests__/screens/navigation.test.tsx) and
  [welcome.test.tsx](../../../frontend/__tests__/screens/welcome.test.tsx): the guest entry points.
- [client.test.ts](../../../frontend/__tests__/api/client.test.ts): "listServices trims and
  URL-encodes a query without adding authentication".
- Defect assertions (expected to fail until fixed):
  [client-acceptance.test.ts](../../../frontend/__tests__/defects/client-acceptance.test.ts) and
  [format-planner-acceptance.test.ts](../../../frontend/__tests__/defects/format-planner-acceptance.test.ts).
- Playwright: [web.spec.ts](../../../frontend/e2e/web.spec.ts) (the two US44 cases above).
  Native, authored only: [guest-booking.yaml](../../../frontend/e2e/native/guest-booking.yaml).

From `frontend/`:

```bash
npm test -- __tests__/screens/marketplace.test.tsx __tests__/screens/navigation.test.tsx __tests__/screens/welcome.test.tsx
npm run test:defects -- __tests__/defects/client-acceptance.test.ts
npm run test:planned -- __tests__/planned/counsellor-discovery.test.tsx
```

Build the web export and run Playwright as described in the [e2e README](../../../frontend/e2e/README.md).

## Known gaps

- There is no Career Professional listing on Explore (AC2). People can be reached
  only through a service's "View full profile" link ([US-46](us46-service-evaluation.md))
  or the Diagnosis best matches.
- Prices are rounded to whole dollars (`money()` uses `maximumFractionDigits: 0`).
  This is the open DEF-MONEY-CENTS / F01 defect, which also affects the detail,
  checkout and confirmation screens.
- The API client does not validate response shapes. A null error body or a malformed
  success body is not reported as a structured failure (F06 and F07 in
  [defects.md](../qa/defects.md), still failing at the
  [18 September review](../qa/dev-sync-review-20260918.md)).
- The empty-catalogue state reuses the "No services match your search." copy even
  when no search or filter is applied.
- Native observations in the [QA matrix](../qa/qa-matrix.md) predate the Explore
  renaming and branding changes on `dev`. Native case N09 (network recovery) has not
  been run.
