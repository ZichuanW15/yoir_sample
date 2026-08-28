# Sprint 1 Test Results

## Execution identity

| Field | Value |
|---|---|
| Test date/time | 2026-08-28 23:08:42 AEST |
| Operating system | macOS 26.4.1, Build 25E253, arm64 |
| Node.js / npm | 20.20.2 / 10.8.2 |
| Python / pip | 3.12.13 / 25.0.1, isolated `backend/.venv` |
| PostgreSQL | Homebrew PostgreSQL 16.15, local service running |
| Branch | `qa/sprint1-latest-evidence` |
| Authoritative product source | `cdfc257be9121e1141689fa8e69fcb8d3ca41a0e` |
| Tested QA code | `5b4ddd812c313424567fd646f90a9f1621beab9e` |
| Test implementation commit | `1dd3bb12fe59e572e723f31cfb04596ac344f36d` |
| CI/metadata commit | `5b4ddd812c313424567fd646f90a9f1621beab9e` |
| Hosted CI | Not Run: local branch was not pushed |

The owner explicitly selected `origin/exe-archi-backend` as the authoritative source for both the
frontend and backend product tree. The previously committed database safety change
`c0c4960f0693a9c410f7cc0c0a87e9fec69839e3` remains intact on
`qa/sprint1-test-evidence`; its QA-only behaviour was ported and expanded here.

No production file under `app/`, `src/` or `backend/app/` differs from `cdfc257`.

## Actual command results

| Command/check | Actual result | Status | Evidence boundary |
|---|---|---|---|
| `npm ci` | 1,091 packages installed from `package-lock.json` | Pass | Reproducible install only |
| `npm run lint` | Exit 0 | Pass | Frontend and QA TypeScript lint |
| `npm run typecheck` | Exit 0 | Pass | TypeScript compile-time checking |
| `npm run test:ci` | 10/10 suites; 58 passed; 22 todo | Pass for 58 executable tests | Mock/stub frontend boundaries |
| `npm run test:coverage` | 10/10 suites; 58 passed; 22 todo | Pass | Descriptive coverage; no invented threshold |
| Frontend coverage | 96.09% statements; 88.83% branches; 97.29% functions; 100% lines | Recorded | Instrumented Jest source set |
| Expo Web export | One 1.03 MB bundle; nine static routes | Pass | Web build smoke, not native acceptance |
| Full `npm audit` | 20 findings: 11 moderate, 9 high, 0 critical | Fail / owner action | Includes development dependencies |
| Production-only `npm audit` | 19 findings: 10 moderate, 9 high, 0 critical | Fail / owner action | Upgrade guidance requires Expo 57 major change |
| Python compile | All `backend/app` modules compile | Pass | Syntax only |
| QA Ruff | `backend/tests` and `backend/pyproject.toml` clean | Pass | QA-owned Python |
| Production Ruff | 9 findings: 6 E501, 2 B008, 1 I001 | Fail / owner action | Production was not changed by QA |
| SQLite pytest | 78 collected: 60 passed, 16 xfailed, 2 skipped | Pass with known XFail/Skip | Temporary QA-owned SQLite |
| PostgreSQL pytest | 78 collected: 61 passed, 16 xfailed, 1 skipped | Pass with known XFail/Skip | Local PostgreSQL `yoir_test` |
| PostgreSQL concurrency | Two simultaneous orders: one 201, one 409, one stored Order | Pass | Real row-lock behaviour on PostgreSQL 16.15 |
| Live Uvicorn/HTTPX | Full current flow; 1 passed | Pass | Real socket and isolated `yoir_live_test` |
| Live fixture isolation | Data remained: 5 users, 7 services, 1 order, 1 booking; health remained 200 | Pass | No pytest reset/drop of live database |
| OpenAPI/traceability | 36 operations; exact 36-row semantic parity | Pass | Published contract structure |
| OpenAPI local refs | 35 unique local refs resolved | Pass | Published contract structure |
| Markdown/workflow/JSON | 7 relative links, 0 broken; YAML and seed JSON parsed | Pass | Repository metadata |
| Product ownership check | `app`, `src`, `backend/app` equal `cdfc257` | Pass | No QA product changes |

