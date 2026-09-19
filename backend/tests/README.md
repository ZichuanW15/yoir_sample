# Backend QA scope

The current feature suite follows the 15 operations actually exposed by
`app.openapi()`: health; registration, login and logout; public service list,
detail and slots; order creation and stub payment; own service list and creation;
and own availability list, creation, update and deletion. The boundary test in
`test_contract.py` fails if the runtime operations change without a QA review.

From `backend/`, run the current implementation checks with:

```sh
uv sync --locked
env -u DATABASE_URL uv run --locked pytest -m 'not live and not future_contract'
uv run --locked ruff check tests
```

The pytest command above uses an automatically managed, disposable SQLite database.
PostgreSQL row-lock concurrency and timezone round trips are skipped there. To
run those cases, supply a dedicated PostgreSQL database whose name ends in
`_test`, set `YOIR_QA_ALLOW_DATABASE_RESET=true`, and run the same pytest selector
without `env -u DATABASE_URL`. The suite deletes rows and drops tables in that
dedicated database. It rejects ordinary database names and unsafe overrides.

`test_live_api.py` is a separate HTTP suite for a separately managed test server.
Use an explicit file selection and the `live` marker when running it; its
collection path avoids initializing the destructive in-process fixture harness.

## Known defects in implemented behavior

Current known defects remain executable strict xfails. They raise only
`KnownAcceptanceDefect` after establishing the request, response and stored state
that reproduce the named defect. Unexpected setup, authorization, persistence or
response errors fail normally. A fixed defect produces a strict XPASS failure
until its marker is reviewed. Xfails are reported separately from passing cases.

This includes real reservation/purchase defects, validation and API documentation
drift for existing operations, seed behavior, and response failures after a real
database commit. There is no claim of provider payment integration: the executed
payment operation is the implemented stub endpoint.

## Retained checks outside the current feature scope

These ten tests carry `future_contract`. They are preserved for later work and
historical traceability, but excluded from current implemented-feature results.

| Test | Reason for separate scope |
| --- | --- |
| `test_openapi_identity_operations_requirements_and_refs` | Covers all 39 published operations, including unimplemented routes. |
| `test_traceability_matches_all_openapi_operations` | Checks the full architecture traceability document. |
| `test_payment_client_secret_is_response_visible` | PaymentIntent is not a runtime operation. |
| `test_refresh_operation_defines_refresh_credential` | Refresh is not implemented. |
| `test_marketplace_contract_publishes_service_unavailable` | A historical 503 fixture is not evidence that the runtime emits that response. |
| `test_order_slot_has_database_uniqueness_invariant` | Prescribes a particular database design; actual HTTP reservation concurrency is tested using PostgreSQL row locks. |
| `test_expired_order_hold_releases_slot_for_a_new_order` | Assumes an unapproved 15-minute hold policy and remains skipped. |
| `test_default_configuration_is_safe_for_shared_environment` | Proposes deployment hardening policy beyond the local development defaults. |
| `test_manual_reset_script_validates_target_before_destructive_import` | Proposes a manual reset policy; the actual QA database safety gate is tested in the current suite. |
| `test_published_service_modality_update_requires_real_backend_persistence` | Service PATCH has no implemented backend route. |

Run the retained architecture checks separately, when relevant:

```sh
env -u DATABASE_URL uv run --locked pytest -m future_contract
```

Do not count that command as functional acceptance of implemented features or
merge its pass/xfail/skip totals into the current feature report.
