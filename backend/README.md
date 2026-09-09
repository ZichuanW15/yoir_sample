# Yoir Backend — Executable Architecture Skeleton

FastAPI backend for the first Yoir walking skeleton, the same slice the frontend implements:

```text
public marketplace -> service detail -> login when required -> choose time -> stub payment -> confirmation
```

It implements the published Sprint 1 contract in
[`../docs/sprint1/executable-architecture/openapi.yaml`](../docs/sprint1/executable-architecture/openapi.yaml) for these operations only:

| Method | Path | Contract |
|---|---|---|
| GET  | `/api/v1/health` | `{ "status": "ok" }` (NFR-02) |
| POST | `/api/v1/auth/users` | register (US-01..04) → `201 User`, `400`, `409` |
| POST | `/api/v1/auth/sessions` | login (US-06, US-07) → `200 Session`, `401 INVALID_CREDENTIALS` |
| GET  | `/api/v1/services` | list active services (US-44, US-45), `?query=`, `?modality=` |
| GET  | `/api/v1/services/{serviceId}` | service detail (US-46) → `200 Service`, `404 NOT_FOUND` |
| GET  | `/api/v1/services/{serviceId}/slots` | currently open time slots (US-40) |
| POST | `/api/v1/orders` | authenticated Job Seeker creates an order and holds one slot (US-41, US-47) |
| POST | `/api/v1/orders/{orderId}/payments/stub` | records a development-only payment and confirms one booking (US-47, US-68) |

Everything else in the contract (booking, payment, messaging, forum, reviews, verification,
admin) is a follow-on slice and is deliberately absent.

## Run

