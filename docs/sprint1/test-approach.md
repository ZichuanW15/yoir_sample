# Sprint 1 Test Approach

## 1. Purpose

This document defines the QA approach for the latest Sprint 1 executable slice. It separates
executable evidence from target architecture, records known product defects without weakening
assertions, and prevents test setup from resetting an unintended database.

The QA owner is Zhenyang Zhou (QA Lead). QA changes are limited to tests, test tooling, CI,
automation and evidence. Product behaviour is not changed to manufacture a passing result. The
only permitted production delta in this slice is separately reviewed, behaviour-preserving Ruff
formatting/import cleanup; any semantic product change requires its owner.

## 2. Authoritative baseline

The repository owner explicitly selected the backend member branch as the authoritative source for
the complete product tree, including the frontend code present on that branch.

| Purpose | Exact source |
|---|---|
| Product baseline: frontend and backend | `origin/exe-archi-backend@f20192f02cf4d3eb968e131cf940422eefaebc06` |
| Previously committed QA safety work | `qa/sprint1-test-evidence@c0c4960f0693a9c410f7cc0c0a87e9fec69839e3` |
| QA integration starting point | `qa/sprint1-latest-evidence@ab64d8a34d1a5d7fb446fecbe53dc9b02d2764b8` |
| Locally validated QA implementation | `qa/sprint1-latest-evidence@e9b743c76fef0c580cf87e3b7013c6fbefbdd15c` |
| Latest product merge in QA only | `4525881d57653a022ca0fd3f097daad21079e171` |
| New integration branch | `qa/sprint1-latest-evidence`; no other branch receives this integration |

The earlier QA commit remains intact on its original branch. Its QA-only database protections and
test infrastructure were ported without older production files. When the authoritative backend ref
advanced during final verification, `f20192f` was merged only into the QA integration branch, then
the affected tests and CI were refreshed. No QA commit was merged into a product branch.

At the fetch used to establish this baseline, the other relevant refs were:

- `origin/feature/executable-architecture-frontend@c4e1201ee376849453d3e16b06950451c1dabffa`
- `origin/main@6afac98a5a4e3112cf0a81e7fac95e13f020764f`
- `origin/dev@14ac27d21edfb1bbe15e5df0efe54f7b1e159ce3`
- `origin/docs/db-schema@78d2e660ed2eea319cb2b03610d41f8ccf0cfefa`
- `origin/qa/sprint1-test-evidence@3315e8d83c05d7eec9bb8bbcf264afb1ebe247a7`

These refs are recorded for traceability; they are not mixed into the product baseline.

All integration work is confined to `qa/sprint1-latest-evidence`. Nothing in this QA activity is
merged into `main`, `dev`, `exe-archi-backend` or the frontend member branch, and no release tag is
created.

## 3. Evidence classifications

| Classification | Meaning |
|---|---|
| Pass | The stated command or assertion executed successfully on the identified baseline |
| Fail | The check executed and found an unexpected problem |
| strict XFail | A strict executable test reproduced a known product or contract defect; not Pass |
| Todo | A named test boundary is retained but cannot yet execute meaningfully |
| Skip | An executable test was intentionally not run because its declared environment/precondition was absent; not Pass |
| Blocked | A required environment, implementation or owner decision is absent |
| Planned | The capability exists only in the published target contract or architecture |
| Not Run | No execution evidence exists for the exact tested commit and environment |

A strict XFail must fail for the documented reason. If it unexpectedly passes, pytest fails so the
expectation is reviewed rather than silently becoming stale.

## 4. Entry criteria and risk-based test pyramid

Work enters this QA slice only when the authoritative product ref resolves to an exact commit, the
isolated QA worktree is clean, the product tree can be compared to that commit, and destructive
database targets pass the pre-import safety check. The OpenAPI document, traceability CSV and seed
data must parse before their behaviour is used as a test oracle. A live run additionally requires a
dedicated reachable PostgreSQL 16 database, a separately managed Uvicorn process and an explicit
`LIVE_API_BASE_URL`.

The suite uses many deterministic unit/component tests, fewer in-process API/contract tests, and a
small number of expensive real-network/PostgreSQL journeys. This pyramid gives fast diagnostic
feedback for UI states and request construction while reserving PostgreSQL and Uvicorn for locking,
persistence, authentication headers and process-boundary risks that mocks cannot prove. Mocks stop
at the frontend API/router boundary; they never count as backend or deployment evidence. The payment
adapter is a product stub and is labelled as such at every level.

## 5. Implemented product inventory

### Frontend

The selected product baseline includes:

