# Unresolved defects in implemented behavior

These are current correctness assertions, not missing-feature checks. No application code was changed to fix them. Frontend/browser cases fail normally; backend cases are narrow strict xfails. The definitive execution evidence is linked from [test-results.md](test-results.md). Duplicate manifestations across layers are not separate defect discoveries.

## Findings requiring product review

- Booking integrity: seeded services can confirm overlapping bookings for one counsellor, elapsed slots remain bookable, and a forged confirmation URL claims success.
- Incorrect values/status: negative prices change sign, displayed prices lose cents, payment retry references drift, and profile/availability fallbacks fabricate success/data.
- Recovery and scheduling: malformed responses, empty slot feedback, booked-slot/calendar overlap, DST iteration, font failure and network-error classification need correction.
- Existing API documentation/validation: request fields, path-parameter names, status documentation and error IDs drift from runtime. Post-commit read failures return 500 after successful writes, so retry behavior needs explicit review.

Missing APIs, missing pages and unsettled policy proposals are excluded; see [scope](scope.json). A mocked profile API absence tests the existing false-success fallback only. Demo failures are demo-only and do not claim server failures.

## Backend — 19 xfailed cases (16 check groups)

Reproduce one with `cd backend` then `.venv/bin/python -m pytest tests/<file>::<test> --runxfail -v`; use the dedicated PostgreSQL fixture configuration where required. Source JSON contains the exact parameterized nodeids and actual observed behavior.

| # | Exact pytest nodeid | Actual failing boundary |
| --- | --- | --- |
| B01 | `tests/test_api.py::test_marketplace_rejects_invalid_modality` | Unknown modality should receive a validation response; current HTTP 200 returns an empty list. |
| B02 | `tests/test_api.py::test_create_order_rejects_unknown_fields` | Unknown order input must not silently create an order contrary to additionalProperties=false; current 201 persists one awaiting_payment order and a held slot, while discarding actingUserId. |
| B03 | `tests/test_api.py::test_stub_payment_retry_returns_stable_payment_reference` | Two successful payment calls must return a stable paymentId for the same paid booking; current first and repeated references differ. |
| B04 | `tests/test_contract.py::test_backend_current_paths_match_published_parameter_names` | The same 15 implemented route shapes have snake_case path parameters at runtime and camelCase in the published contract. |
| B05 | `tests/test_contract.py::test_every_implemented_protected_operation_publishes_401` | Every protected operation among runtime15 should document 401; the six implemented counsellor operations omit it. |
| B06 | `tests/test_contract.py::test_runtime_internal_error_code_is_published` | The actual backend 500 handler emits INTERNAL_ERROR, which is missing from the published Error enum. |
| B07 | `tests/test_contract.py::test_counsellor_openapi_documents_the_actual_validation_status[post-/me/services-payload0]` | An invalid input to this implemented operation returns 400 with VALIDATION_ERROR and fieldErrors, but runtime OpenAPI advertises 422 and omits 400. |
| B08 | `tests/test_contract.py::test_counsellor_openapi_documents_the_actual_validation_status[post-/me/availability-slots-payload1]` | An invalid input to this implemented operation returns 400 with VALIDATION_ERROR and fieldErrors, but runtime OpenAPI advertises 422 and omits 400. |
| B09 | `tests/test_contract.py::test_counsellor_openapi_documents_the_actual_validation_status[patch-/me/availability-slots/{slot_id}-payload2]` | An invalid input to this implemented operation returns 400 with VALIDATION_ERROR and fieldErrors, but runtime OpenAPI advertises 422 and omits 400. |
| B10 | `tests/test_seed_and_config.py::test_seed_is_safe_when_users_exist_but_services_are_empty` | Seeding a database containing an existing counsellor email should retain that user without duplicate insertion; the current seed raises a unique-constraint IntegrityError. |
| B11 | `tests/test_sprint2_acceptance_regressions.py::test_seeded_calendar_has_no_cross_service_counsellor_overlap` | A counsellor should not receive overlapping seeded slots across different services; current seed generates colliding slots. |
| B12 | `tests/test_sprint2_acceptance_regressions.py::test_seeded_slots_cannot_confirm_overlapping_bookings_for_one_counsellor` | Real order and stub-payment HTTP calls should not confirm overlapping bookings for one counsellor; current seeded slots allow them. |
| B13 | `tests/test_sprint2_acceptance_regressions.py::test_public_availability_omits_past_open_slots` | Public availability should exclude past open slots while retaining a future slot; the past slot is currently returned. |
| B14 | `tests/test_sprint2_acceptance_regressions.py::test_order_rejects_a_past_open_slot_without_holding_it` | An elapsed slot should not create an order or acquire a hold; current 201 stores an order and sets the slot to held. |
| B15 | `tests/test_sprint2_acceptance_regressions.py::test_slot_patch_does_not_silently_ignore_service_reassignment` | An unsupported serviceId change should either be rejected without mutation or persisted; current PATCH returns 200, changes time, and silently preserves the original service. |
| B16 | `tests/test_sprint2_acceptance_regressions.py::test_service_creation_rejects_unpublished_fields_instead_of_silently_dropping_them` | Unknown service request fields should not silently persist a service contrary to additionalProperties=false; current 201 discards the field and saves the service. |
| B17 | `tests/test_sprint2_acceptance_regressions.py::test_unexpected_failure_preserves_request_id_in_body_and_response_header` | An injected unexpected failure returns a safe 500 body containing the supplied requestId, but omits the matching x-request-id response header. |
| B18 | `tests/test_sprint2_acceptance_regressions.py::test_committed_booking_write_does_not_depend_on_a_second_database_read[create_order]` | A real order/payment commit succeeds, then an injected ORM response-read failure returns 500; fresh database rows prove the committed change, and retries prove its effect remains. |
| B19 | `tests/test_sprint2_acceptance_regressions.py::test_committed_booking_write_does_not_depend_on_a_second_database_read[pay_order]` | A real order/payment commit succeeds, then an injected ORM response-read failure returns 500; fresh database rows prove the committed change, and retries prove its effect remains. |

