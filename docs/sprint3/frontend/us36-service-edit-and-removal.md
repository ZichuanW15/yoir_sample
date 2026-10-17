# US-36 frontend: editing and deleting a published service

Issues: front-end sub-issue [#199](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/199),
under [US-36 #31](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/31).

A Career Professional can change a service they have published, or delete it, from My services. The
screens were built in Sprint 2 and reached `dev` on 14 September 2026 in
[PR #154](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/154) (commit `5ba3309`).
The shared form is documented in [US-34 (Sprint 2)](../../sprint2/frontend/us34-create-a-service.md) and
[US-35 (Sprint 2)](../../sprint2/frontend/us35-describe-and-price-a-service.md). Sprint 3 made no
front-end change for this story. This document checks the current screens against US-36's acceptance
criteria, including the order title the back end now freezes at purchase
([US-36 back end](../backend/us36-service-edit-and-removal.md)). Sub-issue #199 was closed on
7 October 2026.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 46, 52 and
53.

## Screens and flow

| Route | File | What the Career Professional sees |
|---|---|---|
| `/counsellor` | [`app/counsellor/index.tsx`](../../../frontend/app/counsellor/index.tsx) | Workspace. My services lists each published service with Edit and Delete. |
| `/counsellor/services/[serviceId]/edit` | [`app/counsellor/services/[serviceId]/edit.tsx`](../../../frontend/app/counsellor/services/[serviceId]/edit.tsx) | The service form, filled in, with Save changes and Delete this service. |

The form is [`src/counsellor/ServiceForm.tsx`](../../../frontend/src/counsellor/ServiceForm.tsx), the
same one used to publish. Both routes redirect anyone who is not a Career Professional to `/`.

## Behaviour and states

### My services

- Only active services are listed. `GET /me/services` also returns withdrawn ones, and the workspace
  filters them out, so a deleted service does not come back on the next read.
- The heading reads "<n> published", or "No services yet" with a "Publish your first service" card.
- Each card shows the title, price, the first two lines of the description, delivery and area tags,
  "Next open <day> · <time>" or "No open times", then **Edit** and **Delete** (named
  "Edit <title>" and "Delete <title>" for screen readers).
- The workspace reads again every time it comes into focus, so a saved edit shows on return.

### Edit

- Opening the route shows a spinner while the Career Professional's own services are read, then the
  form, pre-filled. There is no single-service owner route, so the edit screen finds the id in
  `GET /me/services`.
- A service that is not in that list, including someone else's, shows "This service is no longer
  available." and "Back to workspace". A failed read shows the reason in the same place.
- The form reads "Edit service" and "Update your listing". Fields and validation messages are the
  same as for publishing (see US-35).
- **Save changes** sends the whole form, not only the fields that changed. Unticking In person sends
  `location: null`, so the old area is cleared.
- The workspace and the toast "Service updated" appear only after the back end returns the stored
  service.
- A rejected save shows the back end's message above the form. The typed values stay, and Save
  changes can be pressed again.

### Delete

- From a card or from the edit screen, a dialog asks "Delete this service?" with "It will no longer
  appear in Explore or in your own list. Bookings already made against it are not affected." and a
  destructive **Delete**. Cancel sends nothing.
- From a card: after the back end confirms, the workspace reads the list again and the card is gone.
  A failure shows the reason in the workspace error banner and the card stays.
- From the edit screen: the row reads "Deleting…" and Save changes is disabled while the request is
  out. On success the app returns to the workspace with the toast "Service deleted". On failure the
  reason shows above the form and the service stays editable.

### What existing bookings show

The back end freezes the service title on each order at purchase, with the price and fee split. The
app does not hold a title of its own for a booking. It shows what the back end returns:

| Screen | Field shown | Source |
|---|---|---|
| My sessions, booking detail, reschedule, review | `booking.serviceTitle` | `GET /me/bookings`, `GET /bookings/{bookingId}` |
| Receipt | `receipt.description` | `GET /bookings/{bookingId}/receipt` |
| Platform Owner Payments, order detail, Bookings | `serviceTitle` | `GET /admin/payments`, `GET /admin/bookings` |

So a rename or a price change after purchase does not alter any of these. The one exception is the
booking confirmation screen, which reads the live service (see Known gaps).

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listOwnServices` | `GET /me/services` | Workspace list, and the edit screen's pre-fill. |
| `api.updateService(serviceId, draft)` | `PATCH /me/services/{serviceId}` | The whole form (`ServiceUpdate` is the same type as `ServiceDraft`). Id URL-encoded. |
| `api.deleteService(serviceId)` | `DELETE /me/services/{serviceId}` | Soft delete; `204`. Id URL-encoded. |

The back end checks ownership. A request for another Career Professional's service returns `404`, so
the app never learns whether that id exists.

## Acceptance criteria

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| An edit shows the updated values only after the back end confirms it | Toast and return to the workspace wait for `updateService`; the workspace then reads the list again | `ServiceForm.test.tsx` "switching an in-person edit to online clears its meeting area in the submitted update"; `counsellor-edit-service.test.tsx` "does not show editable values until loading finishes, then pre-fills the matching owned service"; walkthrough 52 |
| A confirmed removal takes the service off My services, and the back end no longer returns it as active | Confirm dialog, `DELETE`, then the list is read again and filtered on `active` | `counsellor-dashboard.test.tsx` "cancel sends no delete; mocked delete success refreshes the displayed list"; `ServiceForm.test.tsx` "deletion needs confirmation and returns only after mocked API success"; walkthrough 53; back end `test_deleting_a_service_withdraws_it_without_erasing_it` |
| An existing order and its booking keep their recorded service information | Every booking, receipt and Platform Owner screen shows the title the back end returns from the order | Back end `test_renaming_a_service_does_not_rewrite_what_was_already_bought`. No front-end test asserts the frozen title |
| A Career Professional who does not own the service is rejected and the service is unchanged | The edit screen only opens services in the caller's own list; the back end returns `404` | `counsellor-edit-service.test.tsx` "a missing service shows a recoverable error instead of an unrelated service"; back end `test_a_counsellor_cannot_edit_or_delete_someone_elses_service` |
| A rejected or failed edit or removal shows the failure and leaves the listing unchanged | Error banner; form values or card kept; no toast | `ServiceForm.test.tsx` "failed deletion keeps the service editable and does not announce success"; `counsellor-dashboard.test.tsx` "deletion rejection keeps the original service visible". A rejected edit: not unit tested (the create path is, in "preserves form values and permits retry after a server rejection") |

## Tests

- [`__tests__/counsellor/ServiceForm.test.tsx`](../../../frontend/__tests__/counsellor/ServiceForm.test.tsx):
  the edit and delete cases named above.
- [`__tests__/screens/counsellor-edit-service.test.tsx`](../../../frontend/__tests__/screens/counsellor-edit-service.test.tsx):
  pre-fill, a missing service and a failed load.
- [`__tests__/screens/counsellor-dashboard.test.tsx`](../../../frontend/__tests__/screens/counsellor-dashboard.test.tsx):
  delete from a card, cancelled and rejected.
- [`__tests__/api/counsellor-client.test.ts`](../../../frontend/__tests__/api/counsellor-client.test.ts):
  "updateService PATCHes the URL-encoded service identifier" and "deleteService DELETEs the URL-encoded
  service and resolves on 204".

Run from `frontend/`:

```bash
npx jest __tests__/counsellor/ServiceForm.test.tsx __tests__/screens/counsellor-edit-service.test.tsx \
  __tests__/screens/counsellor-dashboard.test.tsx __tests__/api/counsellor-client.test.ts
```

Local run on `dev` at `0df4068`, 17 October 2026, Node 22.14.0: 4 suites, 53 passed (the files also
cover US-05, US-34, US-35, US-37 to US-39 and the rest of the Career Professional client).

## Known gaps

- **Confirmation screen title:** the booking confirmation reads the live service through
  `GET /services/{serviceId}`, not the order. A rename between paying and opening it shows the new
  name; a service deleted in that gap leaves the summary without a title. The booking and payment
  references still show.
- **No front-end test of the frozen title**, and no browser or device run of edit or delete.
- **A rejected edit** is covered only through the shared create path.
- **Deleting a service with upcoming bookings** leaves those bookings in place, as the dialog says.
  What should happen to them is still open (out of scope on #31).
- Withdrawn services cannot be restored from the app, although `GET /me/services` still returns them.
- The edit screen reads every own service to show one.