- registration and login, including preservation of an optional booking `serviceId`;
- post-login and direct-route booking gates that permit only Job Seekers;
- Marketplace list/search and service detail;
- unauthenticated booking continuation through login or registration;
- service time-slot selection;
- bearer-authenticated order creation and stub payment;
- booking confirmation;
- API client methods for register, login, services, slots, orders and stub payment.

The payment screen is explicitly a development stub. It is not Stripe, a real payment, a webhook
or evidence of the target payment architecture.

The typed client is handwritten. The design-by-concept document describes an
`openapi-typescript`-generated client, so generation and a generated-client drift gate remain an
`ARCHITECTURE_CONFORMANCE_GAP`. Authentication is held only in React state: refresh, durable
session storage, expiry handling and server-side logout invalidation are not implemented.

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

The handwritten frontend client exposes seven product methods: register, login, service list,
service detail, slot list, order creation and stub payment. It has no health method. Health is
therefore exercised by backend and HTTPX live checks, while the real TypeScript client exercises all
seven methods it actually implements; this is not described as client coverage of eight methods.

The backend includes JWT verification, Job Seeker role enforcement, order ownership enforcement,
row locking of a selected slot, and persistence for users, services, availability slots, orders and
bookings. Seed data now includes two Job Seekers as well as four counsellors. The backend still uses
SQLAlchemy `create_all()` rather than reviewed migrations.

### Published contract boundary

The OpenAPI document publishes 36 operations and 35 unique local component references. The
traceability CSV contains one row per operation. Runtime routes must be a documented subset, while
the eight implemented operation IDs are asserted explicitly. The remaining published operations
are Planned or Blocked, not executable Passes.

## 6. Test levels

| Level | Boundary | Local evidence |
|---|---|---|
| Static | ESLint, TypeScript, Ruff, Python compile, YAML, JSON and whitespace | Executed |
| Frontend unit | API client and authentication state | Mocked `fetch` or API response |
| Frontend component | Screen to client/AuthContext/router and rendered state | Stubbed external boundary |
| Backend API | HTTP route to schema, security and SQLAlchemy | SQLite and PostgreSQL |
| Contract | OpenAPI, traceability CSV and runtime route boundary | Executed |
| Live HTTP | Separate Uvicorn process and full eight-operation journey | Isolated PostgreSQL database |
| Cross-stack client | Real `src/api/client.ts` over `fetch` to Uvicorn | Opt-in, isolated PostgreSQL; never mocked |
| Hosted CI | GitHub Actions on an exact pushed commit | Not evidence until pushed and successful |
| Native device/E2E | Built native app to deployed backend | Blocked |
| Real payment | Provider intent, webhook and settlement | Blocked; stub only |

Frontend component tests do not prove backend behaviour. FastAPI TestClient tests do not prove a
real network boundary. The real TypeScript-client test proves the HTTP client/server contract, but
not an Expo screen or native simulator. SQLite results are never reported as PostgreSQL results.

## 7. Database safety and isolation

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

## 8. Frontend coverage goals

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
schema validation, cancellation/timeouts, durable session storage, modality choice, dynamic
timezone selection and confirmation parameter validation.

Server-side logout (`DELETE /auth/sessions/current`) and refresh-token operations exist only in the
target contract. Local logout clears React state but does not invalidate the issued stateless JWT.

Jest instruments all JavaScript/TypeScript under `app/**` and `src/**` and enforces non-regression
minimums of 90% statements, 80% branches, 90% functions and 90% lines. The live client suite remains
in the normal collection as an explicit environment Skip, and the dedicated live command fails fast
when `LIVE_API_BASE_URL` is absent.

## 9. Backend coverage goals

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

## 10. Contract and repository checks

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

## 11. Requirements and architecture conformance

| Requirement / architecture quality | Implemented boundary | Executable evidence | Classification |
|---|---|---|---|
| `US-01`–`US-04` registration | Job Seeker and Counsellor registration | frontend component/client and backend API tests | Implemented |
| `US-06`, `US-07` login safety | JWT login and generic invalid-credential response | AuthContext/client/backend/live tests | Implemented |
| `US-08` logout/session control | local React-state logout only | local logout test; server invalidation/refresh/persistence Todo | Partial / gap |
| `US-40`, `US-41`, `US-47` booking | slots, authenticated order and row lock | screen/client/API/PostgreSQL concurrency/live tests | Implemented with strict invariant/expiry XFail |
| `US-68` confirmation | backend payment stub and confirmation response | frontend, backend and live tests | Stub boundary only |
| API contract | published OpenAPI and traceability CSV | semantic parity, refs and runtime-subset checks | Published target plus eight runtime operations |
| Generated TypeScript client | handwritten typed client | real-client live test exercises current code | Architecture conformance gap |
| PostgreSQL integrity | row locking on an open slot | real PostgreSQL two-request test | Behaviour observed; `orders.slot_id` UNIQUE invariant absent |
| Persistence evolution | SQLAlchemy `create_all()` | schema tests | Alembic migrations blocked |
| Native delivery | Expo Web export only | build smoke | Native simulator/device and deployed acceptance blocked |

