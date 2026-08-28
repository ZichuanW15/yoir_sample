# Sprint 1 Test Approach

## 1. Purpose

This document defines the QA approach for the latest Sprint 1 executable slice. It separates
executable evidence from target architecture, records known product defects without weakening
assertions, and prevents test setup from resetting an unintended database.

QA changes are limited to tests, test tooling, CI and QA evidence. Production files under `app/`,
`src/` and `backend/app/` are not changed by this QA slice.

## 2. Authoritative baseline

The repository owner explicitly selected the backend member branch as the authoritative source for
the complete product tree, including the frontend code present on that branch.

| Purpose | Exact source |
|---|---|
| Product baseline: frontend and backend | `origin/exe-archi-backend@cdfc257be9121e1141689fa8e69fcb8d3ca41a0e` |
| Previously committed QA safety work | `qa/sprint1-test-evidence@c0c4960f0693a9c410f7cc0c0a87e9fec69839e3` |
| New integration branch | `qa/sprint1-latest-evidence` based directly on `cdfc257` |

The earlier QA commit remains intact on its original branch. Its QA-only database protections and
test infrastructure are ported to the new branch and then updated for the eight-operation product
slice. No whole-branch merge is used, so older production files cannot overwrite the selected
baseline.

At the fetch used to establish this baseline, the other relevant refs were:

- `origin/feature/executable-architecture-frontend@c4e1201ee376849453d3e16b06950451c1dabffa`
- `origin/main@6afac98a5a4e3112cf0a81e7fac95e13f020764f`
- `origin/dev@14ac27d21edfb1bbe15e5df0efe54f7b1e159ce3`
- `origin/docs/db-schema@78d2e660ed2eea319cb2b03610d41f8ccf0cfefa`
- `origin/qa/sprint1-test-evidence@3315e8d83c05d7eec9bb8bbcf264afb1ebe247a7`

These refs are recorded for traceability; they are not mixed into the product baseline.

## 3. Evidence classifications

| Classification | Meaning |
|---|---|
| Pass | The stated command or assertion executed successfully on the identified baseline |
| Fail | The check executed and found an unexpected problem |
| XFail | A strict executable test reproduced a known product or contract defect; not Pass |
| Todo | A named test boundary is retained but cannot yet execute meaningfully |
| Blocked | A required environment, implementation or owner decision is absent |
| Planned | The capability exists only in the published target contract or architecture |
| Not Run | No execution evidence exists for the exact tested commit and environment |

A strict XFail must fail for the documented reason. If it unexpectedly passes, pytest fails so the
expectation is reviewed rather than silently becoming stale.

## 4. Implemented product inventory

### Frontend

The selected product baseline includes:

- registration and login, including preservation of an optional booking `serviceId`;
- Marketplace list/search and service detail;
- unauthenticated booking continuation through login or registration;
- service time-slot selection;
- bearer-authenticated order creation and stub payment;
- booking confirmation;
- API client methods for register, login, services, slots, orders and stub payment.

The payment screen is explicitly a development stub. It is not Stripe, a real payment, a webhook
or evidence of the target payment architecture.

### Backend runtime

The selected backend exposes eight runtime operations:

1. `GET /api/v1/health`
2. `POST /api/v1/auth/users`
3. `POST /api/v1/auth/sessions`
4. `GET /api/v1/services`
5. `GET /api/v1/services/{service_id}`
6. `GET /api/v1/services/{service_id}/slots`
7. `POST /api/v1/orders`
8. `POST /api/v1/orders/{order_id}/payments/stub`

The backend includes JWT verification, Job Seeker role enforcement, order ownership enforcement,
row locking of a selected slot, and persistence for users, services, availability slots, orders and
bookings. It still uses SQLAlchemy `create_all()` rather than reviewed migrations.

### Published contract boundary

The OpenAPI document publishes 36 operations and 35 unique local component references. The
traceability CSV contains one row per operation. Runtime routes must be a documented subset, while
the eight implemented operation IDs are asserted explicitly. The remaining published operations
are Planned or Blocked, not executable Passes.

## 5. Test levels

| Level | Boundary | Local evidence |
|---|---|---|
| Static | ESLint, TypeScript, Ruff, Python compile, YAML, JSON and whitespace | Executed |
| Frontend unit | API client and authentication state | Mocked `fetch` or API response |
| Frontend component | Screen to client/AuthContext/router and rendered state | Stubbed external boundary |
| Backend API | HTTP route to schema, security and SQLAlchemy | SQLite and PostgreSQL |
| Contract | OpenAPI, traceability CSV and runtime route boundary | Executed |
| Live HTTP | Separate Uvicorn process and full eight-operation journey | Isolated PostgreSQL database |
| Hosted CI | GitHub Actions on an exact pushed commit | Not evidence until pushed and successful |
| Native device/E2E | Built native app to deployed backend | Blocked |
| Real payment | Provider intent, webhook and settlement | Blocked; stub only |

Frontend component tests do not prove backend behaviour. FastAPI TestClient tests do not prove a
real network boundary. SQLite results are never reported as PostgreSQL results.

## 6. Database safety and isolation

Database reset validation runs before importing `app.db` or creating the SQLAlchemy engine.

