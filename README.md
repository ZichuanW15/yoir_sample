# SWEN90014-2026-CSD-Koala — Yoir

**SWEN90014 Masters Software Engineering Project — Semester 2, 2026 · Team CSD-Koala**

Yoir is a career advisory app connecting Job Seekers — graduates, career changers,
students and skilled migrants — with Career Professionals who sell services such as CV
review, mock interviews and career planning. A Platform Owner verifies Career
Professionals and oversees bookings and payments.

Requirements were defined by the Semester 1 SWEN90009 CSD-Koala team. This phase builds
the product they specified: 51 baselined stories, 179 SP, tracked as `[US-nn]` issues on
the project board.

## Links

| | |
|---|---|
| Dev environment | https://yoir-b8de6ebf.fastapicloud.dev — the web app at `/`, the API at `/api/v1`, interactive API docs at `/docs` |
| Wiki | https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki |
| Project board | https://github.com/orgs/swen90014-2026-sm2/projects/6 |
| Project | [Project Background and Scope](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Project-Background-and-Scope) · [Requirements](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Requirements) · [Product Backlog](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Product-Backlog) · [User Story Map](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/User-Story-Map) · [Risk Register](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Risk-Register) |
| Design | [Design by Concept](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Design-by-Concept) |
| How we work | [Process Documentation and Insights](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights) · [Sprint 2 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Planning) · [Sprint 2 Retrospective](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Retrospective) · [Sprint 3 Planning](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Planning) · [Sprint 3 Retrospective](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Retrospective) · [AI Usage Log](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/AI-Usage-Log) |
| Meetings | [Daily Standups](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Daily-Standups) · [Mentor Communication Log](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Mentor-Communication-Log) · [Client meeting minutes](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Client-meeting-minutes) |
| Testing | [Sprint 1 Test Approach](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-1-Test-Approach) · [Sprint 2 Test Approach](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Test-Approach) · [Sprint 3 Test Approach](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Test-Approach) |
| Client feedback | [Sprint 2 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Review-and-Client-Feedback) · [Sprint 2 Feedback Implemented](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-2-Client-Feedback-Response) · [Sprint 3 Review & Client Feedback](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Review-and-Client-Feedback) |
| Sprint 3 | [Feature Walkthrough](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Feature-Walkthrough) · [Desktop version](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Sprint-3-Feature-Walkthrough-Desktop) · [Architecture Presentation](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Architecture-Presentation) · [Handover](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Handover) |
| Team and roles | [Team Details](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Team-Details) |

The wiki is the source of truth for project documentation. This repository holds the
application code and its tests, the CI, and documents exported from the wiki for
assessment.

## Repository layout

