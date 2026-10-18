# Handover — Yoir

**Team CSD-Koala · SWEN90014 Semester 2, 2026 · Prepared 18 October 2026, at the end of Sprint 3**

This is the starting point for the client's representatives who will continue developing or deploy Yoir. It records what is handed over, when and how it was delivered, and how to run, configure and deploy the system. The detail lives in the documents it links to.

**Client:** Saumil Macwan (Sam). **Handover agreed:** 16 October 2026, Week 11 client meeting, decision 3 ([minutes](meeting-minutes/Client%20Meeting/2026-10-16-client-meeting.md)): the team copies the repository, history and documents included, into an empty GitHub repository Sam creates, and also sends a zip of the final version. The current repository cannot be transferred, because it belongs to the organisation that created it. **Acceptance session:** 23 October 2026.

---

## 1. Delivery record

Fill in each row on the day it happens, with the date, the link or file name, and how the client confirmed receipt.

| # | What | How | To | Owner | Date delivered | Client confirmation | Status |
|---|---|---|---|---|---|---|---|
| D1 | Empty GitHub repository for the handover | Created by Sam and shared with the team | Team | Sam | | | Not yet done |
| D2 | Full copy of this repository: code, history, branches and `docs/` | Pushed into Sam's repository (all branches, so `dev` and `main` both arrive) | Sam's repository | Jared | | | Not yet done |
| D3 | Project wiki (requirements, design, process, minutes, walkthroughs) | The wiki is a separate Git repository (`SWEN90014-2026-CSD-Koala.wiki.git`); push it into the new repository's wiki, or include it in the zip | Sam's repository or zip | Jared | | | Not yet done |
| D4 | Zip of the final version, with set-up documentation (this file, the READMEs and the deployment guide) | Sent to Sam | Sam | Jared | | | Not yet done |
| D5 | Feature walkthrough as a PDF, and the demo video | Sent with the update email (Week 11 action 3) | Sam | Jared, Manu | | | Not yet done |
| D6 | External accounts and their secrets (§6) | Agreed per account with Sam: transferred, or recreated under the client's ownership. Secrets go by a private channel, never in the repository or the zip | Sam | Team | | | Not yet done |
| D7 | Acceptance demonstration video, filmed from the audience | Uploaded as a playable video file to the team development space after the session | Team space | Team | | | Not yet done |

---

## 2. What is handed over

| Artefact | Where |
|---|---|
| Application source: Expo / React Native front end (iOS, Android and web) and FastAPI back end | [`frontend/`](../../frontend/), [`backend/`](../../backend/) |
| Database migrations and seed data | [`backend/migrations/`](../../backend/migrations/), [`backend/app/seed_data.json`](../../backend/app/seed_data.json) |
| Tests and CI: Jest, Playwright, pytest, repository checks, and the GitHub Actions workflows | [`frontend/__tests__/`](../../frontend/__tests__/), [`frontend/e2e/`](../../frontend/e2e/), [`backend/tests/`](../../backend/tests/), [`scripts/`](../../scripts/), [`.github/workflows/`](../../.github/workflows/) |
| API contract: OpenAPI, interface rules and a traceability file with each operation's implementation status | [`docs/sprint1/executable-architecture/`](../sprint1/executable-architecture/) |
| Design: design concept, architecture diagram and database schema | [`docs/sprint1/design-by-concept/`](../sprint1/design-by-concept/) |
| Requirements, product backlog and risk register at the end of Sprint 3 | [`docs/sprint3/project/`](project/) |
| Per-story delivery documents | [`docs/sprint3/frontend/`](frontend/), [`docs/sprint3/backend/`](backend/) |
| Verification and validation: test approach, QA matrix, results and evidence | [`docs/sprint3/qa/`](qa/) |
| Feature walkthroughs, phone and desktop | [`docs/sprint3/walkthrough/`](walkthrough/) |
| Sprint 3 review, retrospective, planning, process insights, AI usage log and meeting minutes | [`docs/sprint3/client-feedback/`](client-feedback/), [`docs/sprint3/process/`](process/), [`docs/sprint3/meeting-minutes/`](meeting-minutes/) |
| Deployment guide and payment specification | [`docs/deployment/dev-environment.md`](../deployment/dev-environment.md), [`docs/payment/stripe-payment-spec.md`](../payment/stripe-payment-spec.md) |

---

## 3. The system at handover

