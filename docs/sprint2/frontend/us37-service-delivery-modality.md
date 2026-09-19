# US-37 frontend: How a service is delivered

Issue: [#137](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/137),
under [US-37 #32](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/32).

This slice adds the delivery-mode choice to the shared service form. A service is delivered online, in person
or both, and the choice is shown on the Career Professional's own service cards. Form reachability and submission are
covered in [US-34](us34-create-a-service.md), and the other fields in [US-35](us35-describe-and-price-a-service.md).
Choosing in person reveals the meeting-area fields of [US-38](us38-in-person-meeting-area.md). Filtering
Explore by mode ([US-45](us45-search-filter-sort.md)) and showing the mode to Job Seekers
([US-46](us46-service-evaluation.md)) are documented separately.

## Screens and flow

- In [ServiceForm.tsx](../../../frontend/src/counsellor/ServiceForm.tsx), the card **How do you deliver it?**
  has the body "Choose one or both. In-person services need a meeting area." and two options, **Online** and
  **In person**.
- The options are independent checkboxes, not a three-way selector. Checking both means "both".
  The values are the `Modality` type in [types.ts](../../../frontend/src/api/types.ts): `'online' | 'in_person'`.
  They are sent as the `modalities` array in the order they were toggled on.
- A new service starts with **Online** checked (`['online']`). An edited service starts with its saved
  `modalities`.
- On the workspace ([index.tsx](../../../frontend/app/counsellor/index.tsx)), each service card shows one tag
  per mode, "Online" or "In person" (`modalityLabel` in [format.ts](../../../frontend/src/format.ts)).

## Behaviour and states

- **Toggling:** each tap adds or removes that mode. Each option is a `Press` with `accessibilityRole="checkbox"`, an
  `accessibilityLabel` of "Online" or "In person", and `accessibilityState.checked`.
- **Validation:** with neither mode checked, submit shows "Choose at least one way you deliver this
  service." in the form banner, and nothing is sent. This rule runs after the US-35 field rules and before the
  US-38 area rule.
- **Meeting area:** when In person is checked, the meeting-area card appears ([US-38](us38-in-person-meeting-area.md)).
  When In person is unchecked, the card is hidden and `location: null` is sent.
- **Editing:** changing the modes and pressing **Save changes** sends `PATCH /me/services/{id}` with the whole
  service. The flash "Service updated" and the return to the workspace happen only after the request resolves.
  The workspace then re-reads the list, so the tags reflect what the backend returned.
- **Failure:** the backend's `message` is shown in the banner, the chosen modes are kept, and no success is shown.
- **Profile default not used:** the form does not read the profile's default delivery. The profile screen says "New services start with this
  delivery method" ([profile.tsx](../../../frontend/app/counsellor/profile.tsx)), but `ServiceForm` always
  starts a new service on `['online']`.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.createService(id, draft, token)` | `POST /me/services` | `modalities`: `['online']`, `['in_person']` or both values |
| `api.updateService(serviceId, draft, token)` | `PATCH /me/services/{id}` | Whole service, including `modalities` and `location` |
| `api.listOwnServices(id, token)` | `GET /me/services` | Source of the workspace tags |

The backend schema requires at least one mode, allows only `online` and `in_person`, and rejects
duplicates ([schemas.py](../../../backend/app/schemas.py) `CreateServiceRequest`).

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| Online, in-person or both, with otherwise valid data, is saved, and My Services shows it | All three combinations can be sent, and the workspace shows one tag per saved mode | `ServiceForm.test.tsx`: "creates a trimmed online service and announces success only after the API confirms" (online) and "requires state and city for %s, then saves the selected meeting area" (`in_person`, `both`). `web.spec.ts` "US34/35/37/38 counsellor Web publishing validates area and persists both delivery modes" checks both tags on the card and `['in_person', 'online']` through the API |
| With no mode selected, a modality-required error is shown and nothing is saved | Shows the banner message "Choose at least one way you deliver this service." Nothing is sent. | "requires at least one modality after deselecting online". The error is form-level, not attached to the control |
| A request with a missing mode or one outside the allowed values is rejected by the backend | Backend scope. The UI can only send the two valid values. | Backend: `test_invalid_service_fields_never_create_a_listing` (empty, `telephone`, duplicate). QA #139 records "missing/invalid modality rejection … pass" |
| Changing the mode of an existing service shows the new mode only after the backend confirms | The PATCH is sent. Navigation and the flash wait for it, and the workspace re-reads the list. | "switching an in-person edit to online clears its meeting area in the submitted update" (mocked API). Backend: `test_published_service_modality_update_requires_real_backend_persistence`. There is no browser or device test of editing |

## Tests

- [ServiceForm.test.tsx](../../../frontend/__tests__/counsellor/ServiceForm.test.tsx): the four tests named
  above
- [counsellor-client.test.ts](../../../frontend/__tests__/api/counsellor-client.test.ts): "updateService
  PATCHes the URL-encoded service identifier"
- [web.spec.ts](../../../frontend/e2e/web.spec.ts): "US34/35/37/38 …"

From `frontend/`:

```bash
npm test -- __tests__/counsellor/ServiceForm.test.tsx
npm run test:web -- -g "US34/35/37/38"   # after the setup in docs/sprint2/qa/reproduction.md
```

The Jest file passed locally on `dev` at `64cb324` on 18 September 2026. The browser test was not rerun
for this document; see [dev-sync-review-20260918.md](../qa/dev-sync-review-20260918.md).

## Known gaps

- **Profile default ignored:** the profile's default delivery does not pre-select the form, although the profile screen says it does.
- **Error placement:** the missing-mode error appears in the top banner, not beside the options.
- **Outdated QA note:** QA #139 lists "US37-AC4 edit modality persistence requires absent PATCH". On `dev`,
  `PATCH /me/services/{id}` exists and has a backend test, but editing has no browser or device test.
- **Device evidence:** native N06 is not run on either platform, and there are no selector screenshots for iOS or Android.
