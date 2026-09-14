from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import Base, SessionLocal, engine
from app.errors import register_error_handlers
from app.frontend import dist_directory, mount_frontend
from app.routers import auth, bookings, counsellor, health, services
from app.seed import seed

settings = get_settings()
API_V1 = "/api/v1"


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Skeleton: create tables directly. Alembic migrations are the next slice
    # (see design-concept.md §5 / §6).
    Base.metadata.create_all(bind=engine)
    if settings.seed_on_startup:
        with SessionLocal() as db:
            seed(db)
    yield


app = FastAPI(
    title="Yoir API — executable-architecture skeleton",
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

# Last, so "/" only receives the paths the routers above did not claim: the
# exported Expo web build, served from the same origin as the API it calls.
mount_frontend(app, dist_directory(settings.frontend_dist))
