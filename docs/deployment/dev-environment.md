# Deploying the dev environment (FastAPI Cloud + Neon)

One deployment serves both halves: the API at `/api/v1`, and the exported Expo web
build at `/`. The GitHub Actions workflow `deploy-dev.yml` builds the web bundle into
`backend/static` and runs `fastapi deploy`, so a push to `dev` is the whole process.

Stripe and Mailgun are both in **test/sandbox** mode here. Neither takes real money nor
reaches real inboxes, and both have a specific catch worth knowing before you debug
something that is working as designed — see *Sandbox limits* below.

## 1. The database

Migrations run automatically at startup, so nothing is applied by hand. What happens on
boot depends on the state of the database:

| State of the database | What startup does |
|---|---|
| Empty | Creates the whole schema from migrations |
| Has migration history | Applies whatever is outstanding |
| Has tables, no history, matches the old pre-Alembic schema | Stamps the baseline, then upgrades |
| Has tables, no history, matches nothing known | **Refuses to start**, rather than guess |

### Standing the environment up (once)

The dev environment gets **its own Neon branch**, so that resetting it cannot touch the
shared database the team works against.

1. In the Neon console, create a branch of `main` — call it `dev`. Copy its connection
   string, taking the endpoint **without** `-pooler`.
2. A Neon branch starts as a copy-on-write clone, so it arrives holding a copy of
   whatever `main` had. That is fine and is the reason this order is safe: the reset
   below runs against the branch, and `main` is never opened.
3. Reset the branch.

The reset destroys everything in the target database and is not recoverable. Point it
at the branch, never at `main`.

```bash
cd backend
DATABASE_URL='postgresql://USER:PASSWORD@ep-....neon.tech/neondb?sslmode=require' \
YOIR_CONFIRM_DESTROY_HOST='ep-....neon.tech' \
ADMIN_EMAIL='admin@yoir.app' \
ADMIN_PASSWORD='admin@123' \
uv run python reset_deployment_db.py
```

It prints every table and row count it is about to destroy, then refuses unless
`YOIR_CONFIRM_DESTROY_HOST` matches the host exactly. That guard is deliberate: the
realistic way to destroy the wrong database is a stale `DATABASE_URL`, and a yes/no
prompt catches none of them. **Read the host it prints before you set that variable** —
a branch and `main` differ only by the endpoint id. Afterwards the database holds the
current schema, the administrator, and nothing else.

**Run this once.** Every deployment after it upgrades in place and preserves data.

### Use the direct Neon endpoint, not the pooler

Neon gives two hostnames. Use the one **without** `-pooler` for `DATABASE_URL`:
startup migrations issue DDL, and a transaction-pooled connection is the wrong place
for that. The pooler exists for serverless callers that open a connection per request,
which this deployment is not.

## 2. Environment variables

Set these on the FastAPI Cloud app. Anything omitted falls back to the local-development
default in `app/config.py`, which is wrong for a deployment in several cases.

### Required

| Variable | Value | Why it matters |
|---|---|---|
| `DATABASE_URL` | Neon direct endpoint, `?sslmode=require` | |
| `JWT_SECRET` | 32+ random bytes, not the placeholder | The placeholder is in the repository; anyone could mint a session |
| `CORS_ALLOW_ORIGINS` | The deployed origin | The bundled web build is same-origin and needs no entry; `*` is for local work only |
| `SEED_ON_STARTUP` | `false` | Otherwise demo counsellors and services appear, with a password published in this repository |
| `ADMIN_EMAIL` | `admin@yoir.app` | Nothing else can create a `platform_owner`; registration never grants that role |
| `ADMIN_PASSWORD` | `admin@123` | Only used when the account does not exist. Changing the password in the app survives redeploys |
| `APP_BASE_URL` | `https://<app>.fastapicloud.dev` | Where Stripe returns counsellors after Connect onboarding |
| `APP_WEB_URL` | `https://<app>.fastapicloud.dev` | **Links inside every email point here.** Left at its local default, confirmation and reset links arrive pointing at `localhost` and cannot work |
| `WEB_APP_BASE_URL` | *(empty)* | Empty means the backend serves the web build itself, which is true here |
| `FRONTEND_DIST` | `static` | Where the workflow puts the built bundle |

