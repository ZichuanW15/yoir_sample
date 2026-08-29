# SWEN90014-2026-CSD-Koala — Yoir

**SWEN90014 Masters Software Engineering Project — Semester 2, 2026 · Team CSD-Koala**

Yoir is a two-sided career advisory marketplace connecting job seekers — graduates,
career changers, students and skilled migrants — with career counsellors who sell
services such as CV review, mock interviews and career planning. A platform owner
moderates content, reviews counsellor verification, and oversees orders and disputes.

Requirements were defined by the Semester 1 SWEN90009 CSD-Koala team. This phase builds
the product they specified: 51 baselined stories, 179 SP, tracked as `[US-nn]` issues on
the project board.

## Links

| | |
|---|---|
| Wiki | https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki |
| Project board | https://github.com/orgs/swen90014-2026-sm2/projects/6 |
| Background and scope | [Project Background and Scope](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Project-Background-and-Scope) |
| Requirements | [Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements) |
| How we work | [Process Documentation](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation) |
| Team and roles | [Team Details](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Team-Details) |
| Client meeting minutes | [Client meeting minutes](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Client-meeting-minutes) |

The wiki is the source of truth for project documentation. This repository holds the
application code and its tests, the CI, and documents exported from the wiki for
assessment.

## Repository layout

| Path | Contents |
|---|---|
| [app/](app/) | Expo Router screens: marketplace, service detail, time slots, login, register, booking confirmation |
| [src/](src/) | Typed API client and demo adapter (`src/api/`), session provider (`src/auth/`), shared UI components and design tokens |
| [__tests__/](__tests__/) | Jest suites for the API client, auth state, every screen, the route graph and the opt-in live TypeScript-client journey |
| [assets/](assets/) | App icons and splash images |
| [backend/](backend/) | FastAPI backend — `app/` (routers, models, schemas, security, seed), `tests/` (pytest), `reset_db.py`, `docker-compose.yml` for a local PostgreSQL |
| [scripts/](scripts/) | `check_repository_metadata.py` — OpenAPI/traceability parity, Markdown links, workflow YAML and seed JSON |
| [docs/sprint1/](docs/sprint1/) | Sprint 1 documentation |
| [docs/sprint1/executable-architecture/](docs/sprint1/executable-architecture/) | Published API contract (`openapi.yaml`), interface contract, requirement traceability, backend integration guide |
| [docs/sprint1/qa/](docs/sprint1/qa/) | Test approach and recorded test results for the executable architecture |
| [docs/sprint1/process/](docs/sprint1/process/) | Board Insights automation — how the project board is published to the wiki |
| [docs/sprint1/design-by-concept/](docs/sprint1/design-by-concept/) | Architecture diagram and the design reasoning behind it |
| [docs/sprint1/project/](docs/sprint1/project/) | Background and scope, requirements, product backlog, user story map, risk register |
| [docs/sprint1/meeting-minutes/](docs/sprint1/meeting-minutes/) | Client meeting and daily stand-up minutes |
| [docs/sprint1/Client-email/](docs/sprint1/Client-email/) | Client communication evidence |
| [.github/workflows/](.github/workflows/) | CI workflows |
| [.github/scripts/](.github/scripts/) | Scripts the CI runs, also runnable locally |

## Executable architecture

Sprint 1 delivers a walking skeleton through every layer of the design:

```text
public marketplace -> service detail -> login when required -> choose time -> stub payment -> confirmation
```

The frontend is React Native + Expo (SDK 54) in TypeScript with `expo-router`. The
backend is FastAPI on Python 3.12 with SQLAlchemy 2.0 and PostgreSQL 16, Argon2 password
hashing and JWT bearer sessions. They communicate over REST/JSON under `/api/v1` as
published in
[openapi.yaml](docs/sprint1/executable-architecture/openapi.yaml); eight of the
36 published operations are implemented at runtime (health, register, login, list
services, service detail, service slots, create order, stub payment). The payment step
is an explicitly labelled development stub — it collects no card data and charges no
money — while `CLIENT-02` remains open.

[interface-contract.md](docs/sprint1/executable-architecture/interface-contract.md)
carries the human-readable control rules and invariants,
[interface-traceability.csv](docs/sprint1/executable-architecture/interface-traceability.csv)
maps every operation to its requirement IDs, and
[backend-integration.md](docs/sprint1/executable-architecture/backend-integration.md)
is the starting point for backend contributors.

### Run the backend

