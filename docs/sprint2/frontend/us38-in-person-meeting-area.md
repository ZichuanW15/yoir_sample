# US-38 frontend: Meeting area for in-person services

Issue: [#140](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/140),
under [US-38 #33](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/33).

When a service includes in-person delivery, the shared service form asks for a state and a city or region. It
refuses to publish without both. The mode choice that triggers this is covered in [US-37](us37-service-delivery-modality.md),
and the rest of the form in [US-34](us34-create-a-service.md) and [US-35](us35-describe-and-price-a-service.md).
The Career Professional's own base location is a separate profile field ([US-30](us30-professional-profile.md)).

## Screens and flow

- In [ServiceForm.tsx](../../../frontend/src/counsellor/ServiceForm.tsx), the card **Where you meet** is rendered
  only while **In person** is checked, whether alone or together with Online. It contains:
  - state chips for the `STATES` list in [format.ts](../../../frontend/src/format.ts): `NSW, VIC, QLD, WA, SA, TAS, ACT, NT`.
    They have `radio` role, and tapping the selected chip again clears it;
  - a free-text **City or region** field (placeholder "Melbourne").
- When a service with an area is edited, the fields are pre-filled from `service.location`.
- The area does not default from the profile's base location.
- On the workspace ([index.tsx](../../../frontend/app/counsellor/index.tsx)), a service with an area shows
  a `City, STATE` tag, for example "Melbourne, VIC".

## Behaviour and states

- **Validation:** when In person is checked and the state or the trimmed city is empty, submit shows
  "In-person delivery needs the state and city where you meet." in the form banner. Nothing is sent. This is the last
  client rule, after the US-35 and US-37 rules.
- **Required marking:** the fields carry no required marker. The only hint is the delivery card's body text, "Choose one or both.
  In-person services need a meeting area."
- **Payload:** `location` is `{ state, cityOrRegion: city.trim() }` when In person is checked, and `null` otherwise.
  Unchecking In person hides the card and sends `location: null`. The typed state and city stay in the form's memory
  and reappear if In person is checked again before saving.
- **Backend rejection:** the backend repeats the rule, with a `400` and the message "An in-person service needs a meeting area.". It
  sets `fieldErrors.location` ([counsellor.py](../../../backend/app/routers/counsellor.py)). The app shows
  the message in the banner, keeps the values and shows no success.
- **Labels tests rely on:** "City or region", the state chips by code (for example `radio` "VIC"), and the
  "In person" and "Online" checkboxes.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.createService(id, draft, token)` | `POST /me/services` | `location: { state, cityOrRegion }` or `null` |
| `api.updateService(serviceId, draft, token)` | `PATCH /me/services/{id}` | The whole service is sent, so switching to online-only clears the stored area |
| `api.listOwnServices(id, token)` | `GET /me/services` | Source of the workspace area tag |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| Choosing in-person or both shows state and city/region fields marked as required | The fields appear, but they are not marked required | Visibility: "requires state and city for %s, then saves the selected meeting area" (the field is present once In person is checked) and "switching an in-person edit to online clears its meeting area in the submitted update" (the field disappears when In person is unchecked). Planned "[QA-142][US38-AC1] %s visibly marks state and city/region required" **fails** for `in_person` and `both`. **Partial** |
| In-person or both with an empty state or city/region shows a required-field error, and nothing is saved | The banner shows the message above. Nothing is sent until both are filled. | `ServiceForm.test.tsx`: "requires state and city for %s, then saves the selected meeting area" (`in_person`, `both`). `web.spec.ts` "US34/35/37/38 …" expects the alert to contain "state and city" |
| With both fields completed, the service is saved with the area and My Services shows it | Sends the trimmed area. The workspace card shows `City, STATE`. | Same Jest test (sends `{ state: 'VIC', cityOrRegion: 'Melbourne' }`). `web.spec.ts` "US34/35/37/38 …" reads the area back through the API and sees "Melbourne, VIC" on the card |
| An in-person or both request without an area is rejected by the backend | Backend scope | Backend: `test_in_person_service_requires_both_nonblank_location_fields`. QA #142 records "real Web/API meeting-area persistence pass" |
| Online-only saves without an area | Sends `location: null`, with no area card and no rule | "creates a trimmed online service and announces success only after the API confirms". `web.spec.ts`: "US34 counsellor publishing preserves the draft after a transport failure and retries once @injected-network" reads back `location: null` |

## Tests

- [ServiceForm.test.tsx](../../../frontend/__tests__/counsellor/ServiceForm.test.tsx): the three tests above
- [counsellor-validation-ux.test.tsx](../../../frontend/__tests__/planned/counsellor-validation-ux.test.tsx):
  the archived "visibly marks … required" probe
- [web.spec.ts](../../../frontend/e2e/web.spec.ts): "US34/35/37/38 …" and "US34 … retries once"

From `frontend/`:

```bash
npm test -- __tests__/counsellor/ServiceForm.test.tsx
npm run test:planned -- __tests__/planned/counsellor-validation-ux.test.tsx
```

Run locally on `dev` at `64cb324` on 18 September 2026: the regression file passed, and both US-38 planned
cases failed.

## Known gaps

- **Required marking:** the area fields are not visibly marked required (US38-AC1).
- **Error placement:** the error is form-level and does not say which of the two fields is missing.
- **Defaults:** the area does not default from the profile's base location. The parent story left this as a UX choice.
- **Recorded input format:** state is a fixed list of Australian state and territory codes, and city is free text. The parent
  story asked for the chosen format to be recorded in the shared requirements; this document does not verify
  whether that was done.
- **Device evidence:** native N06 is not run on either platform, and there are no conditional-field screenshots for iOS or Android.