Dependencies are managed with [uv](https://docs.astral.sh/uv/): `pyproject.toml` declares them
and `uv.lock` pins every resolved version. Both are committed and are the single source of
truth for what gets installed.

Prerequisites: **uv** and a running **PostgreSQL**. uv downloads the Python 3.12 interpreter
itself, so nothing else needs installing first.

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh   # or: brew install uv
```

### 1. PostgreSQL

Use whatever you have. On this machine it is Postgres.app (port **5433**):

```bash
# create the database once
createdb -h localhost -p 5433 yoir
```

Standard local server on 5432, or Docker instead:

```bash
docker compose up -d          # brings up postgres:16 on 5432 as yoir/yoir
```

### 2. App

```bash
cd backend
uv sync                          # create .venv and install everything uv.lock pins
cp .env.example .env             # then point DATABASE_URL at your Postgres
uv run python reset_db.py        # create every table and load app/seed_data.json
uv run yoir-dev                  # build the web frontend, then serve it with the API
```

`uv run yoir-dev` is the full-stack local command: it exports the Expo web build into
`static/` when the frontend sources are newer than the build already there, then starts
Uvicorn with reload on `http://127.0.0.1:8000` serving both. `--no-build` serves whatever
build is in place, `--force-build` rebuilds regardless, and `--host`/`--port` move the server.
For the API on its own, `uv run fastapi dev app/main.py` still works unchanged.

`uv sync` builds `backend/.venv` for you and `uv run <command>` executes inside it, so there
is nothing to activate. Re-run `uv sync` after any pull that touches `uv.lock`.

- `DATABASE_URL` in `.env` — e.g. `postgresql://evelyn@localhost:5433/yoir` (Postgres.app)
  or `postgresql://yoir:yoir@localhost:5432/yoir` (docker compose). Keep the
  `postgresql://` scheme: the backend uses the `psycopg2-binary` driver, which is what
  SQLAlchemy selects for that scheme. A `postgresql+psycopg://` URL asks for the psycopg 3
  driver instead and fails with `ModuleNotFoundError: No module named 'psycopg'`.
- API root: `http://localhost:8000/api/v1` · interactive docs: `http://localhost:8000/docs`
- First start creates the tables and seeds job seekers, counsellors and services from
  `app/seed_data.json` plus three future time slots per service.
- The payment stub is deliberately labelled, collects no card data and charges no real money.
- **Reset / reseed the database any time** (no web server needed):
  ```bash
  uv run python reset_db.py
  ```
  Drops and recreates every table in `DATABASE_URL`, then reloads `app/seed_data.json`.
- Seed logins (password `password123`): job seekers `alex@example.com`, `sam@example.com`;
  counsellors `maya@example.com`, `jordan@example.com`, `priya@example.com`, `tom@example.com`.

### 3. Test

```bash
cd backend
uv run ruff check app tests reset_db.py
uv run pytest tests               # temporary SQLite file when DATABASE_URL is unset
```

The QA tools (`pytest`, `pytest-cov`, `httpx`, `ruff`, `PyYAML`) are the `dev` dependency
group in `pyproject.toml` and `uv sync` installs them by default.

`pyproject.toml` declares a `[build-system]` so the `yoir-dev` entry point can be installed.
uv installs the project itself in editable mode, so `app/` is always served from the working
tree; nothing needs reinstalling after an edit.

### 4. Everyday uv commands

| Command | What it does |
|---|---|
| `uv sync` | Install the locked set into `.venv`, creating it if needed. Run after every pull. |
| `uv sync --locked` | Same, but fails if `uv.lock` is stale instead of relocking. Used by CI. |
| `uv sync --no-default-groups` | Runtime dependencies only, without the `dev` QA tools. |
| `uv run <cmd>` | Run `<cmd>` inside `.venv` — `uv run pytest`, `uv run ruff check app`. |
| `uv run yoir-dev` | Build the web frontend if stale, then serve it and the API together. |
| `uv add <pkg>` | Add a runtime dependency, updating `pyproject.toml` **and** `uv.lock`. |
| `uv add --group dev <pkg>` | Add a QA-only dependency. |
| `uv remove <pkg>` | Drop a dependency and relock. |
| `uv lock --upgrade` | Re-resolve everything to the newest allowed versions. Review the diff. |
| `uv tree` | Show the resolved dependency tree. |

Commit `uv.lock` whenever it changes — a reviewed lock diff is how the team sees a dependency
move. Do not hand-edit it.

## Connect the frontend

In `frontend/` (the Expo app), set `.env`:

```text
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8000/api/v1
EXPO_PUBLIC_USE_DEMO_API=false
```

Use your machine's LAN IP (not `localhost`) so a phone or emulator can reach it.

## Serving the frontend

One deployment serves both halves. `expo export --platform web` writes a static site — one
HTML document per route beside hashed JavaScript and images — and `app/frontend.py` mounts it
at `/`, after every router, so it only ever receives paths the API did not claim. A path under
`/api/` that no route matched stays a JSON `NOT_FOUND` rather than falling back to the app
shell.

Expo keeps dynamic routes as literal bracket names on disk, so `/services/svc_1/timeslots` is
served by `static/services/[serviceId]/timeslots.html`. Deep links and browser refreshes are
resolved segment by segment against that layout, and anything unmatched gets Expo's
`+not-found.html` with a 404.

Locally, `uv run yoir-dev` does the build for you. The equivalent by hand is:

```bash
EXPO_PUBLIC_API_URL=/api/v1 npm --prefix ../frontend run build:web
rm -rf static && mv ../frontend/dist/web static
uv run fastapi dev app/main.py
```

The build calls the API at the same origin, so `EXPO_PUBLIC_API_URL` is the path `/api/v1`
rather than an absolute URL, and no deployed hostname is baked into the bundle. `FRONTEND_DIST`
overrides the directory. With no build on disk the mount is skipped and the API runs on its
own, which is how the backend CI job and the test suite run.

`EXPO_PUBLIC_*` values are inlined into the bundle at transform time and Metro caches the
result, so a build can otherwise reuse a URL from an earlier run — `frontend/.env` points at
the deployed API, which would then be baked into a local build without a word. `build:web`
passes `--clear` for exactly that reason; keep it there.

## Deploy to FastAPI Cloud

The backend is deployed with [FastAPI Cloud](https://fastapicloud.com). The `fastapi` CLI
ships in the `fastapi[standard]` dependency, so it is already in the synced environment —
no separate install.

```bash
cd backend
uv run fastapi login          # once per machine
uv run fastapi deploy
```

That is the manual path; merges into `dev` deploy on their own, see below.

FastAPI Cloud builds from `pyproject.toml` and installs the exact versions in `uv.lock`, so a
deployed build matches a local `uv sync`. It autodetects `app/main.py` and the `app` object.

`fastapi deploy` writes `.fastapicloud/cloud.json` (the app and team IDs). That directory
ships its own `.gitignore` containing `*`, so it is deliberately **not** committed — each
person links their own checkout.

### Automatic deploys from `dev`

[`.github/workflows/deploy-dev.yml`](../.github/workflows/deploy-dev.yml) redeploys on every
merge into `dev` that touches `backend/**` or `frontend/**`, and can also be run by hand from
the Actions tab. It exports the web build into `backend/static`, installs with
`uv sync --locked --no-default-groups` (runtime dependencies only, no QA tooling) and then runs
`uv run fastapi deploy` from `backend/`.

### How the web build reaches the upload

`fastapi deploy` walks the upload with [rignore](https://pypi.org/project/rignore/), which
honours every `.gitignore` in the tree — this directory's and the repository root's. The build
is generated and never committed, so `static/` is git-ignored, and its own asset tree contains
an `assets/node_modules/` directory the root `.gitignore` excludes as well. Either rule alone
would drop files from the upload **silently**, deploying an API with a missing or half-broken
frontend.

`.fastapicloudignore` whitelists both back in, and whitelists there take precedence over
`.gitignore`:

```text
!static/
!static/**
```

The workflow checks this rather than trusting it: before deploying it walks the archive the
way the CLI does and fails if any built file is missing from it.

It needs two repository secrets:

| Secret | What it is |
|---|---|
| `FASTAPI_CLOUD_TOKEN` | A deploy token. The CLI uses it instead of an interactive login. |
| `FASTAPI_CLOUD_APP_ID` | The app ID. Needed because `.fastapicloud/cloud.json` is not committed. |

The CLI provisions both for you — run it from `backend/`, where the app is linked:

```bash
cd backend
uv run fastapi cloud setup-ci --branch dev --secrets-only
```

`--secrets-only` creates the token and sets the two secrets without writing a workflow file,
since `deploy-dev.yml` already exists and pins its actions by commit SHA the way the rest of
this repository does. If the [`gh` CLI](https://cli.github.com) is not installed the command
prints both values instead, to paste into **Settings → Secrets and variables → Actions**.

Deploy tokens expire after 365 days; re-run the command before then to rotate.

The workflow deploys whatever landed on `dev` without waiting for Application CI to go green —
the two run in parallel on the same push. To deploy only after tests pass, change the trigger
to a `workflow_run` on `Application CI` with `types: [completed]` and gate the job on
`github.event.workflow_run.conclusion == 'success'`.

### Deployed configuration

Set these in the FastAPI Cloud dashboard, not in a committed file. `.env` is local-only and
is not uploaded.

| Variable | Deployed value |
|---|---|
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DBNAME` — same `postgresql://` scheme as local |
| `JWT_SECRET` | A real secret of at least 32 bytes. Never the `.env.example` placeholder. |
| `CORS_ALLOW_ORIGINS` | The deployed frontend origin, not `*`. The bundled web build is same-origin and needs no entry; this is for any other client. |
| `SEED_ON_STARTUP` | `false` once the database holds real data |

The defaults in `app/config.py` — wildcard CORS, automatic seed and a placeholder JWT secret —
are for local development only and are a recorded QA finding; override all four.

The deployed web build reaches the API at the same origin, so it needs no `EXPO_PUBLIC_API_URL`
of its own. Point a *local* Expo app at the deployment by setting `EXPO_PUBLIC_API_URL` in
`frontend/.env` to `https://<your-app>.fastapicloud.dev/api/v1`.

## Structure

```text
app/
  main.py         FastAPI app, CORS, lifespan (create tables + seed), web build mount
  config.py       env-driven settings (Pydantic Settings)
  db.py           engine + get_db session dependency
  security.py     Argon2 hashing, JWT access tokens
  errors.py       ApiError + handlers -> the openapi.yaml Error shape
  models.py       SQLAlchemy 2.0 models (User, Service)
  schemas.py      Pydantic request/response models, camelCase on the wire
  seed.py         demo counsellors + services
  frontend.py     serves the exported Expo web build at "/"
  dev.py          `yoir-dev` — local build-then-serve launcher
  routers/        health, auth, services
static/           the exported web build (generated, git-ignored, not committed)
```

## Deliberate skeleton shortcuts (next slices)

- **Alembic** migrations — skeleton calls `create_all()` on startup instead.
- **Refresh tokens / logout** (US-08), bearer-auth dependency for protected routes.
- **Tests / CI** — owned by QA; not in this skeleton.