- SQLite is allowed only when QA created the exact temporary database file for that run.
- PostgreSQL is allowed only when the path database is exactly `yoir_test` or ends in `_test`.
- PostgreSQL reset additionally requires `YOIR_QA_ALLOW_DATABASE_RESET=true`.
- `dbname=` and `database=` query overrides are rejected so the path check cannot be bypassed.
- Validation errors do not echo the URL, username or password.
- Cleanup follows foreign-key order: bookings, orders, availability slots, services, users.

The normal local PostgreSQL suite uses `yoir_test`. The live Uvicorn smoke uses a separate
`yoir_live_test`. A live-only pytest selection does not import the product database module, start
the destructive fixture harness or run `drop_all()`. This prevents the earlier failure mode where
pytest cleared the seed data used by a simultaneously running server.

## 7. Frontend coverage goals

Executable tests cover:

- request methods, URLs, JSON bodies, encoded identifiers and structured errors;
- Bearer headers for order and payment methods;
- login and registration booking-intent continuation;
- both public registration roles and validation/error states;
- Marketplace load, empty, search, retry and navigation states;
- service detail and role-aware booking CTA behaviour;
- slot load, selection, order creation, stub payment and confirmation navigation;
- confirmation rendering and Marketplace navigation;
- AuthContext success, failure and local logout.

Known product behaviour is not rewritten by QA. Where a desired behaviour is absent or ambiguous,
the test is a Todo or defect report rather than a fabricated Pass. Examples include runtime response
schema validation, cancellation/timeouts, durable session storage, direct deep-link role handling,
modality choice, dynamic timezone selection and confirmation parameter validation.

## 8. Backend coverage goals

Executable tests cover:

- health and request correlation IDs;
- register/login validation, normalisation, generic credential failures and JWT expiry;
- public service list/detail and open slot ordering/filtering;
- bearer authentication failures and valid identity resolution;
- Job Seeker role enforcement;
- order service/slot/modality validation and slot state transition;
- order ownership enforcement;
- successful and repeated stub payment behaviour;
- booking persistence and copied service/slot facts;
- schema constraints relevant to booking integrity;
- seed and configuration safety;
- the complete live HTTP journey.

PostgreSQL is used for database-specific evidence, including row-lock/concurrency behaviour where
the test implementation can exercise it. The absence of a database uniqueness invariant on
`orders.slot_id` remains visible and cannot be inferred away from a passing happy-path test.

## 9. Contract and repository checks

The metadata checker and contract tests verify semantics instead of old fixed totals:

- OpenAPI version and parseability;
- non-empty, unique operation IDs;
- requirement IDs on every operation;
- resolution of every local `$ref`;
- required traceability columns and non-empty actor/verification fields;
- exact OpenAPI-to-CSV operation/method/path/requirement parity;
- runtime routes are a published subset;
- the declared implemented boundary is exactly the current eight operations;
- workflow YAML and seed JSON parse;
- repository-relative Markdown links resolve.

Known semantic drift, such as snake_case runtime path parameters versus camelCase contract
parameters, stays in reviewed strict XFail tests.

## 10. CI approach

Application CI has three jobs:

1. frontend install, lint, typecheck, Jest coverage and Expo Web export;
2. backend QA against PostgreSQL 16 plus a live HTTP smoke on an isolated database;
3. OpenAPI, traceability, Markdown, YAML, JSON and whitespace validation.

Production backend Ruff is a visible non-blocking audit because this QA branch is not authorised to
change `backend/app/**`. A failing production lint audit is recorded as Fail/owner action, never
counted as Pass.

Workflow configuration is not hosted evidence. Hosted status remains Not Run until this branch is
pushed and GitHub Actions succeeds for the exact commit.

## 11. Exit criteria

This QA slice is ready for local review only when:

- product directories still match `cdfc257` byte-for-byte;
- frontend lint, typecheck and all implemented Jest tests pass;
- backend QA Ruff passes;
- SQLite and PostgreSQL pytest runs pass except reviewed strict XFail and explicit Skip;
- live HTTP completes the current booking/stub-payment journey on isolated PostgreSQL;
- contract and repository metadata checks pass;
- Expo Web export succeeds;
- coverage and security findings are recorded without invented thresholds;
- every result identifies the exact baseline, branch and environment.

It is not a release or hosted QA candidate until the branch is pushed, reviewed, integrated with the
team's chosen target branch, and hosted CI succeeds for the exact commit.

## 12. Reproduction commands

Frontend, from the repository root:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:ci
npm run test:coverage
npx expo export --platform web --output-dir dist/qa-web-smoke
npm audit
```

SQLite fallback, from `backend/`:

```bash
.venv/bin/python -m pip install -r requirements-test.txt
.venv/bin/ruff check tests pyproject.toml
.venv/bin/pytest tests
```

PostgreSQL 16, using only the dedicated QA database:

```bash
DATABASE_URL=postgresql+psycopg://yoir:yoir@127.0.0.1:5432/yoir_test \
YOIR_QA_ALLOW_DATABASE_RESET=true \
.venv/bin/pytest tests
```

Repository evidence, from the root:

```bash
backend/.venv/bin/python scripts/check_repository_metadata.py
git diff --check
```

Never point these fixtures at a shared or production database. Never report a local SQLite result as
PostgreSQL or a configured workflow as hosted CI evidence.
