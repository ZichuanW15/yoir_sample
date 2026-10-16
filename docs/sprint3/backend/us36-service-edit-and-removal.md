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
- **Emails use the frozen title too.** The title is frozen when the order is placed, but the two
  confirmation emails are sent later, when payment confirms. `booking_received` and
  `booking_confirmed` in [`app/mail/messages.py`](../../../backend/app/mail/messages.py) read
  `order.title_for(service)`, so a rename between ordering and paying does not give the emails a
  different name from the receipt they carry.
- **Existing orders:** migration `0011` adds `orders.service_title` and fills it for every existing
  order from its service's title at upgrade time. Reading code falls back to the live title only for
  an order that has none, through `Order.title_for`.
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
| An existing order and booking still return their recorded service information | Amount, breakdown and title are frozen on the order | `test_renaming_a_service_does_not_rewrite_what_was_already_bought` (booking detail, My Bookings, the receipt and both Platform Owner views keep the original title; the receipt keeps the original amount); `test_a_rename_before_payment_does_not_change_the_confirmation_emails`; `test_existing_orders_are_backfilled_with_their_service_title` |
| Another Career Professional cannot edit or remove it | `404`, service unchanged | `test_a_counsellor_cannot_edit_or_delete_someone_elses_service`, `test_editing_a_service_needs_a_counsellor_session` |
| A rejected or failed request leaves the listing unchanged | Validation before write; rollback | `test_an_in_person_service_still_needs_a_meeting_area_when_edited` |

## Tests

- [`tests/test_counsellor.py`](../../../backend/tests/test_counsellor.py), section "US-36: editing and
  withdrawing a service": 9 tests, all named above.
- [`tests/test_migrations.py`](../../../backend/tests/test_migrations.py):
  `test_existing_orders_are_backfilled_with_their_service_title`.
- [`tests/test_diagnosis_migration.py`](../../../backend/tests/test_diagnosis_migration.py) pins the
  newest revision, now `0011`, and its downgrade test no longer expects `orders.service_title` to
  survive a downgrade below it.

Run from `backend/`:

```bash
env -u DATABASE_URL pytest tests/test_counsellor.py tests/test_migrations.py -q \
  -k "update_service or clears_a_location or still_needs_a_meeting_area_when_edited or deleting_a_service or cannot_edit_or_delete or editing_a_service_needs or renaming_a_service or rename_before_payment or backfilled_with_their_service_title"
```

Local run on `dev` at `03978fd` plus this change, 17 October 2026, Python 3.12.8, temporary SQLite
database: 10 passed. Full backend suite: 797 passed, 8 skipped, 18 expected failures.

## Known gaps

- Migration `0011` backfills each existing order with its service's title at upgrade time. A rename
  made before the migration ran cannot be recovered, so those orders take the newer name.