The target architecture also names the following cross-cutting and executable-architecture
acceptance scenarios. “Blocked” here means the target behaviour is not implemented or the required
environment was not exercised; it is not a test Pass.

| ID | Target claim | Current evidence | Classification |
|---|---|---|---|
| `NFR-01` | Critical journeys are clear without guidance | component states and English navigation copy | Partial; no moderated usability session |
| `NFR-02` | Every in-scope platform supports every journey | Web export and process health only | Blocked: no iOS/Android device matrix |
| `NFR-03` | Touch and accessibility-service support | accessible labels/component assertions | Partial; no screen-reader/manual device run |
| `NFR-04` | Password, token, payment and role protection | Argon2/JWT/RBAC/Bearer tests; no card fields | Partial: refresh/revocation and provider payment absent |
| `NFR-05` | Public APIs expose only public data | service schema and ownership/RBAC tests | Implemented for the eight-operation runtime subset |
| `NFR-06` | Consistent state, no double-booking/false success | PostgreSQL concurrency and payment-state tests | Partial: row lock passes; UNIQUE invariant/idempotent reference/expiry absent |
| `NFR-07` | Stable IDs trace to evidence | OpenAPI/CSV parity, requirement IDs and runtime subset | Implemented for repository metadata |
| `NFR-08` | All system copy is English | source/component review | Partial; no complete manual native-content audit |
| `EA-00` | Deployed simulator → FastAPI/PostgreSQL walking skeleton | local real client → Uvicorn/PostgreSQL | Partial: local client boundary only; no deployed simulator |
| `EA-01` | Complete seeded booking/stub-payment path | HTTPX and TypeScript-client live journeys | Implemented locally with payment stub |
| `EA-02` | Concurrent slot protection | two PostgreSQL requests: one 201 and one 409 | Behaviour Pass; database UNIQUE invariant strict XFail |
| `EA-03` | Safe payment failure and no card leakage | stub transition/error tests; no card collection | Partial: no sandbox provider or webhook |
| `EA-04` | Booking/conversation ownership | current order/payment ownership tests | Partial: booking read/conversation runtime absent |
| `EA-05` | Closed conversation history/send rejection | published contract only | Planned / Blocked |
| `EA-06` | One verified review with aggregate update | published contract only | Planned / Blocked |

The architecture conformance source is the fetched repository documentation at
`origin/main@6afac98a5a4e3112cf0a81e7fac95e13f020764f`, especially
`docs/sprint1/design-by-concept/design-by-concept.md`. The runtime inventory is derived independently
from FastAPI's generated routes at the authoritative product SHA. A diagram or OpenAPI row is not
treated as runtime implementation.

## 12. CI approach

Application CI has four evidence boundaries:

1. frontend install, lint, typecheck, Jest coverage and Expo Web export;
2. backend compile, Ruff, coverage and QA against PostgreSQL 16;
3. live HTTP plus the real TypeScript client against an isolated PostgreSQL database;
4. OpenAPI, traceability, Markdown, YAML, JSON, Board Insights tests and whitespace validation.

Production and QA Ruff are blocking. Existing production findings may be fixed only through a
separate behaviour-preserving style change; rules are not disabled and failures are not hidden with
`continue-on-error`.

The frontend job uses the Jest thresholds above and publishes coverage plus machine-readable test
results. Dependency audit findings are always preserved as JSON; production critical findings block
the job, while lower-severity findings remain explicit owner work rather than being force-fixed. The
repository job uses checksum-verified `actionlint` in addition to semantic metadata checks.

Workflow configuration is not hosted evidence. Hosted status remains Not Run until this branch is
pushed and GitHub Actions succeeds for the exact commit.

## 13. Known product, architecture, dependency and environment gaps

- Product: the reviewed strict XFail/Todo catalogue includes the missing slot UNIQUE invariant,
  hold expiry, stable repeated-payment reference, response validation, dynamic modality/timezone,
  durable session/refresh/server logout and confirmation validation. The new manual `reset_db.py`
  imports the product engine and calls `drop_all()` without the QA database-name/reset-opt-in guard;
  its safety requirement remains a strict XFail and the script must not target shared data.
- Architecture: the client is handwritten, payment is a stub, persistence uses `create_all()`, and
  most of the 36-operation target contract has no runtime route.
- Dependencies: QA tools are pinned, but `backend/requirements.txt` uses open lower bounds. A clean
  hosted install can resolve newer FastAPI/SQLAlchemy/transitive versions until product owners adopt
  a reviewed lock strategy. npm advisories require a compatible Expo upgrade decision; QA never
  applies a forced major update.
