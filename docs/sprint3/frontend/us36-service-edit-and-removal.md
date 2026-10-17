# US-36 frontend: editing and deleting a published service

Issues: front-end sub-issue [#199](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/199),
under [US-36 #31](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/31).

A Career Professional can change a service they have published, or delete it, from My services. The
screens were built in Sprint 2 and reached `dev` on 14 September 2026 in
[PR #154](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/154) (commit `5ba3309`).
The shared form is documented in [US-34 (Sprint 2)](../../sprint2/frontend/us34-create-a-service.md) and
[US-35 (Sprint 2)](../../sprint2/frontend/us35-describe-and-price-a-service.md). Sprint 3 retains
those edit/removal flows and adds the desktop layout and PR #246 confirmation snapshot reader.
This document checks the current screens against US-36's acceptance criteria, including the order
title and general meeting area the back end freezes at purchase
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

The back end freezes the service title and general meeting area on each order at purchase,
with the price and fee split. Booking readers return that purchased area after a listing moves;
the exact street address remains a separate booking field. The app does not hold a title of
its own for a booking. The following screens show what the back end returns:

| Screen | Field shown | Source |
|---|---|---|
| My sessions, booking detail, reschedule, review | `booking.serviceTitle` | `GET /me/bookings`, `GET /bookings/{bookingId}` |
| Confirmation after a successful booking read | `booking.serviceTitle`, `booking.meetingArea` | `GET /bookings/{bookingId}` |
| In-person booking detail | `booking.meetingArea` | `GET /bookings/{bookingId}`, populated from the order snapshot |
| Receipt | `receipt.description` | `GET /bookings/{bookingId}/receipt` |
| Platform Owner Payments, order detail, Bookings | `serviceTitle` | `GET /admin/payments`, `GET /admin/bookings` |

A later listing rename, price change or move therefore preserves those stored purchase values.
PR #246 makes confirmation use the successfully read booking snapshot too. Before
its initial booking read finishes, or when that read fails, it retains the live
listing fallback. An empty or omitted area in a loaded booking never borrows the
listing location. The recorded coverage separates the initial fallback from a
successfully consumed booking response.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listOwnServices` | `GET /me/services` | Workspace list, and the edit screen's pre-fill. |
| `api.updateService(serviceId, draft)` | `PATCH /me/services/{serviceId}` | The whole form (`ServiceUpdate` is the same type as `ServiceDraft`). Id URL-encoded. |
| `api.deleteService(serviceId)` | `DELETE /me/services/{serviceId}` | Soft delete; `204`. Id URL-encoded. |

The back end checks ownership. A request for another Career Professional's service returns `404`, so
the app never learns whether that id exists.

## Executed acceptance coverage

| Criterion | Frontend behaviour | Evidence |
|---|---|---|
| An edit shows the updated values only after the back end confirms it | Toast and return to the workspace wait for `updateService`; the workspace then reads the list again | `ServiceForm.test.tsx` "switching an in-person edit to online clears its meeting area in the submitted update"; `counsellor-edit-service.test.tsx` "does not show editable values until loading finishes, then pre-fills the matching owned service"; walkthrough 52 |
| A confirmed removal takes the service off My services, and the back end no longer returns it as active | Confirm dialog, `DELETE`, then the list is read again and filtered on `active` | `counsellor-dashboard.test.tsx` "cancel sends no delete; mocked delete success refreshes the displayed list"; `ServiceForm.test.tsx` "deletion needs confirmation and returns only after mocked API success"; walkthrough 53; back end `test_deleting_a_service_withdraws_it_without_erasing_it` |
| An existing order and its booking keep their recorded service information | Booking detail reads the order-backed title and general area; receipts and Platform Owner views use stored titles. Confirmation also consumes the successfully read purchased title/area, with a listing fallback while the initial booking read is loading or failed | `sprint3-completion.spec.ts` checks purchase/edit/withdraw history; `test_sprint3_final_history_qa.py` verifies titles/receipts; `test_sprint3_service_history_qa.py` and `test_sprint3_meeting_area_migration_qa.py` check area history and migration; `sprint3-meeting-area.spec.ts` checks both parties' browser details after move/withdrawal; `screens/confirmation-history.test.tsx` covers the confirmation snapshot and fallback boundaries |
| A Career Professional who does not own the service is rejected and the service is unchanged | The edit screen only opens services in the caller's own list; the back end returns `404` | `counsellor-edit-service.test.tsx` "a missing service shows a recoverable error instead of an unrelated service"; back end `test_a_counsellor_cannot_edit_or_delete_someone_elses_service` |
| A rejected or failed edit or removal shows the failure and leaves the listing unchanged | Error banner; form values or card kept; no toast | `ServiceForm.test.tsx` "failed deletion keeps the service editable and does not announce success"; `counsellor-dashboard.test.tsx` "deletion rejection keeps the original service visible". `service-booking-recovery.test.tsx` checks rejected PATCH, retained edits and acknowledgement-gated retry; `test_failed_service_change_preserves_listing_and_paid_history_then_same_request_retries` covers edit/withdraw rollback after flushed SQL writes |

## Tests

- [`__tests__/counsellor/ServiceForm.test.tsx`](../../../frontend/__tests__/counsellor/ServiceForm.test.tsx):
  the edit and delete cases named above.
- [`__tests__/screens/counsellor-edit-service.test.tsx`](../../../frontend/__tests__/screens/counsellor-edit-service.test.tsx):
  pre-fill, a missing service and a failed load.
- [`__tests__/screens/counsellor-dashboard.test.tsx`](../../../frontend/__tests__/screens/counsellor-dashboard.test.tsx):
  delete from a card, cancelled and rejected.
- [`__tests__/screens/confirmation-history.test.tsx`](../../../frontend/__tests__/screens/confirmation-history.test.tsx):
  eight scenarios for purchased title/area, response order, empty/omitted areas, listing
  failure, initial booking-read failure and the returned online meeting link.
- [`e2e/sprint3-responsive.spec.ts`](../../../frontend/e2e/sprint3-responsive.spec.ts):
  the desktop deletion dialog preserves an unsaved draft on Cancel, sends no DELETE,
  and withdraws the real listing only after confirmation.
- [`__tests__/api/counsellor-client.test.ts`](../../../frontend/__tests__/api/counsellor-client.test.ts):
  "updateService PATCHes the URL-encoded service identifier" and "deleteService DELETEs the URL-encoded
  service and resolves on 204".

Run from `frontend/`:

```bash
npx jest __tests__/counsellor/ServiceForm.test.tsx __tests__/screens/counsellor-edit-service.test.tsx \
  __tests__/screens/counsellor-dashboard.test.tsx __tests__/api/counsellor-client.test.ts
```

**Original dev-only execution:** `0df4068`, 17 October 2026, Node 22.14.0: 4 suites, 53 passed (the files also
cover US-05, US-34, US-35, US-37 to US-39 and the rest of the Career Professional client).

The refresh adds [the existing-service recovery case](../../../frontend/__tests__/screens/service-booking-recovery.test.tsx):
a rejected edit retains title and price, retries the same PATCH payload, blocks a
second in-flight write and announces success only after acknowledgement. Its
focused execution passed; the refresh report records the wider preset executions.

The separate [in-person browser regression](../../../frontend/e2e/sprint3-meeting-area.spec.ts)
passed on `9cce973`: real API setup, purchase and stub payment, a move from Melbourne
to Geelong, then withdrawal. Both buyer and counsellor browser details and API
readbacks kept the purchased Melbourne area; the run retains screenshots. This
one-case execution followed the earlier complete 38-case Chromium selection and
is recorded separately in the meeting-area report.

For `8713b38`, the same browser source now also opens confirmation after listing
rename/move and withdrawal. At 1440px and 390px it waits for real booking and
listing responses, then verifies the purchased title and Melbourne area. A
withdrawn listing's 404 does not replace or hide the successfully read snapshot.
The confirmation report records the expanded execution separately from the
earlier one-case result.

## QA branch evidence

The preceding dev-only counts identify the original source-document execution.
The `sprint3-qa` overlay adds executed API, component and browser coverage. Its
[17 October report](../qa/test-results-final-20261017.md) records the tested
`0df4068` product, and the [dev refresh report](../qa/test-results-dev-refresh-20261017.md)
records reconciliation with `972caee`. That dev update adds documentation; product
code is unchanged. Suite counts belong to their dated executions and are not added
together. The [meeting-area report](../qa/test-results-meeting-area-20261017.md)
records the subsequent `9cce973` baseline from PR #244. The
[latest confirmation report](../qa/test-results-confirmation-20261017.md) records
`8713b38d63ccb969dcc69a44a02f888fd65caa9a`, including the desktop update and PR #246.
The older 06:33 UTC frontend results retain their original source boundary and
are not presented as fresh verification of the desktop product.
The [QA matrix](../qa/qa-matrix.md) links these results to the QA tasks.

## Recorded behaviour and findings

- **Confirmation snapshot:** PR #246 reads `booking.serviceTitle` and
  `booking.meetingArea`. A successful booking read preserves them when the listing
  is renamed, moved or unavailable. The current listing remains the initial
  loading/failed-read fallback; it is not proof that a booking read succeeded.
- **Current frozen-title evidence:** the [browser purchase/edit/withdraw journey](../../../frontend/e2e/sprint3-completion.spec.ts)
  passes on the 17 October product. [D07 native observations](../qa/device-acceptance.md) remain dated
  to the older 16 October `cdcc44e` product, where both platforms reproduced title mutation.
- **Backend meeting-area history:** PR #244 stores the general area on each order.
  `test_sprint3_service_history_qa.py` now passes the former area XFAIL as ordinary
  regression, with migration and history outcomes in the dated meeting-area report.
- **Confirmation assertion correction:** the old `S3-CONFIRMATION-AREA` run
  observed Geelong after reading Melbourne. Its short-string matcher also required
  exact equality with a longer delivery note, so it would fail after the product
  fix. Corrected regex assertions fail with Geelong on `bad7a8b` and pass with
  Melbourne on PR #246. The ordinary
  [`confirmation-history.test.tsx`](../../../frontend/__tests__/screens/confirmation-history.test.tsx)
  retains that corrected scenario; the original execution remains unchanged.
- **Deleting a service with upcoming bookings** leaves those bookings in place, as the dialog says.
  What should happen to them is still open (out of scope on #31).
- Withdrawn services cannot be restored from the app, although `GET /me/services` still returns them.
- The edit screen reads every own service to show one.
