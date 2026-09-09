"""QA checks for the exported Expo web build served at "/" beside the API."""

from __future__ import annotations

from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.errors import register_error_handlers
from app.frontend import BACKEND_ROOT, dist_directory, mount_frontend

# The layout `expo export --platform web` produces for this app: one document
# per route, dynamic segments kept as literal `[param]` names on disk.
BUILD_LAYOUT = (
    "index.html",
    "+not-found.html",
    "_sitemap.html",
    "auth/login.html",
    "auth/register.html",
    "bookings/confirmation.html",
    "marketplace/index.html",
    "services/[serviceId].html",
    "services/[serviceId]/timeslots.html",
    "_expo/static/js/web/entry-abc123.js",
    "favicon.ico",
)


@pytest.fixture
def build(tmp_path: Path) -> Path:
    """A stand-in export whose every file contains its own relative path."""

    for relative in BUILD_LAYOUT:
        document = tmp_path / relative
        document.parent.mkdir(parents=True, exist_ok=True)
        document.write_text(relative)
    return tmp_path


@pytest.fixture
def web_client(build: Path) -> Iterator[TestClient]:
    app = FastAPI()
    router = APIRouter()

    @router.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    app.include_router(router, prefix="/api/v1")
    register_error_handlers(app)
    assert mount_frontend(app, build)
    with TestClient(app) as test_client:
        yield test_client


@pytest.mark.parametrize(
    ("route", "document"),
    [
        ("/", "index.html"),
        ("/marketplace", "marketplace/index.html"),
        ("/marketplace/", "marketplace/index.html"),
        ("/auth/login", "auth/login.html"),
        ("/auth/register", "auth/register.html"),
        ("/bookings/confirmation", "bookings/confirmation.html"),
        ("/services/svc_1", "services/[serviceId].html"),
        ("/services/svc_1/timeslots", "services/[serviceId]/timeslots.html"),
    ],
)
def test_route_resolves_to_its_exported_document(
    web_client: TestClient, route: str, document: str
) -> None:
    """A deep link or browser refresh gets the document Expo exported for it."""

    response = web_client.get(route)

    assert response.status_code == 200
    assert response.text == document


def test_hashed_assets_are_served_verbatim(web_client: TestClient) -> None:
    response = web_client.get("/_expo/static/js/web/entry-abc123.js")

    assert response.status_code == 200
    assert response.text == "_expo/static/js/web/entry-abc123.js"


def test_unknown_route_serves_the_not_found_document(web_client: TestClient) -> None:
    response = web_client.get("/no/such/route")

    assert response.status_code == 404
    assert response.text == "+not-found.html"


def test_api_health_is_not_shadowed_by_the_mount(web_client: TestClient) -> None:
    response = web_client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unmatched_api_path_keeps_the_json_error_shape(web_client: TestClient) -> None:
    """The app shell must never stand in for a missing API route."""

    response = web_client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


def test_encoded_traversal_is_refused(web_client: TestClient, build: Path) -> None:
    (build.parent / "outside.txt").write_text("outside")

    response = web_client.get("/%2e%2e/outside.txt")

    assert response.status_code == 404
    assert "outside" not in response.text


def test_mount_is_skipped_when_no_build_has_been_exported(tmp_path: Path) -> None:
    app = FastAPI()

    assert mount_frontend(app, tmp_path / "static") is False


def test_dist_directory_resolves_against_the_backend_root(tmp_path: Path) -> None:
    assert dist_directory("static") == BACKEND_ROOT / "static"
    assert dist_directory(str(tmp_path)) == tmp_path