| Path | Contents |
|---|---|
| [frontend/](frontend/) | Expo/React Native app — `app/` (Expo Router screens), `src/` (typed API client, session provider, Yoir Diagnosis, shared UI), `__tests__/` (Jest), `e2e/` (Playwright), `assets/`; see [frontend/README.md](frontend/README.md) |
| [backend/](backend/) | FastAPI backend — `app/` (routers, models, schemas, security, payments, mail, seed), `migrations/` (Alembic), `tests/` (pytest), `reset_db.py`, `pyproject.toml` + `uv.lock` (uv-managed dependencies), `docker-compose.yml` for a local PostgreSQL; see [backend/README.md](backend/README.md) |
| [scripts/](scripts/) | Repository checks — `check_repository_metadata.py` (OpenAPI/traceability parity, Markdown links, workflow YAML, seed JSON), `check_sprint2_qa_traceability.py`, and the Sprint 2 QA recorder and packager |
| [docs/](docs/) | Project documentation, by sprint — see [Documentation](#documentation) |
| [.github/workflows/](.github/workflows/) | CI workflows and the FastAPI Cloud deploy on merge to `dev` |
| [.github/scripts/](.github/scripts/) | Scripts the CI runs, also runnable locally |

## Documentation

### Sprint 1 — [docs/sprint1/](docs/sprint1/)

| Folder | Documents |
|---|---|
| [project/](docs/sprint1/project/) | [Background and scope](docs/sprint1/project/project-background-and-scope.md), [requirements](docs/sprint1/project/requirements.md), [product backlog](docs/sprint1/project/product-backlog.md), [user story map](docs/sprint1/project/user-story-map.md), [risk register](docs/sprint1/project/risk-register.md) |
| [design-by-concept/](docs/sprint1/design-by-concept/) | [Design by Concept](docs/sprint1/design-by-concept/design-by-concept.md) — architecture diagram ([PNG](docs/sprint1/design-by-concept/design-by-concept.png), [draw.io](docs/sprint1/design-by-concept/design-by-concept.drawio)), design reasoning and reuse plan; [database schema](docs/sprint1/design-by-concept/database-schema.md) |
| [executable-architecture/](docs/sprint1/executable-architecture/) | [openapi.yaml](docs/sprint1/executable-architecture/openapi.yaml) (the published API contract), [interface contract](docs/sprint1/executable-architecture/interface-contract.md), [interface traceability](docs/sprint1/executable-architecture/interface-traceability.csv), [backend integration guide](docs/sprint1/executable-architecture/backend-integration.md) |
| [process/](docs/sprint1/process/) | [Process documentation and insights](docs/sprint1/process/process-documentation-and-insights.md), [Board Insights automation](docs/sprint1/process/board-insights-automation.md) |
| [qa/](docs/sprint1/qa/) | [Test approach](docs/sprint1/qa/test-approach.md), [test results](docs/sprint1/qa/test-results.md) |
| [meeting-minutes/](docs/sprint1/meeting-minutes/) | [Client meeting, 25 Aug](docs/sprint1/meeting-minutes/Client%20Meeting/2026-08-25-joint-client-meeting.md) ([PDF](docs/sprint1/meeting-minutes/Client%20Meeting/Client-Meeting-Minutes-2026-08-25.pdf)); daily stand-ups [19 Aug](docs/sprint1/meeting-minutes/daily-standup/2026-08-19-daily-standup.md), [26 Aug](docs/sprint1/meeting-minutes/daily-standup/2026-08-26-daily-standup.md); mentor meetings [12 Aug](docs/sprint1/meeting-minutes/mentor-meeting/2026-08-12-mentor-meeting.md), [20 Aug](docs/sprint1/meeting-minutes/mentor-meeting/2026-08-20-mentor-meeting.md), [27 Aug](docs/sprint1/meeting-minutes/mentor-meeting/2026-08-27-mentor-meeting.md) |
| [Client-email/](docs/sprint1/Client-email/) | [Client communication evidence, August 2026](docs/sprint1/Client-email/Client-Product-Communication-Evidence-August-2026.pdf) and email screenshots |
| — | [CI pipeline diagram](docs/sprint1/mermaid-ci-pipeline.mmd) |

### Sprint 2 — [docs/sprint2/](docs/sprint2/)

| Folder | Documents |
|---|---|
| [process/](docs/sprint2/process/) | [Sprint 2 planning](docs/sprint2/process/sprint-2-planning.md), [process documentation and insights](docs/sprint2/process/process-documentation-and-insights.md) with the Sprint 2 burndown |
| [client-feedback/](docs/sprint2/client-feedback/) | [Sprint 2 review and client feedback](docs/sprint2/client-feedback/sprint-2-review-and-client-feedback.md), [feedback implemented](docs/sprint2/client-feedback/client-feedback-response.md) with screenshots |
| [qa/](docs/sprint2/qa/) | [Sprint 2 test approach](docs/sprint2/qa/sprint-2-test-approach.md); QA evidence starts at [qa/README.md](docs/sprint2/qa/README.md) — test cases, platform matrix, multi-platform results, defects, CI defect policy and reproduction |
| [meeting-minutes/](docs/sprint2/meeting-minutes/) | [Client meeting, 15 Sep](docs/sprint2/meeting-minutes/Client%20Meeting/2026-09-15-client-meeting.md); daily stand-ups [9 Sep](docs/sprint2/meeting-minutes/daily-standup/2026-09-09-daily-standup.md), [16 Sep](docs/sprint2/meeting-minutes/daily-standup/2026-09-16-daily-standup.md); mentor meetings [10 Sep](docs/sprint2/meeting-minutes/mentor-meeting/2026-09-10-mentor-meeting.md), [17 Sep](docs/sprint2/meeting-minutes/mentor-meeting/2026-09-17-mentor-meeting.md) |
| [frontend/](docs/sprint2/frontend/), [backend/](docs/sprint2/backend/) | Delivery documentation per user story, below |

| Story | Frontend | Backend |
|---|---|---|
| US-01 Register as a Job Seeker | [us01](docs/sprint2/frontend/us01-job-seeker-registration.md) | [us01](docs/sprint2/backend/us01-registration.md) |
| US-02 Create a valid account securely | [us02](docs/sprint2/frontend/us02-registration-outcome.md) | [us02](docs/sprint2/backend/us02-account-creation.md) |
| US-03 Duplicate-email error | [us03](docs/sprint2/frontend/us03-duplicate-email.md) | [us03](docs/sprint2/backend/us03-duplicate-email.md) |
| US-04 Register as a Career Professional | [us04](docs/sprint2/frontend/us04-career-professional-registration.md) | |
| US-06–08 Log in, failed login, log out | [us06](docs/sprint2/frontend/us06-login-role-navigation.md), [us07](docs/sprint2/frontend/us07-failed-login-feedback.md), [us08](docs/sprint2/frontend/us08-logout.md) | [us06–us08](docs/sprint2/backend/us06-us08-auth-sessions.md) |
| US-09–13 Yoir Diagnosis (Sprint 3, frontend in progress) | [us09–us13](docs/sprint2/frontend/us09-us13-yoir-diagnosis.md) | |
| US-29 Job Seeker profile | [us29](docs/sprint2/frontend/us29-job-seeker-profile.md) | |
| US-30 Career Professional profile | [us30](docs/sprint2/frontend/us30-professional-profile.md) | [us30](docs/sprint2/backend/us30-counsellor-profile.md) |
| US-34–41 Services, delivery, availability and booking slots | [us34](docs/sprint2/frontend/us34-create-a-service.md), [us35](docs/sprint2/frontend/us35-describe-and-price-a-service.md), [us37](docs/sprint2/frontend/us37-service-delivery-modality.md), [us38](docs/sprint2/frontend/us38-in-person-meeting-area.md), [us39](docs/sprint2/frontend/us39-availability.md), [us40](docs/sprint2/frontend/us40-slot-selection.md), [us41](docs/sprint2/frontend/us41-double-booking.md) | [us34–us41](docs/sprint2/backend/us34-us41-services-and-availability.md) |
| US-42–43 My sessions, cancellation and receipts | [us42–us43](docs/sprint2/frontend/us42-us43-my-sessions-cancellation-and-receipts.md) | |
| US-44–46 Explore, search and service evaluation | [us44](docs/sprint2/frontend/us44-browse-explore.md), [us45](docs/sprint2/frontend/us45-search-filter-sort.md), [us46](docs/sprint2/frontend/us46-service-evaluation.md) | [us44–us46](docs/sprint2/backend/us44-us46-marketplace-discovery.md) |
| US-47 Test purchase and Career Professional payouts | [test purchase](docs/sprint2/frontend/us47-test-purchase.md), [payouts](docs/sprint2/frontend/us47-career-professional-payouts.md) | |
| US-48, 58, 71 Platform Owner administration | [us48, us58, us71](docs/sprint2/frontend/us48-us58-us71-platform-owner-administration.md) | |
| US-68 Booking confirmation | [us68](docs/sprint2/frontend/us68-booking-confirmation.md) | |
| US-70 Email verification and password recovery | [us70](docs/sprint2/frontend/us70-email-verification-and-password-recovery.md) | |
| Client feedback: navigation, notifications, terminology and branding | [frontend](docs/sprint2/frontend/client-feedback-navigation-notifications-and-branding.md) | |

### Sprint 3 — [docs/sprint3/](docs/sprint3/)

| Area | Documents |
|---|---|
| Handover | [Handover to the client](docs/sprint3/handover.md): what is handed over, the delivery record, and how to run, configure and deploy the system |
| US-09–13 Yoir Diagnosis | [Integrated delivery record](docs/sprint3/backend/us09-us13-yoir-diagnosis.md), [frontend detail](docs/sprint3/frontend/us09-us13-yoir-diagnosis.md), [backend US-09–11 detail](docs/sprint3/backend/us09-us11-diagnosis.md) |
| Backend delivery | [US-05 onboarding](docs/sprint3/backend/us05-career-professional-onboarding-state.md), [US-27–29 profile privacy](docs/sprint3/backend/us27-us29-profile-privacy.md), [US-31–33 verification](docs/sprint3/backend/us31-us33-linkedin-verification.md), [US-36 service editing](docs/sprint3/backend/us36-service-edit-and-removal.md), [US-43/69 booking detail and rescheduling](docs/sprint3/backend/us43-us69-booking-detail-and-reschedule.md), [US-53–55 reviews](docs/sprint3/backend/us53-us55-reviews-and-ratings.md) |
| Frontend delivery | [US-30 profile autosave](docs/sprint3/frontend/us30-professional-profile-autosave.md), [US-31–32 verification](docs/sprint3/frontend/us31-us32-linkedin-verification.md), [US-33/58 verification review](docs/sprint3/frontend/us33-us58-verification-review.md), [US-48/71 owner oversight](docs/sprint3/frontend/us48-us71-platform-owner-oversight.md), [US-05 onboarding](docs/sprint3/frontend/us05-career-professional-onboarding.md), [US-27–29 profile privacy](docs/sprint3/frontend/us27-us29-profile-privacy.md), [US-36 service editing](docs/sprint3/frontend/us36-service-edit-and-removal.md), [US-42 My bookings](docs/sprint3/frontend/us42-my-bookings.md), [US-43/69 booking detail and rescheduling](docs/sprint3/frontend/us43-us69-booking-detail-and-reschedule.md), [US-53–55 reviews and ratings](docs/sprint3/frontend/us53-us55-reviews-and-ratings.md), [US-70 password reset](docs/sprint3/frontend/us70-password-reset.md) |
| Evidence and process | [Feature walkthrough](docs/sprint3/walkthrough/sprint-3-feature-walkthrough.md), [Sprint 3 planning](docs/sprint3/process/sprint-3-planning.md), [AI usage log](docs/sprint3/process/ai-usage-log.md), [desktop walkthrough](docs/sprint3/walkthrough/sprint-3-feature-walkthrough-desktop.md), [Sprint 3 review and client feedback](docs/sprint3/client-feedback/sprint-3-review-and-client-feedback.md), [Sprint 3 retrospective](docs/sprint3/process/sprint-3-retrospective.md), [process documentation and Sprint 3 insights](docs/sprint3/process/process-documentation-and-insights.md), [current test results](docs/sprint3/qa/test-results.md), [QA evidence](docs/sprint3/qa/README.md), [meeting minutes](docs/sprint3/meeting-minutes/) |
| Project | [Requirements](docs/sprint3/project/requirements.md), [Product Backlog](docs/sprint3/project/product-backlog.md), [User Story Map](docs/sprint3/project/user-story-map.md), [Risk Register with the Sprint 3 review](docs/sprint3/project/risk-register.md) |

### Deployment and payments

- [Deploying the dev environment](docs/deployment/dev-environment.md) — FastAPI Cloud, Neon, and the Stripe and Mailgun sandboxes
- [Payments spec](docs/payment/stripe-payment-spec.md) — Stripe Connect

## Architecture

Sprint 1 delivered a walking skeleton through every layer of the design. Sprint 2 builds
the account-to-booking foundation on it:

```text
register / log in -> Explore -> service and Career Professional profile -> open slot -> test payment -> confirmation
```

The frontend is React Native + Expo (SDK 57) in TypeScript with `expo-router`: one
codebase for iOS, Android and the web build. The backend is FastAPI on Python 3.12 with
SQLAlchemy 2.0 and PostgreSQL 16, Alembic migrations applied on startup, Argon2 password
hashing and JWT bearer sessions; its dependencies are managed by uv and it deploys to
FastAPI Cloud. They communicate over REST/JSON under `/api/v1` as published in
[openapi.yaml](docs/sprint1/executable-architecture/openapi.yaml); 66 of the 76 published
operations are implemented at runtime; the other 10 belong to the deferred Forum, order-linked
messaging and disputes, or to booking completion, which a scheduled job handles. Payments
run through Stripe in test mode, so no
real money moves; without Stripe keys the server falls back to a labelled development
stub. Email goes through Mailgun, and is logged instead when no Mailgun key is set.

[interface-contract.md](docs/sprint1/executable-architecture/interface-contract.md)
carries the human-readable control rules and invariants,
[interface-traceability.csv](docs/sprint1/executable-architecture/interface-traceability.csv)
maps every operation to its requirement IDs and implementation status, and
[backend-integration.md](docs/sprint1/executable-architecture/backend-integration.md)
is the starting point for backend contributors.

### Run the backend

Python dependencies are managed with [uv](https://docs.astral.sh/uv/): `backend/pyproject.toml`
declares them and `backend/uv.lock` pins every resolved version, and both are committed. uv also
downloads the pinned Python 3.12, so uv itself is the only prerequisite — plus a PostgreSQL
server (or Docker: `docker compose up -d` inside `backend/` starts PostgreSQL 16 as `yoir/yoir`
on 5432).

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh   # once; or brew install uv

cd backend
uv sync                              # create .venv and install everything uv.lock pins
cp .env.example .env                 # point DATABASE_URL at your PostgreSQL
uv run python reset_db.py            # rebuild the schema through migrations and load app/seed_data.json
uv run fastapi dev app/main.py       # http://localhost:8000/api/v1 · interactive docs at /docs
```

`uv run yoir-dev` instead builds the Expo web app and serves it with the API on
`http://127.0.0.1:8000`. `uv sync` builds `backend/.venv` and `uv run <cmd>` executes inside
it, so there is nothing to activate. Re-run `uv sync` after any pull that touches `uv.lock`.
Startup applies any outstanding migrations, so pulling a schema change needs no manual step.

Keep the `postgresql://` scheme in `DATABASE_URL`. The backend uses the `psycopg2-binary`
driver, which is what SQLAlchemy selects for that scheme; a `postgresql+psycopg://` URL asks
for psycopg 3 instead and fails with `ModuleNotFoundError: No module named 'psycopg'`.

Seed logins (password `password123`): Job Seekers `alex@example.com` and
`sam@example.com`; Career Professionals `maya@example.com`, `jordan@example.com`,
`priya@example.com` and `tom@example.com`. The Platform Owner account is created on
startup from `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`. Configuration, the full uv
command reference, payments, FastAPI Cloud deployment and structure are in
[backend/README.md](backend/README.md).

### Run the frontend

Prerequisites: Node.js 20 (pinned in `frontend/.nvmrc`) and npm.

```bash
cd frontend
npm ci
cp .env.example .env            # EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8000/api/v1
npm start
```

Use your machine's LAN IP rather than `localhost` so a phone or emulator can reach the
backend.

### Test

```bash
cd frontend && npm run lint && npm run typecheck \
  && npm run test:coverage && cd ..                          # frontend, 90/80/90/90 coverage gate
cd frontend && npx playwright install chromium \
  && npm run build:web && npm run test:web && cd ..          # Chromium acceptance journeys
cd backend && uv sync \
  && uv run ruff check app tests reset_db.py \
  && uv run pytest tests && cd ..                            # backend on a temporary SQLite file
uv run --project backend python scripts/check_repository_metadata.py  # contract, links, workflow YAML, seed JSON
```

The test fixtures refuse to reset a PostgreSQL database unless its name is exactly
`yoir_test` or ends in `_test` **and** `YOIR_QA_ALLOW_DATABASE_RESET=true` is set; never
point them at a shared database. The PostgreSQL, live Uvicorn and cross-stack
TypeScript-client runs, and the safety rules around them, are in
[test-approach.md](docs/sprint1/qa/test-approach.md) §15. Sprint 2's scope, platform
boundary and results are in the [Sprint 2 test approach](docs/sprint2/qa/sprint-2-test-approach.md)
and [QA evidence](docs/sprint2/qa/README.md).

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
[Process Documentation and Insights](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights) wiki page.

## Continuous integration

**Application CI** ([.github/workflows/app-ci.yml](.github/workflows/app-ci.yml)) runs on
every push and pull request that touches application, test, documentation or CI files.
Blocking checks cover frontend lint, typecheck, Jest coverage, the deployable Expo Web build
and a critical-severity production audit; backend compile, Ruff and pytest with coverage on
PostgreSQL 16; an isolated live Uvicorn exercised by HTTPX, by the real TypeScript client
with unmocked `fetch` and through the web build it serves at `/`; and repository evidence —
checksum-verified `actionlint`, OpenAPI/traceability parity, Markdown links, the Board
Insights tests and whitespace. The frontend, backend and live jobs upload their evidence as
build artifacts, and the frontend job also uploads the web build itself.

Sprint 2 also runs Chromium acceptance journeys against an isolated API/database and a
separate iOS/Android **component** matrix using Expo's platform presets. Native regression
and defect results are retained independently. Defect-only CI steps are advisory;
their report-health checks and all normal regressions remain blocking. See the
[current QA policy](docs/sprint2/qa/ci-defect-policy-20260916.md).
These matrix jobs do not launch simulators or certify device builds. The
[platform matrix](docs/sprint2/qa/platform-test-matrix.md) records that evidence boundary.

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

**Deploy to FastAPI Cloud** ([.github/workflows/deploy-dev.yml](.github/workflows/deploy-dev.yml))
redeploys the [dev environment](https://yoir-b8de6ebf.fastapicloud.dev) on every merge into
`dev` that touches `backend/**` or `frontend/**`, and on manual dispatch. One deployment
serves both halves: the job exports the Expo web build into `backend/static`, installs
runtime dependencies with `uv sync --locked --no-default-groups` and runs
`uv run fastapi deploy`, authenticating with the `FASTAPI_CLOUD_TOKEN` and
`FASTAPI_CLOUD_APP_ID` repository secrets rather than an interactive login. Provisioning
those secrets, how the build reaches the upload and the alternative of gating the deploy
on a green Application CI run are described in [backend/README.md](backend/README.md);
the database, Stripe and Mailgun setup is in
[dev-environment.md](docs/deployment/dev-environment.md).

**Board Insights** ([.github/workflows/board-insights.yml](.github/workflows/board-insights.yml))
validates the generator offline on relevant pushes and pull requests. On the daily
schedule, on issue events and on manual dispatch it regenerates the marker-delimited
section of the
[Process Documentation and Insights](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Process-Documentation-and-Insights)
wiki page from the project board, using the `BOARD_INSIGHTS_TOKEN` secret; the operating
and credential boundaries are in
[board-insights-automation.md](docs/sprint1/process/board-insights-automation.md).
