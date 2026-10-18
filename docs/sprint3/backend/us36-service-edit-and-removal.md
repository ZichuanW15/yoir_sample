# US-36 backend: editing and withdrawing a published service

Issue: back-end sub-issue [#200](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/200),
under [US-36 #31](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/issues/31).

This slice lets a Career Professional change or withdraw a service they have already published,
without erasing what Job Seekers have already bought. The two routes reached `dev` in Sprint 2 with
[PR #157](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/157) on 18 September
2026. In Sprint 3 the work under #200 checked them against US-36's acceptance criteria. That check
found the third criterion only partly met: an order kept the price it was bought at, but not the
service's name, so renaming a listing rewrote existing bookings and issued receipts. This change
freezes the title onto the order at purchase, as the amounts already were, with migration `0011`.
QA then found the same problem with the in-person meeting area (`S3-BE-SERVICE-HISTORY` in
[PR #241](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/pull/241)): moving a listing
moved sessions already paid for. Migration `0012` freezes the area onto the order in the same way.

Screenshots: [Sprint 3 walkthrough](../walkthrough/sprint-3-feature-walkthrough.md), screens 52 and 53.

## Endpoints and flow

| Endpoint | Code | What it does |
|---|---|---|
| `PATCH /me/services/{serviceId}` | `update_service` in [`app/routers/counsellor.py`](../../../backend/app/routers/counsellor.py) | Replaces the listing with the submitted form. |
| `DELETE /me/services/{serviceId}` | `delete_service` in the same file | Withdraws the listing: `active = false`. |
| `GET /me/services` | `list_own_services` | The owner's services, withdrawn ones included, each with `active`. |

Flow: the Career Professional opens a service from My Services, edits or removes it, and the app
shows the change only once the backend confirms it.

## Behaviour and states

- **Guard and ownership:** `require_counsellor`. A service owned by someone else is reported as
  `404 NOT_FOUND`, not `403`, so whether a given service ID exists is not revealed.
- **Edit replaces the whole listing.** The body is the full form (`CreateServiceRequest`), not a patch
  of changed fields, so clearing an optional field such as the location actually clears it. An
  in-person service still needs a state and city or region: `400` with a `location` field error.
- **Edit is atomic:** the write and the response are built inside one transaction and rolled back on
  failure.
- **Withdraw is a soft delete.** The row stays, because orders, bookings and receipts reference it.
  A withdrawn service disappears from `GET /services` and `GET /services/{serviceId}` (`404`), and
  can no longer be booked. Withdrawing twice is not an error.
- **What an edit does not touch:** each order keeps the amount, the fee breakdown and the service's
  title frozen at purchase (`Order.service_title`). Changing the price or renaming the listing never
  changes what a Job Seeker already paid for, or the name it appears under on their booking, their
  receipt, the booking confirmation emails, the Career Professional's commission statement or the
  Platform Owner's order views. Only the listing itself shows the new name.
- **The meeting area is frozen too.** An in-person order keeps the area ("City, STATE") the listing
  named when it was placed (`Order.meeting_area`). Moving the listing to another city changes where
  new bookings meet, but the existing booking, both parties' booking lists and the confirmation emails
  keep the original area. An online booking shows no area, as before.
- **Emails use the frozen title too.** The title is frozen when the order is placed, but the two
  confirmation emails are sent later, when payment confirms. `booking_received` and
  `booking_confirmed` in [`app/mail/messages.py`](../../../backend/app/mail/messages.py) read
  `order.title_for(service)` and `order.area_for(service)`, so a rename or a move between ordering
  and paying does not give the emails a different name or place from the booking they confirm.
- **Existing orders:** migration `0011` adds `orders.service_title` and migration `0012` adds
  `orders.meeting_area`, each filled for every existing order from its service at upgrade time.
  Reading code falls back to the live listing only for an order that has no value, through
  `Order.title_for` and `Order.area_for`.
- **Publishing versus editing:** creating a service needs the full publishing check
  (`require_publishing_counsellor`), but editing and withdrawing only need a Career Professional
  session. A Career Professional whose verification is later revoked can still edit or withdraw their
  own listings.

## API boundary

| Client call | Endpoint | Notes |
|---|---|---|
| `api.updateService(serviceId, form)` | `PATCH /me/services/{serviceId}` | Whole form; `200` with the updated service. |
| `api.deleteService(serviceId)` | `DELETE /me/services/{serviceId}` | `204`. |
| `api.listOwnServices` | `GET /me/services` | Returns withdrawn services too; the workspace hides them by filtering on `active`. |

## Acceptance criteria

| Criterion | Backend behaviour | Evidence |
|---|---|---|
| An edit shows only after the backend confirms it | Update returns the stored listing | `test_update_service_replaces_the_listing`, `test_update_service_clears_a_location_the_form_left_empty`, `test_an_in_person_service_still_needs_a_meeting_area_when_edited` |
| A removed service leaves My Services and is no longer returned as active | Soft delete; public routes exclude it | `test_deleting_a_service_withdraws_it_without_erasing_it`, `test_deleting_a_service_twice_is_not_an_error`; the workspace filters on `active` |
| An existing order and booking still return their recorded service information | Amount, breakdown, title and meeting area are frozen on the order | `test_renaming_a_service_does_not_rewrite_what_was_already_bought` (booking detail, My Bookings, the receipt and both Platform Owner views keep the original title; the receipt keeps the original amount); `test_a_rename_before_payment_does_not_change_the_confirmation_emails`; `test_moving_an_in_person_service_does_not_move_a_session_already_booked` (emails, booking detail and both parties' lists keep the original area); `test_existing_orders_are_backfilled_with_their_service_title`, `test_existing_orders_are_backfilled_with_their_meeting_area` |
| Another Career Professional cannot edit or remove it | `404`, service unchanged | `test_a_counsellor_cannot_edit_or_delete_someone_elses_service`, `test_editing_a_service_needs_a_counsellor_session` |
| A rejected or failed request leaves the listing unchanged | Validation before write; rollback | `test_an_in_person_service_still_needs_a_meeting_area_when_edited` |

## Tests

- [`tests/test_counsellor.py`](../../../backend/tests/test_counsellor.py), section "US-36: editing and
  withdrawing a service": 10 tests, all named above.
- [`tests/test_migrations.py`](../../../backend/tests/test_migrations.py):
  `test_existing_orders_are_backfilled_with_their_service_title` and
  `test_existing_orders_are_backfilled_with_their_meeting_area`.
- [`tests/test_diagnosis_migration.py`](../../../backend/tests/test_diagnosis_migration.py) pins the
  newest revision, now `0012`, and its downgrade test no longer expects `orders.service_title` or
  `orders.meeting_area` to survive a downgrade below them.
- QA's `test_existing_booking_keeps_recorded_meeting_area_after_service_edit`
  (`tests/test_sprint3_service_history_qa.py`, originally in PR #241) is now an
  ordinary regression assertion; its former strict-XFAIL marker is removed.
  The same file extends checks to separate purchases, rendered emails, exact
  addresses, rescheduling, empty snapshots and legacy fallback.
- [`tests/test_sprint3_meeting_area_migration_qa.py`](../../../backend/tests/test_sprint3_meeting_area_migration_qa.py)
  covers migration `0012` with complete, absent and partial areas; preservation of
  existing rows, repeated startup upgrades, and downgrade/re-upgrade. The fixture
  owns a private PostgreSQL schema or a separate temporary SQLite file.

Run from `backend/`:

```bash
env -u DATABASE_URL pytest tests/test_counsellor.py tests/test_migrations.py -q \
  -k "update_service or clears_a_location or still_needs_a_meeting_area_when_edited or deleting_a_service or cannot_edit_or_delete or editing_a_service_needs or renaming_a_service or rename_before_payment or moving_an_in_person or backfilled_with_their"
```

**Original author validation:** `dev` at `972caee` plus this change, 17 October 2026,
Python 3.12.8, temporary SQLite database: 12 passed. Full backend suite: 802 passed,
8 skipped, 18 expected failures. These are the author's original execution totals.

**Earlier QA execution baseline:** `9cce9737ded87c13a7575d7236a051c5db7628f8`. The
[meeting-area QA report](../qa/archive/test-results-meeting-area-20261017.md) records
the subsequent isolated PostgreSQL, migration and browser results and their exact
commands. The full PostgreSQL run passed **916 cases**, with **18 strict XFAILs**
and 7 deselected cases; backend line/branch coverage was **94.84% / 85.45%**.
The former meeting-area XFAIL passed as ordinary regression. The [QA matrix](../qa/qa-matrix.md)
maps these results to #201 and #207. The current QA baseline is
`8713b38d63ccb969dcc69a44a02f888fd65caa9a`. PR #246 makes confirmation consume the
successfully read booking title/area too, with the initial listing fallback
retained. The [confirmation report](../qa/archive/test-results-confirmation-20261017.md)
records that frontend verification and corrects the old assertion's short-string
matcher without rewriting its historical Geelong observation.

The separate [`sprint3-meeting-area.spec.ts`](../../../frontend/e2e/sprint3-meeting-area.spec.ts)
browser execution passed after the complete 38-case Chromium selection. Real
in-person purchase/stub payment, a move to Geelong and withdrawal leave Melbourne
visible in both participants' booking details and authenticated API reads. The
one-case result and screenshots are recorded separately from the preceding full
selection. Fresh live HTTPX and TypeScript client checks each passed 2 cases.

## Known gaps

- Migrations `0011` and `0012` backfill each existing order from its service at upgrade time. A
  rename or move made before they ran cannot be recovered, so those orders take the newer value.
- The exact street address of an in-person session is not part of the listing. The Career
  Professional adds it to the booking itself after confirmation (`Booking.meeting_address`), so
  editing the service never touches it.
