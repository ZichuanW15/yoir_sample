# US-46 frontend: evaluate a service before purchase

Issue: [#113](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/113),
under [US-46 #43](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/43).

This slice has two public screens. The service detail screen shows what the service
is, who delivers it, how it is delivered, and a "Book this service" action. The
Career Professional profile screen, reached from "View full profile", shows
qualifications, skills and expertise, languages, background, experience, a LinkedIn
link and the person's other services. Booking starts with slot selection
([US-40](us40-slot-selection.md)). Explore and its search belong to
[US-44](us44-browse-explore.md) and [US-45](us45-search-filter-sort.md).

## Screens and flow

**Service detail**, `/services/[serviceId]`,
[services/[serviceId].tsx](../../../frontend/app/services/%5BserviceId%5D.tsx). It is
reached by tapping an Explore card or a service card on a profile page. The top bar
reads "Service details", and its Back control (label "Back") returns to the previous
screen, or to `/marketplace` when there is no history (`goBack`). The body shows:

- A hero with the eyebrow "Career service", the title, the price with "per session",
  and tags: one per modality, and either "★ {rating} · {n} reviews" or "New on Yoir".
- "About this service", followed by the description.
- A Career Professional card:
  - Initials avatar and display name.
  - A "Verified Career Professional" or "Verification pending" pill.
  - The introduction, when present.
  - The person's overall rating as "{rating} · {n} reviews", or "No reviews yet".
  - A "View full profile" link (label "View {name}'s full profile") to `/professionals/[counsellorId]`.
- "How it is delivered":
  - For an online service: "Online. Joining details are shared with your confirmation."
  - For an in-person service: "In person."
  - For a service offering both: the two labels joined with " or ", in the order
    the backend lists them, followed by the joining-details sentence.
  - An "In-person area" row with "{city or region}, {state}" when the service has a `location`.
- "Booking this service": three numbered steps (choose a time, pay through Yoir,
  get a confirmation).
- A fixed "Book this service" button.

**Career Professional profile**, `/professionals/[counsellorId]`,
[professionals/[counsellorId].tsx](../../../frontend/app/professionals/%5BcounsellorId%5D.tsx).
It is also opened from the Yoir Diagnosis best matches
([US-09–13](us09-us13-yoir-diagnosis.md)). Editing these fields is covered in
[US-30](us30-professional-profile.md). The title bar reads "Career Professional",
and Back (label "Go back") falls back to `/marketplace`. The screen shows:

- The photo or initials, the name, and a "Verified Career Professional" or
  "Verification pending" tag. A rating tag appears only when the person is rated.
- "{city or region}, {state} · {Online|In person} sessions", from `baseLocation` and `defaultModality`.
- The introduction, and a "View LinkedIn profile" button that opens `linkedinUrl`.
- Sections for Qualifications, Skills and expertise, Languages, Background and
  Experience. Each section is shown only when it has content.
- A "Services" list. Each card shows the title, "{duration} min · {modalities}" and
  the price, and opens that service's detail screen. With no services, the list
  reads "No services are listed right now."

## Behaviour and states

- **Detail loading.** A centred spinner is shown until `api.getService` settles.
- **Detail error or removed service.** An `ErrorBanner` shows the backend message
  (for example "Service not found.", returned for inactive services). If there is
  no message, it shows "That service is no longer available." A "Try again" button
  repeats the request. No Book button is rendered.
- **Book action** (`bookService`):
  - No session: push `/auth/login` with `serviceId`. The login screen then reads
    "Log in to choose a time and complete your booking." After login, a `job_seeker`
    is sent to the slot picker and any other role back to this service detail
    ([login.tsx](../../../frontend/app/auth/login.tsx)).
  - Signed in with a role other than `job_seeker`: an inline `ErrorBanner` reads
    "Only Job Seekers can book a service." The app does not navigate.
  - Signed-in Job Seeker: push `/services/[serviceId]/timeslots` with `serviceId`.
  - No order or booking is created at this step.
- **Profile loading.** A spinner is shown until both the profile and the service
  list have loaded.
- **Profile error.** If either request fails, an `ErrorBanner` and a "Try again"
  button are shown, and no partial profile is rendered.
- Neither screen has a restricted-profile state. They show whatever fields
  `GET /counsellors/{id}` and `GET /services/{id}` return.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getService(id)` | `GET /services/{serviceId}` | Public; no token. The identifier is URL-encoded. |
| `api.getCounsellorProfile(id)` | `GET /counsellors/{counsellorId}` | Public. Returns 404 "Career Professional not found." when the id is not a `counsellor` account. |
| `api.listServices()` | `GET /services` | Used by the profile page, then filtered on the client to `service.counsellor.id === counsellorId`. |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| Tapping a listing opens a detail showing title, description, category, price, duration, modality and (in person) the meeting area | Partly met. The title, description, price, modality and meeting area are shown. There is no category, because the `Service` type has no such field. `durationMinutes` is not shown on the detail screen, only on the profile's service cards and slot rows. Prices lose their cents. | `service-detail.test.tsx` "[QA-115] loads the selected public service, counsellor and delivery information"; `web.spec.ts` "US44/45/46 public Web catalogue, search, detail and back"; defect F01 "displayed AUD prices preserve the charged cents" fails. |
| The detail shows the permitted Career Professional fields (or a restricted state) and a tap-through to a separate Career Professional detail screen | Met for the tap-through: "View full profile" opens the separate profile screen. There is no restricted state. | Planned probe `counsellor-discovery.test.tsx` "[QA-115][US46-AC2] service detail exposes an actionable counsellor-detail entry" **passes** (run 18 Sept 2026 at `64cb324`). The profile screen has no screen-level test. The [QA matrix](../qa/qa-matrix.md) (16 Sept) still lists this destination as absent. |
| The average rating, review count and review list, or an explicit no-reviews state | Partly met. The rating and count are shown, with "New on Yoir" or "No reviews yet" when unrated. There is no review list. | `service-detail.test.tsx` "[QA-115] unrated pending counsellors do not acquire invented ratings or verification" |
| With no session, Book navigates to login and creates nothing | Met. | `service-detail.test.tsx` "[QA-100/115] guest booking continues through login with the service ID"; `login.test.tsx` "[QA-100] a pending booking returns %s to the appropriate route"; QA #115 native observation "Online detail/login continuation" on iOS and Android. |
| A signed-in Job Seeker's Book enters the booking flow carrying the service | Met. | `service-detail.test.tsx` "[QA-118] a signed-in job seeker continues to available times" |
| A removed service or failed load shows not-available or an error, with no Book action | Met. | `service-detail.test.tsx` "[QA-115] not-found errors offer a retry and never expose a booking button" |

The parent story leaves open what Book does for a Career Professional or Platform
Owner. The app shows "Only Job Seekers can book a service."
(`service-detail.test.tsx` "[QA-100] counsellors cannot continue into the buyer
booking flow").

## Tests

- [service-detail.test.tsx](../../../frontend/__tests__/screens/service-detail.test.tsx): six cases, listed above.
- [login.test.tsx](../../../frontend/__tests__/screens/login.test.tsx): return to the booking after login.
- [client.test.ts](../../../frontend/__tests__/api/client.test.ts): "getService URL-encodes the
  service identifier" and "Career Professionals are listed and read publicly, without authentication".
- Archived probe: [counsellor-discovery.test.tsx](../../../frontend/__tests__/planned/counsellor-discovery.test.tsx).
- Defect: [format-planner-acceptance.test.ts](../../../frontend/__tests__/defects/format-planner-acceptance.test.ts) F01.
- Playwright: [web.spec.ts](../../../frontend/e2e/web.spec.ts) "US44/45/46 …";
  [integrity.spec.ts](../../../frontend/e2e/integrity.spec.ts) "DEF-MONEY-CENTS … @defect".

From `frontend/`:

```bash
npm test -- __tests__/screens/service-detail.test.tsx __tests__/screens/login.test.tsx
npm run test:planned -- __tests__/planned/counsellor-discovery.test.tsx
```

## Known gaps

- The detail screen shows neither category nor duration. There is no review list.
- The profile screen has no screen-level test and no native observation. It was
  added on `dev` after the 18 September QA validation (`776899c`).
- The profile page loads the whole public catalogue to find one person's services.
  If that list fails, the entire profile shows an error.
- Neither screen represents US-28 visibility restrictions. Any restriction has to be
  applied in the backend response; this was not verified here.
- Prices are rounded to whole dollars (open defect F01 / DEF-MONEY-CENTS).
- Native case N05 (in-person detail and slot edge paths) has not been run.
