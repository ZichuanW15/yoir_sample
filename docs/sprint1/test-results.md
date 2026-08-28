# Sprint 1 Test Results

## Execution identity

| Field | Value |
|---|---|
| Test date/time | 2026-08-29 00:12:33 AEST |
| Operating system | macOS 26.4.1, Build 25E253, arm64 |
| Node.js / npm | 20.20.2 / 10.8.2 |
| Python / pip | 3.12.13 / 25.0.1, isolated `backend/.venv` |
| PostgreSQL | Homebrew PostgreSQL 16.15, local service |
| Branch | `qa/sprint1-latest-evidence` |
| Authoritative product source | `cdfc257be9121e1141689fa8e69fcb8d3ca41a0e` |
| QA integration starting point | `ab64d8a34d1a5d7fb446fecbe53dc9b02d2764b8` |
| Backend lint-only delta | `a8ca74b31e7df6bc33cf2982354ea773508df484` |
| Test implementation | `7f22ad75f091f44105bfcd4f35ffcdee523a1c5e` |
| Application CI | `5d80d2365b490e96f18a14dff0de04886d3cfe09` |
| Board Insights | `94b0534cee91d8e8e3fa907c08ce59e57748966a` |
| Local evidence code head | `94b0534cee91d8e8e3fa907c08ce59e57748966a` |
| Hosted Application CI | Not Run at the local evidence boundary |
| Hosted Board publication | Not Run; default-branch integration and credential required |

The repository owner selected `origin/exe-archi-backend` as the authoritative source for both the
frontend and backend product tree. All integration is confined to the QA branch. Nothing was merged
into `main`, `dev`, `exe-archi-backend` or the frontend member branch, and no tag was created.

## Result summary

| Check | Actual result | Classification | Evidence boundary |
|---|---|---|---|
| `npm ci --no-audit` | 1,091 packages installed from `package-lock.json` | Pass | Reproducible frontend/test install |
| ESLint | Exit 0 | Pass | Frontend and QA TypeScript lint |
| TypeScript | Exit 0 | Pass | Compile-time checking |
| Jest coverage run | 10 suites passed, 1 live suite skipped; 58 Pass, 22 Todo, 1 Skip | Pass for 58 executable tests | Mock/component tests; live Skip separate |
| Frontend coverage | 96.09% statements, 88.83% branches, 97.29% functions, 100% lines | Pass | Exceeds 90/80/90/90 gate over `app/**` and `src/**` |
| Expo Web export | One 1.03 MB bundle; nine static routes | Pass | Web build smoke, not native acceptance |
| Full `npm audit` | 20 findings: 11 moderate, 9 high, 0 critical | Fail / owner action | Includes development dependencies |
| Production critical audit gate | 19 findings: 10 moderate, 9 high, 0 critical; exit 0 | Gate Pass with findings | Critical-only CI gate; findings remain open |
| Python compile | All backend modules compile | Pass | Syntax/import boundary |
| QA Ruff | Backend tests and Board generator clean | Pass | QA-owned Python |
| Production Ruff | Backend application clean | Pass | Blocking lint gate |
| SQLite pytest | 60 Pass, 16 strict XFail, 1 Skip, 1 live deselected | Pass with exceptions | QA-created temporary SQLite only |
| SQLite backend coverage | 93% including branches | Recorded | Not PostgreSQL evidence |
| PostgreSQL pytest | 61 Pass, 16 strict XFail, 1 live deselected | Pass with strict XFail | Dedicated `yoir_test` on PostgreSQL 16.15 |
| PostgreSQL concurrency | Two simultaneous orders: one 201, one 409, one stored Order | Pass | Real row-lock behaviour |
| HTTPX live journey | 1 Pass | Pass | Real Uvicorn socket and `yoir_live_test` |
| TypeScript client live journey | 1 Pass | Pass | Real `src/api/client.ts`, global `fetch`, no mock |
| Live database isolation | before `4/7/21/0/0`; after `6/7/19/2/2` | Pass | users/services/open slots/orders/bookings; health remained 200 |
| Board Insights offline suite | 49 Pass | Pass | Credential-free fixture boundary |
| Action workflow syntax | All workflows clean with actionlint 1.7.12 | Pass | Local schema/static validation |
| OpenAPI/traceability | 36 operations; exact 36-row semantic parity | Pass | Published contract structure |
| OpenAPI local references | 35 unique local references resolved | Pass | Published contract structure |
| Markdown/workflow/JSON | 12 relative links, 0 broken; YAML and seed JSON parsed | Pass | Repository metadata |
| Repository whitespace | working tree and empty-tree first-push simulation clean | Pass | Local Git evidence |
| Mermaid browser rendering | Not Run locally | Not Run | Hosted publish job performs this before Wiki commit |
| Real ProjectV2 GraphQL | Not Run locally | Not Run | Requires authorised token |
| Native simulator/device | Not Run | Blocked | Local Web export is not native acceptance |

`npm audit fix --force` was not run. The reported automatic repair path requires an Expo 57 major
upgrade and is outside QA authority.

## Frontend executable evidence

The 58 passing tests cover request method/URL/body/encoding/error conversion, Bearer headers for
order and payment, the demo adapter journey, AuthContext login/logout state, registration and login
booking continuation, Marketplace loading/search/empty/error/retry, service detail and role-aware
CTA behaviour, slot/order/payment screens, confirmation navigation and the registered route graph.

