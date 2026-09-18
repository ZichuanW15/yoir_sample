# US-35 frontend: Describe and price a service

Issue: [#134](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/134),
under [US-35 #30](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/30).

This slice covers the fields and client-side rules of the shared service form: title, description,
price and session length. The same form is used to publish a new service and to edit one. How the form is
reached and submitted is described in [US-34](us34-create-a-service.md). The delivery-mode and meeting-area
parts of the form are covered in [US-37](us37-service-delivery-modality.md) and
[US-38](us38-in-person-meeting-area.md).

## Screens and flow

- The component is [ServiceForm.tsx](../../../frontend/src/counsellor/ServiceForm.tsx). It is rendered by
  `/counsellor/services/new` ([new.tsx](../../../frontend/app/counsellor/services/new.tsx)) and
  `/counsellor/services/[serviceId]/edit` ([edit.tsx](../../../frontend/app/counsellor/services/[serviceId]/edit.tsx)).
- Card **The session** has two fields:
  - **Service title**, with the placeholder "Interview confidence coaching";
  - **Description** (multiline), with the placeholder "What happens in the session, and what the buyer walks away with."
- Card **What it costs** has two controls:
  - **Price (AUD)**, a text input with a `$` prefix, decimal input mode and the hint "The full price of one
    session, in Australian dollars.";
  - "How long is a session?", with chips **15 min, 30 min, 45 min, 1 hr, 90 min, 2 hr**. The default is 1 hr,
    and the hint reads "Job seekers are offered start times that fit this length inside your availability."
- There is no category field. The currency is fixed at `AUD`.
- The edit route finds the service in `GET /me/services`, because there is no single-service owner route.
  - While the list loads, it shows a spinner.
  - If the service is missing, it shows "This service is no longer available." and a "Back to workspace" button.
  - When the service is found, the form is pre-filled. The price is pre-filled as `String(priceMinor / 100)`, for example `95` or `70.5`.

## Behaviour and states

On Publish or Save, the rules below run in order. Only the **first** failure is shown, in a single `ErrorBanner`
above the cards, and nothing is sent. The US-37 and US-38 rules follow these.

| Rule | Message |
|---|---|
| Title under 5 characters after trimming | Give the service a clear title of at least 5 characters. |
| Description under 30 characters after trimming | Describe what the buyer gets in at least 30 characters. |
| Price empty, not a number, or not above zero | Enter a price greater than zero. |
| Price above 10,000,000 cents | Enter a price under $100,000. |

- **Price parsing:** `Math.round(Number(price.replace(/[^0-9.]/g, '')) * 100)`. Every character except
  digits and `.` is removed first.
  - `95.25` becomes 9525, and `$95` is accepted as 9500.
  - `1.2.3` fails, because it becomes `NaN`.
  - `-5` is accepted as 500, because the minus sign is removed (defect below).
- **Payload:** `{ title, description, priceMinor, durationMinutes, currency: 'AUD', modalities, location }`.
  Title and description are sent trimmed.
- **While saving:** the footer button is busy and disabled, and it is also disabled during a delete.
- **After a failure:** the banner shows the backend `message` via `userFacingError`. `fieldErrors` from a
  `400 VALIDATION_ERROR` are not placed on the fields. All values stay in the form.
- **After success:** `router.replace('/counsellor')`, then the flash "Service published" or "Service updated".
- **Where saved values appear:** the workspace service card shows the title, the price formatted by `money()` (whole dollars) and a
  two-line description. It does **not** show the duration.
- **Differences from the backend limits** in `CreateServiceRequest` ([schemas.py](../../../backend/app/schemas.py)):

  | Field | Backend accepts | Form accepts |
  |---|---|---|
  | Title | 1–120 characters after trimming | At least 5 characters, no maximum |
  | Description | 1–5,000 characters | At least 30 characters, no maximum |
  | Price | `priceMinor ≥ 0`, no maximum | Above zero, up to $100,000 |
  | Duration | 15–480 minutes in 15-minute steps | One of the six chips |

  When a value passes the form but not the backend, for example a 121-character title, the app shows the backend's message.
- **Labels tests rely on:** "Service title", "Description", "Price (AUD)", the duration chips (`radio` role,
  named by their label), "Publish service", "Save changes", "Delete service", "Back".

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.createService(id, draft, token)` | `POST /me/services` | New service; `201` on success |
| `api.updateService(serviceId, draft, token)` | `PATCH /me/services/{id}` | Whole-service body, the same shape as create (`ServiceUpdate = ServiceDraft`) |
| `api.listOwnServices(id, token)` | `GET /me/services` | Edit route pre-fill |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| Valid title, description, category, price and duration are accepted, and My Services shows the saved values | Sends title, description, price and duration. There is no category field. The workspace shows the title, a rounded price and the description, but not the duration. | `ServiceForm.test.tsx`: "creates a trimmed online service and announces success only after the API confirms". `web.spec.ts` "US34/35/37/38 …" reads back `priceMinor` 7050 through the API. **Partial:** no category, duration not displayed, and cents not displayed (F01) |
| Each empty required field shows a field-level error next to it, and nothing is saved | Shows only the first failing rule, in one banner at the top. Nothing is saved. | "rejects incomplete or invalid input %j without creating a listing" (7 cases). Planned "[QA-136][US35-AC2] identifies every missing implemented service field in one submission" **fails**. **Partial** |
| Invalid price or duration gives an error on that field, and the backend rejects it if sent | Non-numeric and zero prices are rejected in the form. A negative price loses its sign and is sent as positive. Duration can only be one of the fixed chips. | Defect "QA #136 rejects a negative price instead of silently changing its sign" **fails**. `integrity.spec.ts` "DEF-PRICE-SIGN: negative browser input must not publish a positive-price service @defect". **Partial** |
| A request that bypasses the app with invalid data gets a validation error naming the fields, and nothing is created | Backend scope | Backend: `test_invalid_service_fields_never_create_a_listing`, `test_service_requires_each_published_field`. Unknown fields are still silently dropped: strict xfail `test_service_creation_rejects_unpublished_fields_instead_of_silently_dropping_them` |
| Backend validation errors are shown on the form, and the service is not shown as saved | Shows the backend `message` only. No success is shown, and values are kept. | "preserves form values and permits retry after a server rejection" passes. Planned "[QA-136][US35-AC5] retains and renders backend fieldErrors rather than only the summary" **fails**. **Partial** |

## Tests

- [ServiceForm.test.tsx](../../../frontend/__tests__/counsellor/ServiceForm.test.tsx) (15 cases)
- [counsellor-edit-service.test.tsx](../../../frontend/__tests__/screens/counsellor-edit-service.test.tsx):
  "does not show editable values until loading finishes, then pre-fills the matching owned service",
  "a missing service shows a recoverable error instead of an unrelated service",
  "a failed load displays the server error and supports leaving the screen"
- [counsellor-acceptance.test.tsx](../../../frontend/__tests__/defects/counsellor-acceptance.test.tsx) (defect
  suite) and [format-planner-acceptance.test.ts](../../../frontend/__tests__/defects/format-planner-acceptance.test.ts)
  (F01)
- [counsellor-validation-ux.test.tsx](../../../frontend/__tests__/planned/counsellor-validation-ux.test.tsx) (archived probes)

From `frontend/`:

```bash
npm test -- __tests__/counsellor/ServiceForm.test.tsx __tests__/screens/counsellor-edit-service.test.tsx
npm run test:defects -- __tests__/defects/counsellor-acceptance.test.tsx
TZ=Australia/Melbourne npm run test:defects -- __tests__/defects/format-planner-acceptance.test.ts
```

Run locally on `dev` at `64cb324` on 18 September 2026:

- The regression files passed.
- The negative-price and F01 defect cases failed, as listed in
  [dev-sync-review-20260918.md](../qa/dev-sync-review-20260918.md).
- The two planned US-35 probes failed.

## Known gaps

- **No category field:** the parent story's category requirement is not implemented.
- **Negative prices:** a negative price is published as a positive one (QA #136).
- **Displayed prices:** they drop cents, because `money()` uses `maximumFractionDigits: 0`.
- **Validation display:** errors are form-wide and one at a time. Backend `fieldErrors` are ignored.
- **Limits differ between form and backend:** see the table in Behaviour and states.
- **Duration display:** the workspace card does not show the duration.
- **Outdated QA note:** QA #136 lists the edit API as absent; that was true on 16 September. `PATCH /me/services/{id}` now exists on
  `dev` ([counsellor.py](../../../backend/app/routers/counsellor.py)), but there is no browser test of editing.
- **Device evidence:** native N06 is not run on either platform, and no validation-state screenshots are recorded.