Machine catalog: [backend-defect-catalog.json](backend-defect-catalog.json). Every current xfail is `strict=True, raises=KnownAcceptanceDefect`; unexpected setup or response failures remain ordinary failures.

## Frontend — 18 ordinary failing assertions

From `frontend/`, run `npm run test:defects -- -t 'distinctive title text'`. Complete names below identify cases in the JSON result.

| # | File | Correct assertion that currently fails |
| --- | --- | --- |
| F01 | `frontend/__tests__/defects/counsellor-issue-acceptance.test.tsx` | profile save correctness at the real HTTP boundary [QA-130][US30-AC1] a missing profile backend cannot announce a durable saved profile |
| F02 | `frontend/__tests__/defects/public-acceptance.test.tsx` | known booking confirmation acceptance gaps [QA-127][DEF-CONFIRM-UNVERIFIED] a direct confirmation URL without a receipt cannot claim payment success |
| F03 | `frontend/__tests__/defects/public-acceptance.test.tsx` | known booking confirmation acceptance gaps [QA-127][DEF-CONFIRM-RECEIPT] confirmation uses the server-confirmed booking time and modality |
| F04 | `frontend/__tests__/defects/client-acceptance.test.ts` | unresolved real API boundary acceptance F06 / QA #109: null HTTP error body remains a structured response failure |
| F05 | `frontend/__tests__/defects/client-acceptance.test.ts` | unresolved real API boundary acceptance F07 / QA #109: malformed success payload cannot reach the service list as valid data |
| F06 | `frontend/__tests__/defects/client-acceptance.test.ts` | unresolved real API boundary acceptance F08 / QA #145: a real availability 404 is surfaced instead of inventing local data |
| F07 | `frontend/__tests__/defects/counsellor-acceptance.test.tsx` | Counsellor known defects — correct acceptance expectations QA #136 rejects a negative price instead of silently changing its sign |
| F08 | `frontend/__tests__/defects/counsellor-acceptance.test.tsx` | Counsellor known defects — correct acceptance expectations QA #145 reports a network failure rather than falsely claiming all new slots overlap |
| F09 | `frontend/__tests__/defects/public-issue-acceptance.test.tsx` | implemented slot picker empty-response feedback [QA-118][US40-AC4] no open slots has an explicit empty state, not an unexplained blank picker |
| F10 | `frontend/__tests__/defects/root-layout-acceptance.test.tsx` | root layout startup availability DEF-STARTUP-FONT: a font load error releases the splash and leaves a visible application or recovery screen |
| F11 | `frontend/__tests__/defects/demo-booking-acceptance.test.ts` | demo booking integrity must not teach invalid booking behaviour F09 / QA #118: an unknown demo slot cannot produce an order |
| F12 | `frontend/__tests__/defects/demo-booking-acceptance.test.ts` | demo booking integrity must not teach invalid booking behaviour F10 / QA #121: a demo order cannot reserve another service’s slot |
| F13 | `frontend/__tests__/defects/demo-booking-acceptance.test.ts` | demo booking integrity must not teach invalid booking behaviour F11 / QA #121 #145: demo availability rejects overlap across one counsellor’s services |
| F14 | `frontend/__tests__/defects/format-planner-acceptance.test.ts` | unresolved price and availability acceptance F01 / QA #115 #124: displayed AUD prices preserve the charged cents |
| F15 | `frontend/__tests__/defects/format-planner-acceptance.test.ts` | unresolved price and availability acceptance F02 / QA #145: equal endpoints are adjacent regardless of ISO millisecond precision |
| F16 | `frontend/__tests__/defects/format-planner-acceptance.test.ts` | unresolved price and availability acceptance F03 / QA #121 #145: a booked appointment still occupies the counsellor calendar |
| F17 | `frontend/__tests__/defects/format-planner-acceptance.test.ts` | unresolved price and availability acceptance F04 / QA #121 #145: another service in the same own calendar cannot overlap |
| F18 | `frontend/__tests__/defects/format-planner-acceptance.test.ts` | unresolved price and availability acceptance F05 / QA #145: weekday recurrence visits every local day once across DST end |

Machine catalog: [frontend-defect-catalog.json](frontend-defect-catalog.json). The public slot-picker case and forged-confirmation case are independently reproduced in Chromium, not added to the count as unique defects.

## Browser — 2 ordinary failing assertions

From `frontend/`, build as described in [reproduction](reproduction.md), then run `npm run test:web:defects`.

| Selector | Expected / observed |
| --- | --- |
| `QA-118` | Actual empty availability disables Continue but leaves an unexplained empty picker. |
| `US68 forged anonymous` | Anonymous forged confirmation URL should not claim success; currently renders the booking-success heading without a receipt. |

Screenshots, error context and traces are retained with the latest browser evidence. Fixes should make the corresponding assertion pass; then review markers/catalogs and refresh this report. No check has been weakened to accept the bad outcome.