- Environment: Web export and local PostgreSQL/Uvicorn are not native iOS/Android simulator tests or
  deployed-environment acceptance. Hosted CI, Wiki publication and board access are separate evidence
  and require exact remote runs and credentials.

## 14. Exit criteria

This QA slice is ready for local review only when:

- product behaviour remains that of `f20192f`, with any style-only delta separately listed;
- frontend lint, typecheck and all implemented Jest tests pass;
- backend QA Ruff passes;
- SQLite and PostgreSQL pytest runs pass except reviewed strict XFail and explicit Skip;
- live HTTP completes the current booking/stub-payment journey on isolated PostgreSQL;
- the real TypeScript client completes the same server boundary without mocked `fetch`;
- contract and repository metadata checks pass;
- Expo Web export succeeds;
- coverage and security findings are recorded without invented thresholds;
- every result identifies the exact baseline, branch and environment.

It is not a release or hosted QA candidate until the branch is pushed, reviewed, integrated with the
QA remote, and hosted CI succeeds for the exact commit. This task does not merge the QA branch into
another product or integration branch.

## 15. Clean-clone reproduction

Prerequisites are Node.js 20.20.2, npm 10.8.2, Python 3.12 and PostgreSQL 16. A container is the
safest clean-clone PostgreSQL option because it cannot point at an existing developer database:

```bash
docker run --name yoir-qa-postgres --detach --rm \
  --env POSTGRES_USER=yoir \
  --env POSTGRES_PASSWORD=yoir \
  --env POSTGRES_DB=yoir_test \
  --health-cmd='pg_isready -U yoir -d yoir_test' \
  --health-interval=2s \
  --health-timeout=5s \
  --health-retries=30 \
  --publish 5432:5432 \
  postgres:16.15-bookworm
for attempt in $(seq 1 60); do
  [ "$(docker inspect --format='{{.State.Health.Status}}' yoir-qa-postgres)" = healthy ] && break
  sleep 1
done
test "$(docker inspect --format='{{.State.Health.Status}}' yoir-qa-postgres)" = healthy
docker exec yoir-qa-postgres createdb --username yoir yoir_live_test
```

If port 5432 or that container name is already in use, stop and choose an isolated port/name rather
than reusing an unknown database. System PostgreSQL is acceptable only after the `yoir_test` and
`yoir_live_test` databases and the `yoir` role are verified explicitly.

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

Create the Python environment from the repository root:

```bash
python3.12 -m venv backend/.venv
backend/.venv/bin/python -m pip install --upgrade pip
backend/.venv/bin/python -m pip install -r backend/requirements-test.txt
backend/.venv/bin/python -m compileall -q backend/app backend/reset_db.py
backend/.venv/bin/ruff check backend/app backend/reset_db.py backend/tests backend/pyproject.toml
```

SQLite fallback, which is never PostgreSQL evidence:

```bash
cd backend
.venv/bin/pytest tests
cd ..
```

PostgreSQL 16 in-process suite, using only the dedicated QA database:

```bash
cd backend
DATABASE_URL=postgresql+psycopg://yoir:yoir@127.0.0.1:5432/yoir_test \
YOIR_QA_ALLOW_DATABASE_RESET=true \
SEED_ON_STARTUP=false \
.venv/bin/python -m pytest tests -m "not live" --cov=app \
  --cov-report=term-missing --cov-report=xml:coverage/postgresql-coverage.xml
cd ..
```

Start the isolated live server in a separate terminal:

```bash
cd backend
DATABASE_URL=postgresql+psycopg://yoir:yoir@127.0.0.1:5432/yoir_live_test \
JWT_SECRET=qa-live-secret-that-is-at-least-32-characters \
CORS_ALLOW_ORIGINS=http://localhost:8081 \
SEED_ON_STARTUP=true \
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then, from the repository root, run the two real-network checks:

```bash
LIVE_API_BASE_URL=http://127.0.0.1:8000/api/v1 \
  backend/.venv/bin/pytest backend/tests/test_live_api.py -q -ra
LIVE_API_BASE_URL=http://127.0.0.1:8000/api/v1 \
  npm run test:client:live
```

Repository evidence, from the root:

```bash
python3 -B .github/scripts/tests/test_board_insights.py -v
backend/.venv/bin/python scripts/check_repository_metadata.py
git diff --check
```

Never point these fixtures at a shared or production database. Never report a local SQLite result as
PostgreSQL, a mocked frontend test as cross-stack evidence, or a configured workflow as hosted CI
evidence. Stop and remove the disposable PostgreSQL container after collecting evidence:

```bash
docker stop yoir-qa-postgres
```
