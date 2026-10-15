# US-40 frontend: select only an open booking slot

Issue: [#116](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/116),
under [US-40 #35](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/35).

This slice is the first booking step, "Choose a time". A signed-in Job Seeker sees
the start times the backend says the service can be booked at. The times are grouped
by day and shown in the device timezone. The Job Seeker picks one (and a delivery
mode when the service offers both) before continuing. Continuing reserves the slot
by creating an order; that behaviour and its conflict handling are in
[US-41](us41-double-booking.md). The entry point is the Book action in
[US-46](us46-service-evaluation.md). Checkout is in [US-47](us47-test-purchase.md).

## Screens and flow

The route is `/services/[serviceId]/timeslots`,
[timeslots.tsx](../../../frontend/app/services/%5BserviceId%5D/timeslots.tsx), using
the shared booking chrome in [booking.tsx](../../../frontend/src/components/booking.tsx).
It is reached from "Book this service", or straight after login when the login
screen was opened with a `serviceId`.

The screen shows:

- A `BackBar` titled "Choose a time". Back (label "Go back") returns to the service
  detail.
- The `BookingSteps` progress bar, labelled "Step 1 of 3: Time".
- The heading "When suits you?" and "Select one available session for {title}."
- When the service offers more than one modality, "How would you like this session
  delivered?" with one radio chip per modality ("Online", "In person"). While "In
  person" is selected, "Meeting area: {city or region}, {state}" is shown.
- One group per local day, headed by a short date (for example "Tue, 1 Sept").
  Each start time in the group is a radio row showing the time range and the
  duration. Its accessibility label is `"{day}, {start} – {end}, {n} min"`.
- The note "Times are shown in your device timezone ({IANA zone})."
- A footer that shows the chosen day, time and price once a slot is selected, and a
  "Continue to payment" button.

## Behaviour and states

- **Auth guard.** Without a session, the screen immediately
  `router.replace`s to `/auth/login` with `serviceId`. It makes no slot request
  first. There is no client-side role check. A signed-in `counsellor` who opens the
  route directly sees the slots, but the backend rejects the order (see US-41).
- **Loading.** `load()` fetches the service, then
  `listServiceSlots(serviceId, modality)`. The modality sent is the current choice,
  or `service.modalities[0]` on first load. The slot list is the backend's
  `BookableStart[]`, sorted by `startsAt` and grouped by `toDateString()`. The
  client does no status filtering. The backend derives these starts from the Career
  Professional's availability windows, the service duration and the time already
  taken, so reserved or unavailable times are never sent and never rendered. A
  spinner shows until the first answer arrives, so loading never reads as "nothing
  open".
- **No open times (AC4).** A successful empty answer shows "No open times right
  now" with the Career Professional's name and, for a service offered both ways,
  which delivery method is empty. If the other method has times, "Show in-person
  times" (or online) switches to it. "See other Career Professionals" opens
  Explore. A failed read shows the error with "Try again" instead, never the
  empty state.
- **Delivery choice.** It is preselected to the first modality the service lists.
  Tapping another chip changes `modality` and clears the shown slots until that
  mode's arrive, so one mode's times are never booked as the other's. A selection
  that is not in the new list leaves "Continue to payment" disabled.
- **Selection.** Tapping a row selects it (`accessibilityState.checked`). "Continue
  to payment" is disabled until a slot is chosen.
- **Continue.** This calls `api.createOrder` ([US-41](us41-double-booking.md)). On
  success it pushes `/bookings/checkout` with `orderId`, `serviceId`, `modality`,
  `amountMinor` (from the order), `startsAt`, `endsAt` and `holdExpiresAt`. Nothing
  on this screen describes a booking as created. Checkout says "Your slot is
  reserved while the timer runs."
- **Errors.** A load failure shows `userFacingError` in an `ErrorBanner`, for
  example "We could not reach Yoir. Check your connection and try again."
  "Continue to payment" stays disabled.
- **Empty.** When the backend returns no starts, the screen shows no rows, no
  message and a disabled "Continue to payment". This is open defect F09 (see Known gaps).
- There is no loading indicator. Until the first response arrives, the screen shows
  only the heading and the timezone note.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.getService(serviceId)` | `GET /services/{serviceId}` | Public. Supplies the title, modalities, meeting area and price. |
| `api.listServiceSlots(serviceId, modality)` | `GET /services/{serviceId}/slots?modality=…` | Public. Returns `{ startsAt, endsAt }[]`, derived on each request. |
| `api.createOrder(...)` | `POST /orders` | Called on Continue. See [US-41](us41-double-booking.md). |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| Only slots the backend reports as open are selectable | Met. Only the backend's bookable starts are rendered, and each is a selectable radio. | `timeslots.test.tsx` "[QA-118] server-derived starts are selectable and payment requires a selection"; `web.spec.ts` "US40/41/47/68 real browser booking to stub receipt (not provider acceptance)"; QA #118 records "One future online slot selected" on iOS and Android. |
| Continuing carries the service, modality, slot and pre-session brief forward, with no booking shown as created | Partly met. The service, modality and slot (with order data) are passed to checkout. No pre-session brief is captured anywhere in the app. | `timeslots.test.tsx` "[QA-118/121] selection reserves through the real client with identity and passes server order data" |
| With both modalities, the Job Seeker must choose online or in person before continuing | Partly met. The choice is offered, but it is preselected to the first modality, so the Job Seeker can continue without making an explicit choice. | Planned `public-search-and-selection.test.tsx` "[QA-118][US40-AC3] both-modality booking requires an explicit delivery choice before continuing" fails (18 Sept 2026, `64cb324`). |
| With no open slots, a no-open-slots state is shown and nothing is selectable | Met (13 Oct 2026). "No open times right now" is shown, nothing is selectable, and the buyer is pointed to the other delivery method or to Explore. A failed read is an error with a retry, not an empty state. | `timeslots.test.tsx` "[QA-118][US40-AC4] an empty answer says nothing is open and points to other Career Professionals" and the three "[US40-AC4]" cases; defect `public-issue-acceptance.test.tsx` "[QA-118][US40-AC4] no open slots has an explicit empty state, not an unexplained blank picker" now passes. `web.spec.ts` "[QA-118][US40-AC4] real empty availability has an explanatory state @defect" not re-run. |
| An unauthenticated user is sent to login | Met. After login, a Job Seeker returns to this screen. | `timeslots.test.tsx` "[QA-118] a guest deep link returns to login before reading slots"; `login.test.tsx` "[QA-100] a pending booking returns %s to the appropriate route" |

The parent story's scope also asks for slot times with timezone information. The
picker and checkout now name the device timezone. The "known gap" recorded on
#116 (no timezone label) no longer applies on `dev`.

## Tests

- [timeslots.test.tsx](../../../frontend/__tests__/screens/timeslots.test.tsx): thirteen cases.
  The "[QA-118]" cases cover the guard, selection and connection failure; the
  "[US40-AC4]" cases cover the empty state, the other-delivery-method switch,
  loading and retry.
- [client.test.ts](../../../frontend/__tests__/api/client.test.ts): "listServiceSlots
  URL-encodes the service identifier".
- Defect: [public-issue-acceptance.test.tsx](../../../frontend/__tests__/defects/public-issue-acceptance.test.tsx).
- Archived probe: [public-search-and-selection.test.tsx](../../../frontend/__tests__/planned/public-search-and-selection.test.tsx).
- Playwright: [web.spec.ts](../../../frontend/e2e/web.spec.ts) (booking journey and the
  empty-availability `@defect` case). Native, authored only:
  [guest-booking.yaml](../../../frontend/e2e/native/guest-booking.yaml).

From `frontend/`:

```bash
npm test -- __tests__/screens/timeslots.test.tsx
npm run test:defects -- __tests__/defects/public-issue-acceptance.test.tsx
```

## Known gaps

- No pre-session brief step (AC2), and no enforced explicit modality choice (AC3).
- Apart from "Try again", a slot-load error stays on screen after a later
  successful reload (for example after switching delivery method), because
  `slotsError` is otherwise cleared only when Continue is pressed.
- On first open, the slot list is requested twice. The first load sets `modality`,
  which re-creates `load` and triggers the effect again. The conflict test depends
  on this: it expects three slot requests.
- Native case N05 (in-person, empty-slot and conflict edge paths) has not been run.
