# US-39 frontend: Career Professional availability

Issue: [#143](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/143),
under [US-39 #34](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/34).

This slice lets a Career Professional add and remove the hours they are free, on one screen at
`/counsellor/availability`. Availability belongs to the person, not to a service. Each saved **window**
is a stretch of time with the delivery modes available in it. The backend derives bookable start
times for each service from the Career Professional's windows and that service's duration. Choosing a start
time ([US-40](us40-slot-selection.md)) and holding it ([US-41](us41-double-booking.md)) are documented separately. The workspace entry card is described in
[US-34](us34-create-a-service.md).

## Screens and flow

- The route is [availability.tsx](../../../frontend/app/counsellor/availability.tsx), registered in
  [_layout.tsx](../../../frontend/app/_layout.tsx). Date and draft helpers are in
  [availabilityPlanner.ts](../../../frontend/src/counsellor/availabilityPlanner.ts).
- **Entry:** the workspace card **Availability**. Its hint reads "`n` open slots. Next on <day>." or "No open slots. Add
  availability so buyers can choose a time." The screen has a `BackBar` titled "Availability"
  (`goBack('/counsellor')`) and no bottom navigation.
- **Layout, top to bottom:**
  - the heading "When do you work?" and an explanation;
  - the error banner;
  - a **month calendar** with "Previous month" and "Next month", an `en-AU` month label and a Monday-first grid. Past days are disabled, and tapping a day toggles it;
  - **Or repeat every**: weekday chips `Mo … Su` (checkboxes). Once a weekday is chosen, "for the next" offers
    2, 4 or 8 weeks (default 4);
  - **Hours**: "From" and "Until" chips for whole hours 7–19 (default 9 to 12). Below them is "How can you meet in these
    hours?" with Online and In person checkboxes, both on by default;
  - a summary, "`n` day(s), 9:00 to 12:00" or "Choose the days you are free.", and the **Add availability** button;
  - the list heading "`n` on your calendar" or "Nothing on your calendar yet";
  - one row per window: the long date, the time range, the modes joined by " & ", " · has a booking" when
    `hasBookings`, and a remove button.
- **No weekly calendar:** the calendar is only for choosing days. Saved windows appear as a chronological list, not in a weekly calendar view.

## Behaviour and states

- **Role guard:** the screen renders `<Redirect href="/" />` without a `counsellor` session.
- **Load:** each focus reads `GET /me/availability-windows`. A failure shows the message in the banner. There is no
  loading indicator. The backend list is not filtered by date, so past windows remain listed.
- **Days:** the chosen days are the union of tapped dates and the chosen weekdays, over the selected number of weeks
  from today. Days before today are excluded.
- **Drafts:** `buildWindowDrafts` makes one draft per day from the local hours and sends `toISOString()` (UTC).
  Drafts that touch or overlap are merged when their modes match, and an end at or before the start is skipped.
- **Validation (in order):**

  | Rule | Message |
  |---|---|
  | Until is not after From | Your finish time must be after your start time. |
  | No mode selected | Choose at least one way you can meet. |
  | No days selected | Choose at least one day. |
  | More than 60 days in one save | That is `n` days at once. Add up to 60. |

- **Adding:** the button is busy while saving. The app sends one `POST` per draft, **sequentially**, and the backend
  merges each window with overlapping or adjacent windows that offer the same modes (`_merge_overlapping` in
  [counsellor.py](../../../backend/app/routers/counsellor.py)). On success, the chosen days and weekdays are cleared,
  the list is re-read and the flash reads "`n` day(s) added".
- **Adding fails:** the error is set and the list is re-read. That re-read calls `setError('')`, so after a
  successful re-read the error disappears and no feedback remains. This is defect QA #145, below. Windows sent
  before the failure stay saved, and the list shows what the server holds.
- **Removing:** a confirmation reads "Remove this availability?" with "Job seekers will no longer be able to book any of your
  services in this time." and the button "Remove". The screen calls `DELETE` and then re-reads the list. If the call fails, for example with a
  `409` for a booked window, the message is shown and the list is unchanged.
- **Editing:** there is no edit action. The client has `api.updateAvailabilityWindow` (`PATCH`), but this
  screen does not call it. To change a window, the Career Professional removes it and adds a new one.
- **Timezone:** times are shown in the device's timezone (`toLocaleTimeString('en-AU')`) with no timezone
  label. The request bodies carry UTC instants.
- **Labels tests rely on:**
  - day cells are named by `fmtLong` date, for example "Saturday 19 September", with a `selected` state;
  - "Previous month", "Next month", "Add availability";
  - weekday and mode checkboxes, and the hour and week chips (`radio`);
  - remove buttons named `Remove <long date> <start time>`.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.listOwnAvailabilityWindows(id, token)` | `GET /me/availability-windows` | The caller's whole calendar, soonest first. The id argument is not sent |
| `api.createAvailabilityWindow(draft, token)` | `POST /me/availability-windows` | `{ startsAt, endsAt, modalities }`. No service id |
| `api.deleteAvailabilityWindow(windowId, token)` | `DELETE /me/availability-windows/{id}` | `204` on success |
| `api.updateAvailabilityWindow(windowId, draft, token)` | `PATCH /me/availability-windows/{id}` | Exists in the client, but no screen uses it |

## Acceptance criteria

| Criterion (parent story) | Frontend behaviour | Evidence |
|---|---|---|
| A weekly calendar of only the Career Professional's own slots, with times and timezone | Shows a chronological list of windows, not a weekly calendar. Times are in local time with no timezone label. | Planned "[QA-145][US39-AC1] one weekly availability view does not mix slots two weeks apart" and "[QA-145][US39-AC1] availability times include a visible timezone" both **fail**. Own-only: backend `test_owner_lists_never_include_another_counsellors_services_or_calendar`. **Not met** |
| An added slot appears after the backend confirms, and the endpoint returns it | Each window is posted, the list is re-read and the flash appears only after success | `counsellor-availability.test.tsx`: "sends one service-independent window with delivery choices and timezone-qualified bounds", "repeating one weekday for two weeks creates two windows and reloads merged server state". `web.spec.ts`: "US39 real Web availability windows create, derive service starts and remove through the API" |
| An edited or removed slot is reflected, and the old time is no longer returned | Remove works. There is no edit in the UI. | Remove: "cancel preserves a window; confirmed deletion reloads the calendar" and `web.spec.ts` US39. Edit: backend `test_window_create_edit_and_delete_persist_and_rederive_public_starts` and client "updateAvailabilityWindow PATCHes the URL-encoded window identifier" only. **Partial** |
| A Job Seeker's or another Career Professional's token cannot change this calendar | The screen redirects other roles. Changes are sent only with the Career Professional's own token. | "restricts the calendar to counsellors (%j)". Backend: `test_every_counsellor_operation_rejects_anonymous_and_wrong_roles`, `test_foreign_and_missing_availability_resources_are_equally_hidden` |
| A rejected or failed change is not shown as saved | Removal: the error is shown and the list is unchanged. Adding: no success flash and the list re-read from the server, but the error message is wiped. | "a booked window remains visible when the server refuses deletion" passes. Defect "QA #145 retains a failed window creation error after refreshing the calendar" **fails**. **Partial** |

## Tests

- [counsellor-availability.test.tsx](../../../frontend/__tests__/screens/counsellor-availability.test.tsx) (9 cases)
- [availabilityPlanner.test.ts](../../../frontend/__tests__/counsellor/availabilityPlanner.test.ts) (18 cases:
  month grid, weekday ranges, draft building and merging)
- [counsellor-client.test.ts](../../../frontend/__tests__/api/counsellor-client.test.ts): the four
  availability-window client calls
- [counsellor-acceptance.test.tsx](../../../frontend/__tests__/defects/counsellor-acceptance.test.tsx) and
  [format-planner-acceptance.test.ts](../../../frontend/__tests__/defects/format-planner-acceptance.test.ts)
  (defect suite)
- [counsellor-features.test.tsx](../../../frontend/__tests__/planned/counsellor-features.test.tsx) and
  [counsellor-validation-ux.test.tsx](../../../frontend/__tests__/planned/counsellor-validation-ux.test.tsx) (archived probes)
- [web.spec.ts](../../../frontend/e2e/web.spec.ts): "US39 real Web availability windows …" (Chromium, `Australia/Melbourne`)

From `frontend/`:

```bash
npm test -- __tests__/screens/counsellor-availability.test.tsx __tests__/counsellor/availabilityPlanner.test.ts
TZ=Australia/Melbourne npm run test:defects -- __tests__/defects/counsellor-acceptance.test.tsx __tests__/defects/format-planner-acceptance.test.ts
npm run test:web -- -g "US39"   # after the setup in docs/sprint2/qa/reproduction.md
```

Run locally on `dev` at `64cb324` on 18 September 2026:

- The regression files passed.
- The defect cases "QA #145 retains a failed window creation error…" and "F05 / QA #145: weekday recurrence
  visits every local day once across DST end" failed.
- Both US-39 planned probes failed.

## Known gaps

- **Weekly view and timezone:** there is no weekly calendar view and no visible timezone (US39-AC1).
- **Editing:** a window cannot be edited in the UI. The Career Professional removes it and adds a new one.
- **Failed adds (QA #145):** a failed add loses its error message when the list is re-read.
- **DST (F05):** `weekdayDatesInRange` steps in fixed 24-hour blocks, so recurrence can skip or repeat a day
  when daylight saving ends.
- **Partial saves:** a multi-day save is not atomic. Days sent before a failure remain saved.
- **Past windows:** they stay in the list, and they are counted on the workspace card.
- **Device evidence:** native N07 (availability and timezone) is not run on either platform, and there are no add/remove recordings.
  QA #145 still lists "resource-404 fallback" and planner-overlap defects from 16 September. The
  [18 September review](../qa/dev-sync-review-20260918.md) says the old slot-overlap and fallback findings
  no longer reproduce on `dev`.
