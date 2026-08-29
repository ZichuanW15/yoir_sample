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

Prerequisites: Python 3.11+ (3.12 per the design concept) and a running **PostgreSQL**.

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
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set DATABASE_URL for your Postgres
uvicorn app.main:app --reload
```

- `DATABASE_URL` in `.env` — e.g. `postgresql+psycopg://evelyn@localhost:5433/yoir`
  (Postgres.app) or `postgresql+psycopg://yoir:yoir@localhost:5432/yoir` (docker compose).
- API root: `http://localhost:8000/api/v1` · interactive docs: `http://localhost:8000/docs`
- First start creates the tables and seeds job seekers, counsellors and services from
  `app/seed_data.json` plus three future time slots per service.
- The payment stub is deliberately labelled, collects no card data and charges no real money.
- **Reset / reseed the database any time** (no web server needed):
  ```bash
  python reset_db.py
  ```
  Drops and recreates every table in `DATABASE_URL`, then reloads `app/seed_data.json`.
- Seed logins (password `password123`): job seekers `alex@example.com`, `sam@example.com`;
  counsellors `maya@example.com`, `jordan@example.com`, `priya@example.com`, `tom@example.com`.

## Connect the frontend

In the repo root (the Expo app), set `.env`:

```text
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8000/api/v1
EXPO_PUBLIC_USE_DEMO_API=false
```

Use your machine's LAN IP (not `localhost`) so a phone or emulator can reach it.

## Structure

```text
app/
  main.py         FastAPI app, CORS, lifespan (create tables + seed)
  config.py       env-driven settings (Pydantic Settings)
  db.py           engine + get_db session dependency
  security.py     Argon2 hashing, JWT access tokens
  errors.py       ApiError + handlers -> the openapi.yaml Error shape
  models.py       SQLAlchemy 2.0 models (User, Service)
  schemas.py      Pydantic request/response models, camelCase on the wire
  seed.py         demo counsellors + services
  routers/        health, auth, services
```

## Deliberate skeleton shortcuts (next slices)

- **Alembic** migrations — skeleton calls `create_all()` on startup instead.
- **Refresh tokens / logout** (US-08), bearer-auth dependency for protected routes.
- **Tests / CI** — owned by QA; not in this skeleton.
