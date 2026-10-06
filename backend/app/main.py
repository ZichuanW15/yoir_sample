from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import SessionLocal, engine
from app.errors import register_error_handlers
from app.frontend import dist_directory, mount_frontend
from app.mail import sender as mail_sender
from app.migrations import upgrade_database
from app.payments.scheduler import payment_jobs
from app.routers import (
    admin,
    auth,
    bookings,
    counsellor,
    diagnosis,
    health,
    job_seeker,
    payments,
    services,
    webhooks,
)
from app.seed import ensure_platform_owner, seed

settings = get_settings()
API_V1 = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Migrations, not create_all: a new column on an existing table has to reach the
    # database before the first request needs it, and create_all never did that.
    upgrade_database(engine)
    # Said once, up front: mail failures are deliberately silent at send time.
    mail_sender.report_configuration(settings)
    with SessionLocal() as db:
        # Before the demo data and independent of it: a deployment turns seeding
        # off, and would otherwise have no way into the administration area.
        ensure_platform_owner(db)
        if settings.seed_on_startup:
            seed(db)
    # Hold expiry, session completion and counsellor payouts (payments spec §9).
    async with payment_jobs():
        yield


app = FastAPI(
    title="Yoir API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"]
    if settings.cors_allow_origins == "*"
    else [o.strip() for o in settings.cors_allow_origins.split(",")],
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

app.include_router(health.router, prefix=API_V1)
app.include_router(auth.router, prefix=API_V1)
app.include_router(services.router, prefix=API_V1)
app.include_router(bookings.router, prefix=API_V1)
app.include_router(counsellor.router, prefix=API_V1)
app.include_router(job_seeker.router, prefix=API_V1)
app.include_router(diagnosis.router, prefix=API_V1)
app.include_router(admin.router, prefix=API_V1)
app.include_router(payments.router, prefix=API_V1)

# Stripe's own callbacks, at the paths the published contract already reserves for
# them. They carry no bearer token — a Stripe-Signature over the raw body is what
# authenticates them — and their URLs are registered in the Stripe dashboard and in
# `stripe listen --forward-to`, so changing them means updating both.
app.include_router(webhooks.router, prefix=API_V1)

# Last, so "/" only receives the paths the routers above did not claim: the
# exported Expo web build, served from the same origin as the API it calls.
mount_frontend(app, dist_directory(settings.frontend_dist))