`npm audit fix --force` was not run. Its reported repair path changes the Expo SDK major version and
would be an unreviewed production dependency migration, outside QA authority.

The backend runs with open-ended lower dependency bounds. The isolated environment resolved
FastAPI 0.141.1, SQLAlchemy 2.0.52 and other current packages, so this result does not replace a
reviewed backend lock strategy.

## Frontend executable result

### Passed: 58

The ten suites execute:

- API client methods, URLs, request bodies, URL encoding and error conversion;
- Bearer authentication for order creation and stub payment;
- demo register/login/services/slots/order/payment flow;
- AuthContext login failure/success and local logout;
- login and registration preservation of a booking `serviceId`;
- Marketplace loading, data, empty, search, error, retry and navigation states;
- service detail rendering and anonymous/Job Seeker/Counsellor booking behaviour;
- time-slot loading, selection, order, payment failure and confirmation navigation;
- confirmation rendering and return to Marketplace;
- router registration of booking screens and disabled confirmation back navigation.

### Todo: 22, not counted Pass

| Area | Unimplemented or unresolved boundary |
|---|---|
| API client | Valid-JSON `null` error fallback, runtime response validation, timeout/abort, production URL fail-fast |
| Login | Invalid/non-scalar `serviceId`; non-Job-Seeker booking continuation |
| Register | Counsellor registration with pending booking intent; invalid/non-scalar `serviceId` |
| Marketplace | Stale response prevention for overlapping searches |
| Service detail | Missing-parameter loading recovery; stale data after a failed ID change |
| Timeslots | Deep-link role protection; modality choice; user timezone; preserved payment error; missing-parameter recovery |
| Confirmation | Required parameter validation; malformed time handling; trusted server-side confirmation data |
| Session | Expiry handling; persistence across restart; server-side logout invalidation |

These Todos document product work. They are not disabled tests that would otherwise pass.

## Backend executable result

### SQLite: 60 passed, 16 strict XFail, 2 Skip

The SQLite suite passed all database-independent behaviour. It skipped:

1. PostgreSQL row-lock concurrency, because SQLite cannot provide that evidence.
2. The opt-in live test, because `LIVE_API_BASE_URL` was intentionally absent.

### PostgreSQL: 61 passed, 16 strict XFail, 1 Skip

The same suite ran on the dedicated `yoir_test` database with
`YOIR_QA_ALLOW_DATABASE_RESET=true`. The PostgreSQL-only concurrency test issued two simultaneous
`POST /orders` requests for one slot. It observed exactly one `201`, one `409 SLOT_UNAVAILABLE`, one
persisted order and a held slot.

The normal run skipped only the opt-in live test. That test then ran separately against Uvicorn and
the isolated `yoir_live_test` database.

### Live HTTP: 1 passed

The black-box flow executed:

```text
health -> register -> login -> list services -> service detail -> list slots
       -> create order with Bearer token -> complete stub payment
```

All eight requests returned the expected success status. After the live-only pytest process exited,
the Uvicorn server still returned health 200 and its database still contained seed and transaction
data. This is direct evidence that the live-only selection did not initialise the destructive local
fixture or run `drop_all()`.

## Strict XFail: 16, not counted Pass