Prerequisites: Python 3.11+ and a PostgreSQL server (or Docker: `docker compose up -d`
inside `backend/` starts PostgreSQL 16 as `yoir/yoir` on 5432).

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # set DATABASE_URL for your PostgreSQL
python reset_db.py              # create every table and load app/seed_data.json
uvicorn app.main:app --reload   # http://localhost:8000/api/v1 · interactive docs at /docs
```

Seed logins (password `password123`): job seekers `alex@example.com` and
`sam@example.com`; counsellors `maya@example.com`, `jordan@example.com`,
`priya@example.com` and `tom@example.com`. Configuration, structure and the deliberate
skeleton shortcuts are in [backend/README.md](backend/README.md).

### Run the frontend

Prerequisites: Node.js 20 and npm.

```bash
npm install
cp .env.example .env            # EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8000/api/v1
npm start
```

Use your machine's LAN IP rather than `localhost` so a phone or emulator can reach the
backend. Setting `EXPO_PUBLIC_USE_DEMO_API=true` runs the UI on in-memory demo data with a
visible label; it is for UI-only work and is never evidence that the backend works.

### Test

```bash
npm run lint && npm run typecheck && npm run test:coverage   # frontend, 90/80/90/90 coverage gate
cd backend && .venv/bin/pip install -r requirements-test.txt \
  && .venv/bin/ruff check app tests reset_db.py \
  && .venv/bin/pytest tests && cd ..                         # backend on a temporary SQLite file
backend/.venv/bin/python scripts/check_repository_metadata.py   # contract, links, workflow YAML, seed JSON
```

The test fixtures refuse to reset a PostgreSQL database unless its name is exactly
`yoir_test` or ends in `_test` **and** `YOIR_QA_ALLOW_DATABASE_RESET=true` is set; never
point them at a shared database. The PostgreSQL, live Uvicorn and cross-stack
TypeScript-client runs, and the safety rules around them, are in
[test-approach.md](docs/sprint1/qa/test-approach.md) §15; the results recorded against
exact commits, including strict XFail defects and open gaps, are in
[test-results.md](docs/sprint1/qa/test-results.md).

## Team

| Member | Role |
|---|---|
| Manu | Scrum Master |
| Jared | Product Owner |
| Ariz | Frontend Developer |
| James | Frontend Developer |
| Evelyn | Backend Developer |
| Jashan | Backend Developer |
| Zhenyang | QA Lead |

Full names, contacts and responsibilities are on the [Team Details](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Team-Details)
wiki page. Tutor: Erfan Farabi. Client: Saumil Macwan.

## Branching and code workflow

Three levels: `main` → `dev` → feature branches.

| Branch | Purpose | Rule |
|---|---|---|
| `main` | Stable, always runnable. Milestone tags live here. | Never push directly. Only `dev` merges in, via PR, at the end of a sprint or milestone. |
| `dev` | Integration — where the current sprint's work comes together. | Never push directly. Only feature branches merge in, via reviewed PR. |
| `feat/<id>-<name>` | One branch per board item, cut from `dev`, e.g. `feat/S1-04-slot-reservation`. Use `fix/`, `docs/`, `chore/` for non-feature work. | Deleted after merge. |

```
git checkout dev && git pull
git checkout -b feat/S1-04-slot-reservation
git push -u origin feat/S1-04-slot-reservation
```

Open the PR **into `dev`** with `Closes #nn` in the description so the board item closes
on merge. The other member of your sub-team approves; QA checks the acceptance criteria
before the item moves to Done. Full detail is on the
[Process Documentation](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation) wiki page.

## Continuous integration

**Application CI** ([.github/workflows/app-ci.yml](.github/workflows/app-ci.yml)) runs on
every push and pull request that touches application, test, documentation or CI files.
Four blocking jobs: frontend lint, typecheck, Jest coverage, Expo Web export and a
critical-severity production audit; backend compile, Ruff and pytest with coverage on
PostgreSQL 16; an isolated live Uvicorn exercised by HTTPX and by the real TypeScript
client with unmocked `fetch`; and repository evidence — checksum-verified `actionlint`,
OpenAPI/traceability parity, Markdown links, the Board Insights tests and whitespace.
The frontend, backend and live jobs upload their evidence as build artifacts.

**Mermaid Diagrams** ([.github/workflows/mermaid.yml](.github/workflows/mermaid.yml)) runs
on branch creation, on every push to any branch, and on every pull request. It renders
every `.mmd`/`.mermaid` file and every fenced `mermaid` block in Markdown to SVG and PNG,
so a diagram that no longer parses fails the check instead of reaching review broken.
Each run publishes the diagrams inline in the job summary, uploads the SVG/PNG as a
build artifact, and posts them as a single updating comment on the pull request.

To run the same check locally:

```
npm install -g @mermaid-js/mermaid-cli@11.16.0
.github/scripts/render-mermaid.sh build/diagrams
```

**Board Insights** ([.github/workflows/board-insights.yml](.github/workflows/board-insights.yml))
validates the generator offline on relevant pushes and pull requests. On the daily
schedule, on issue events and on manual dispatch it regenerates the marker-delimited
section of the
[Process Documentation and Insights](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights)
wiki page from the project board. Publishing only works once the workflow is on the
default branch and the `BOARD_INSIGHTS_TOKEN` secret is configured; the operating and
credential boundaries are in
[board-insights-automation.md](docs/sprint1/process/board-insights-automation.md).