### Stripe (test mode)

| Variable | Where it comes from |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` — served to the app over `GET /payments/config`, designed to be public |
| `STRIPE_WEBHOOK_SECRET` | A **webhook endpoint in the Stripe dashboard**, not `stripe listen` |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | A second endpoint, for connected-account events |
| `APP_DEEP_LINK_SCHEME` | `yoir` — must match `scheme` in `frontend/app.json` |

The two webhook endpoints are the part that is easy to miss, and the failure is quiet:
**without them the platform takes the money and never confirms a booking.** A booking
exists only once `payment_intent.succeeded` has been accepted, and every unverified
webhook is rejected with a 400. The `stripe listen` secrets in `backend/.env` are for a
local CLI session and are useless to a deployment.

Create them in the Stripe dashboard pointing at:

```
https://<app>.fastapicloud.dev/api/v1/payments/stripe/webhook           (account events)
https://<app>.fastapicloud.dev/api/v1/payments/stripe/webhook/connect   (connected-account events)
```

Each endpoint has its own signing secret, and each refuses the other's.

### Mailgun (sandbox)

| Variable | Value |
|---|---|
| `MAILGUN_API_KEY` | The private API key |
| `MAILGUN_DOMAIN` | `sandbox….mailgun.org` |
| `MAIL_FROM_NAME` | `Yoir` |
| `MAIL_FROM_ADDRESS` | *(empty — defaults to `postmaster@<domain>`)* |

Leave `MAILGUN_API_KEY` empty and the application logs each message instead of sending
it, which is a legitimate way to run the environment without mail.

### Optional

`JITSI_BASE_URL` (default `https://meet.jit.si`), and the commission and policy settings
listed in `backend/.env.example`. Each order freezes its own copy of the split, so
changing a rate never rewrites a booking already made.

## 3. Sandbox limits

These are the two behaviours that look like bugs and are not.

**Mailgun sandbox delivers only to Authorised Recipients.** Mail to any other address is
accepted by the API and then silently dropped. Every tester's address has to be added in
the Mailgun dashboard and confirmed by them. The server logs a warning at startup
whenever it is on a sandbox domain, and again for each message.

**Stripe test mode** takes only test cards (`4242 4242 4242 4242`). Counsellors still
have to complete Connect onboarding before anyone can book them: an order is refused
with `COUNSELLOR_PAYOUTS_UNAVAILABLE` when the counsellor cannot be paid, because money
we cannot pass on should not be taken.

## 4. After deploying

```bash
curl https://<app>.fastapicloud.dev/api/v1/health      # {"status":"ok"}
```

Then sign in as `admin@yoir.app` — the app sends a `platform_owner` straight to `/admin`.
The overview should show zeros everywhere and no counsellors, which is what confirms the
environment started from nothing.

Worth checking in the logs on first boot:

- `Empty database: creating the schema from migrations.`
- `Created the administrator account admin@yoir.app …`
- `Mail is on the Mailgun SANDBOX domain …`

If mail is misconfigured the startup line says so explicitly rather than failing later:
sending never raises, because booking confirmation runs inside the Stripe webhook and a
non-2xx there would make Stripe redeliver the event and re-confirm the booking.

## 5. Known gaps

- `ADMIN_PASSWORD` puts a password in configuration. Acceptable for a dev environment,
  not for one holding real accounts — change it in the app and clear the variable.
- Not every email is written yet. Sent today: address confirmation, password reset,
  verification decision, booking confirmation (job seeker) and new booking (counsellor).
  Cancellation, refund, payout and the monthly commission statement still only log.