| XFail | Current defect |
|---|---|
| Register unknown fields | `additionalProperties: false` is not enforced |
| Register uniqueness race | Commit-time `IntegrityError` is not converted to contract-shaped 409 |
| Malformed password hash | Invalid Argon2 data becomes 500 rather than generic 401 |
| Marketplace modality | Arbitrary query modality is accepted |
| Create-order unknown fields | Extra request properties are ignored |
| Order slot invariant | `orders.slot_id` has no database UNIQUE constraint/index |
| Hold expiry | Documented 15-minute expiry/release is absent |
| Stub payment reference | First and repeated calls return different payment IDs |
| Runtime path names | FastAPI uses snake_case while OpenAPI uses camelCase |
| Protected-operation 401 | Some protected contract operations omit 401 |
| Payment secret schema | Response `clientSecret` is marked `writeOnly` |
| Refresh credential | Refresh operation defines no request/cookie credential |
| Error enum | Known runtime/frontend codes are absent from the contract enum |
| Marketplace 503 | Frontend handles a 503 not published by `GET /services` |
| Partial seed state | Existing users plus empty services can duplicate counsellor emails |
| Default configuration | Insecure JWT, wildcard CORS and automatic seed are enabled by default |

One Starlette TestClient deprecation warning was emitted by the resolved newest dependency set. It
does not change the results, but it is another reason to lock and review backend runtime versions.

## Contract and repository evidence

The checker no longer hard-codes the older 35-operation/5-route baseline. It now verifies:

- OpenAPI 3.0.3 and unique, non-empty operation IDs;
- requirement IDs for every published operation;
- all 35 unique local references resolve;
- required CSV fields, unique rows and populated actor/verification values;
- exact 36-operation OpenAPI/CSV parity;
- runtime routes are a contract subset;
- the declared executable boundary is exactly the current eight operation IDs;
- workflow YAML, seed JSON and relative Markdown links.

The contract still describes target capabilities beyond the eight runtime operations. Those rows
remain Planned/Blocked and are not counted as executed backend coverage.

## CI status

The Application CI workflow defines:

1. npm install, lint, typecheck, Jest coverage and Expo Web export;
2. backend Ruff and pytest against PostgreSQL 16;
3. an isolated `yoir_live_test` database for Uvicorn and live HTTP;
4. contract, traceability, links, YAML, JSON and whitespace checks.

The live server and destructive in-process suite no longer share one database. Production backend
Ruff remains a visible non-blocking audit and is explicitly reported as a known failure.

This workflow parsed locally, but hosted Application CI is **Not Run** because the branch has not
been pushed. A local success cannot be presented as a GitHub Actions success.

## Installed local PostgreSQL

PostgreSQL 16.15 was installed through Homebrew and started as
`homebrew.mxcl.postgresql@16`. The following dedicated local objects were created:

- role `yoir`;
- database `yoir_test` for the destructive in-process suite;
- database `yoir_live_test` for the separately managed Uvicorn server.

The test safety gate rejects non-test database names and requires the explicit reset flag. No other
database was modified.

## Remaining owner actions

### Product owners

- Resolve the 16 strict XFail defects, especially the order-slot database invariant, hold expiry,
  registration race, malformed hash and payment reference stability.
- Decide and implement modality/timezone selection and direct deep-link role behaviour.
- Validate confirmation parameters or load authoritative confirmation data from the backend.
- Add migrations instead of relying on `create_all()`.

### Dependency owners

- Review the 20 npm advisories and plan a compatible Expo SDK upgrade rather than applying a forced
  major update in QA.
- Lock backend runtime dependencies and address the TestClient deprecation.
- Fix the nine production Ruff findings in `backend/app`.

### Integration owners

- Review the decision that `exe-archi-backend` is authoritative for both frontend and backend.
- Synchronise the intended target branch before opening a PR.
- Push and require hosted CI success for the exact reviewed commit.
- Do not create a release tag while XFail/Todo, dependency and hosted-CI boundaries remain open.

## Overall conclusion

The selected `cdfc257` product tree now has comprehensive, reproducible local QA evidence. Frontend,
SQLite, PostgreSQL concurrency and full live HTTP tests all execute successfully within their stated
boundaries. The new local branch is ready for code review as QA evidence.

It is not a perfect product, a release candidate or hosted-CI Pass: 16 strict XFail defects, 22
frontend Todos, 20 npm audit findings, nine production Ruff findings and the absence of a hosted run
remain explicit.

See [`test-approach.md`](test-approach.md) for scope, safety rules and reproduction commands.