- **Scope delivered:** 43 active stories across accounts and profiles, the Yoir Diagnosis and direction, Career Professional verification and services, availability and booking, sandbox payment, bookings, reviews and ratings, and Platform Owner oversight. Sprint 3's 23 stories are listed with their evidence in the [Sprint 3 Review](client-feedback/sprint-3-review-and-client-feedback.md).
- **Branches:** `dev` holds the current build; the last application change is commit `8713b38` (17 October 2026), and later commits are documentation only. `main` was brought up to date with `dev` on 18 October 2026 (PR #247), so both branches hold the Sprint 3 build.
- **Not built this semester:** the Forum, order-linked messaging and disputes (Requirements RR-08, RR-20), live payouts and refunds outside Stripe test mode, in-app notifications (US-60, US-61), and App Store or Google Play release.
- **Platforms:** one Expo codebase for iOS and Android, run in Expo Go during development. The web export is served by the back end for demonstrations, with a desktop layout at 1024 px and wider. There is no EAS build configuration yet.

---

## 4. Run it locally

The full instructions are in the [root README](../../README.md#run-the-backend), [backend/README.md](../../backend/README.md) and [frontend/README.md](../../frontend/README.md). In short:

```bash
# Back end: needs uv and a PostgreSQL server (or `docker compose up -d` in backend/)
cd backend
uv sync
cp .env.example .env               # set DATABASE_URL, JWT_SECRET, ADMIN_EMAIL and ADMIN_PASSWORD
uv run python reset_db.py          # schema from migrations, plus the seed data
uv run fastapi dev app/main.py     # API at http://localhost:8000/api/v1, docs at /docs

# Front end: needs Node.js 20
cd frontend
npm ci
cp .env.example .env               # EXPO_PUBLIC_API_URL=http://<your-lan-ip>:8000/api/v1
npm start
```

`uv run yoir-dev` in `backend/` builds the web app and serves it with the API on one address. Without Stripe keys, checkout uses a labelled payment stub; without a Mailgun key, emails are written to the log.

**Tests:** the commands are in the [root README](../../README.md#test). CI runs the same checks on every push and pull request ([`.github/workflows/app-ci.yml`](../../.github/workflows/app-ci.yml)). The database test fixtures refuse to reset any PostgreSQL database whose name does not end in `_test`.

---

## 5. Deploy it

The team's deployment is a private demonstration environment: the API and the web build on **FastAPI Cloud**, the database on **Neon** PostgreSQL. [`.github/workflows/deploy-dev.yml`](../../.github/workflows/deploy-dev.yml) deploys it on every push to `dev` that touches `backend/` or `frontend/`. The step-by-step guide is [docs/deployment/dev-environment.md](../deployment/dev-environment.md).

To deploy under the client's own accounts:

1. Create a PostgreSQL database (the guide uses Neon; use its direct endpoint, not the pooler) and a FastAPI Cloud app, or any host that runs a FastAPI app.
2. In the new GitHub repository, add the Actions secrets `FASTAPI_CLOUD_APP_ID` and `FASTAPI_CLOUD_TOKEN`, or replace the deploy step with the chosen host's.
3. Set the environment variables in §6 on the host. Migrations run automatically on start-up.
4. Check `GET /api/v1/health`, then log in as the Platform Owner created from `ADMIN_EMAIL` and `ADMIN_PASSWORD`, and change that password in the app.
5. **Payments:** the build uses Stripe in test mode behind one gateway module (`backend/app/payments/gateway.py`). Going live is a key swap, but it needs a Stripe account owned by the business, Stripe Connect onboarding for each Career Professional, and the open commercial decisions in §7.
6. **Email:** Mailgun's sandbox only delivers to authorised recipients. Production needs a verified sending domain.
7. **Mobile release:** add an EAS configuration (`eas.json`), build profiles and signing before any TestFlight or store build (Risk Register R-04).

---

## 6. Configuration, secrets and accounts

**Environment variables.** The back end reads its settings from the environment; [`backend/.env.example`](../../backend/.env.example) lists every variable with a comment, and marks the ones whose local default is unsafe for a deployment with `[deploy]`. The front end needs only `EXPO_PUBLIC_API_URL` ([`frontend/.env.example`](../../frontend/.env.example)).

| Group | Variables | Secret? |
|---|---|---|
| Database | `DATABASE_URL` | Yes |
| Sessions | `JWT_SECRET`, `JWT_ALGORITHM`, token lifetimes | `JWT_SECRET` is |
| First Platform Owner | `ADMIN_EMAIL`, `ADMIN_PASSWORD` | `ADMIN_PASSWORD` is |
| Web and links | `APP_BASE_URL`, `APP_WEB_URL`, `WEB_APP_BASE_URL`, `FRONTEND_DIST`, `CORS_ALLOW_ORIGINS`, `APP_DEEP_LINK_SCHEME` | No |
| Email | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_BASE_URL`, `MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS` | `MAILGUN_API_KEY` is |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` | All except the publishable key |
| Commercial settings | `PLATFORM_FEE_PERCENT`, `COMMISSION_BASE`, `PLATFORM_GST_REGISTERED`, `PLATFORM_ABN`, `PLATFORM_LEGAL_NAME`, `MERCHANT_DISPLAY_NAME`, cancellation and payout settings | No, but the values are placeholders until the client decides them (§7) |
| Other | `SEED_ON_STARTUP`, `JITSI_BASE_URL`, `PAYMENT_JOBS_ENABLED`, `PAYMENT_JOBS_INTERVAL_SECONDS`, `SLOT_HOLD_MINUTES` | No |

**Before going live** (Risk Register R-07): set a new random `JWT_SECRET` (the code's default is a development placeholder), restrict `CORS_ALLOW_ORIGINS` to the deployed origin, set `SEED_ON_STARTUP=false` (the seed accounts share a published password), and consider disabling the interactive API docs at `/docs`, which are on by default (`backend/app/main.py`). The team's deployment guide currently contains the demonstration environment's admin login; remove it from the repository before the copy in D2 and rotate that password.

**External accounts used by the team**

| Service | Used for | Set up by | At handover (D6) |
|---|---|---|---|
| GitHub (organisation `swen90014-2026-sm2`) | Repository, wiki, project board, Actions | The teaching team's organisation | Cannot be transferred; copied into Sam's repository (D2, D3) |
| FastAPI Cloud | Hosts the API and the web build | Jashan (9 September stand-up) | Recreate under the client's account, or agree a transfer; rotate `FASTAPI_CLOUD_TOKEN` |
| Neon | PostgreSQL database | Jashan (9 September stand-up) | Recreate or transfer |
| Stripe (test mode) | Payments and Connect payouts | Team, during US-47 | The client opens their own business account; test keys are not reused |
| Mailgun (sandbox) | Transactional email | Jashan (16 September stand-up) | The client sets up their own account and verified domain |
| Jitsi Meet (`meet.jit.si`) | Session rooms | No account | Nothing to hand over; a self-hosted or paid service can replace it (`JITSI_BASE_URL`) |

---

## 7. Known limitations and open decisions

The full list, with evidence, is in the [Sprint 3 Review §7](client-feedback/sprint-3-review-and-client-feedback.md#7-known-limitations-and-open-items) and the [Risk Register](project/risk-register.md). The ones that most affect the next team:

| Item | State | Record |
|---|---|---|
| Diagnosis questions and direction rules | The team's version 1; Sam is rewriting the questions. Both are versioned and kept in `backend/app/diagnosis.py`, so a new set is a contained change | Requirements RR-13, RR-14; R-06 |
| Commission, payouts and refunds | Test values in code, not client policy | RR-19; R-03 |
| Reschedule policy and the overall-rating rule | Not decided | RR-17, RR-18 |
| Deferred features | Forum, order-linked messaging, disputes; requirements kept so they can be restored | RR-08, RR-20 |
| Security defaults and dependencies | See §6; GitHub Dependabot reports open alerts on the default branch | R-07, R-08 |
| Hosting limits | Neon drops idle connections after about 5 minutes; no rate limiting; free-tier limits unconfirmed | R-09 |
| Open QA findings | Advisory failures and strict expected failures are kept visible in the test suites | [QA matrix](qa/qa-matrix.md) |

---

## 8. Continuing development

- Read [Design by Concept](../sprint1/design-by-concept/design-by-concept.md) for the architecture and its reasons, and [interface-contract.md](../sprint1/executable-architecture/interface-contract.md) with [openapi.yaml](../sprint1/executable-architecture/openapi.yaml) for the API.
- The team's workflow: feature branches off `dev`, a pull request with a reviewer, Application CI green before merge; `main` only after client and QA sign-off ([root README](../../README.md#branching-and-code-workflow)).
- Keep `openapi.yaml` and `interface-traceability.csv` in step with the routers; `scripts/check_repository_metadata.py` fails CI when they drift.
- Team members and roles are on the wiki's [Team Details](https://github.com/swen90014-2026-sm2/SWEN90014-2026-CSD-Koala/wiki/Team-Details) page.