The normal suite retains the live client test as an explicit Skip when `LIVE_API_BASE_URL` is absent.
The dedicated command fails before Jest when that variable is absent, so an explicitly requested
cross-stack run cannot be reported as a skipped success.

### Todo: 22, not Pass

| Area | Unimplemented or unresolved boundary |
|---|---|
| API client | valid-JSON `null` fallback, runtime schema validation, timeout/abort, production URL fail-fast |
| Login | invalid/non-scalar `serviceId`; non-Job-Seeker booking continuation |
| Register | Counsellor registration with booking intent; invalid/non-scalar `serviceId` |
| Marketplace | stale-response prevention for overlapping searches |
| Service detail | missing-parameter recovery; stale data after a failed ID change |
| Timeslots | deep-link role protection; modality choice; user timezone; preserved payment error; missing parameter |
| Confirmation | required parameter validation; malformed time; trusted server-side confirmation data |
| Session | expiry handling; persistence across restart; server-side logout invalidation |

## Backend and PostgreSQL evidence

The PostgreSQL suite used only `yoir_test` with `YOIR_QA_ALLOW_DATABASE_RESET=true`. Its concurrency
test issued two create-order requests for one open slot and observed exactly one `201`, one
`409 SLOT_UNAVAILABLE`, one persisted order and a held slot. This proves the current row-lock behaviour;
it does not prove the missing database UNIQUE invariant.

The live server used the separate `yoir_live_test`. HTTPX and the handwritten TypeScript client each
completed register → login → services → detail → slots → bearer order → stub payment. The TypeScript
journey used the real client and unmocked Node `fetch`. After both processes exited, Uvicorn health
still returned 200 and the expected two users, two orders and two bookings remained. This proves the
live-only pytest selection did not initialise the destructive fixture or run `drop_all()`.

The TypeScript client has seven product methods and no health method. Health is covered by HTTPX and
backend tests; this report does not call the frontend client an eight-method client.

### Strict XFail: 16, not Pass

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

One Starlette TestClient deprecation warning was emitted by the resolved dependency set. Product
runtime requirements use open lower bounds, so the same clean clone may resolve newer packages until
the dependency owner adopts a reviewed lock strategy.

## Product-delta review

`app/**` and `src/**` remain byte-identical to the authoritative product commit. Three files under
`backend/app/**` differ only for the blocking Ruff gate:

- `backend/app/routers/bookings.py`: long calls wrapped across lines;
- `backend/app/seed.py`: import-group whitespace normalised;
- `backend/app/security.py`: FastAPI `Depends`/`Header` declarations expressed with `Annotated`, plus
  line wrapping.

All backend API, authentication, RBAC, ownership, SQLite, PostgreSQL and live tests passed within the
counts above. The generated runtime OpenAPI JSON SHA-256 is identical before and after the lint-only
delta: `eb33265e588060ec1cc8c92cebc19ab286b50c90c85b68687c724cf22162f4bf`. No product business
rule, response or persistence transition was intentionally changed.

## Board Insights and CI evidence boundaries

The Board generator follows ProjectV2 item pagination, fails closed on nested connection truncation
or cursor/data drift, preserves fractional points, escapes untrusted labels, and atomically replaces
exactly one marker block. Its 49 tests include null organisation/project, empty board, sprint
boundaries, retries/timeouts, marker failures, CRLF preservation, workflow secret isolation and
stable no-op output.

Application CI defines four blocking jobs: frontend, PostgreSQL backend, isolated live/cross-stack,
and repository evidence. Official Actions are pinned to immutable SHAs; PostgreSQL is fixed at
16.15-bookworm; Jest emits one coverage/test result; production Ruff is blocking; actionlint is
downloaded with a fixed checksum. The live and in-process jobs never share a database.

These workflow definitions and local validations are not hosted evidence. A hosted run URL and
status must be recorded for the exact pushed commit before claiming Application CI Pass. Board
publication additionally requires the workflow on the default branch, a least-privilege
`BOARD_INSIGHTS_TOKEN`, successful ProjectV2 access, Mermaid rendering, one correct Wiki-page update
and a second no-op run. Those conditions were not locally asserted.

## Remaining owner actions

- Product owners: resolve the 16 strict XFail defects and the 22 frontend Todos, especially the slot
  invariant, hold expiry, session lifecycle, modality/timezone and confirmation validation.
- Architecture owners: replace or formally accept the handwritten client, introduce Alembic, and
  distinguish the current stub from the target provider/webhook payment architecture.
- Dependency owners: plan compatible Expo/security upgrades and lock backend runtime dependencies.
- Delivery owners: run native simulator/device and deployed-environment acceptance.
- Repository administrators: integrate reviewed workflows into the default branch and configure the
  Board token without pasting it into logs or chat.

## Conclusion

The selected product tree has reproducible local QA evidence for its implemented boundary, including
PostgreSQL concurrency and a real TypeScript-client-to-Uvicorn journey. It is not described as
perfect, complete, release-ready or production-ready: strict XFail, Todo, dependency findings,
native/deployed gaps, hosted CI and hosted Board publication remain separate and explicit.

See [`test-approach.md`](test-approach.md) for the testing model, safety rules and clean-clone
commands.
