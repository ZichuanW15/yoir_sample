"""Serve the exported Expo web build from the same origin as the API.

`expo export --platform web` (app.json sets `web.output: "static"`) writes a
static site: one HTML document per route, beside hashed JavaScript and images
under `_expo/` and `assets/`. Dynamic routes keep their bracket names on disk,
so `/services/svc_1/timeslots` is served by
`services/[serviceId]/timeslots.html` — a deep link or a browser refresh has to
be resolved segment by segment rather than by a plain file lookup.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Scope

BACKEND_ROOT = Path(__file__).resolve().parents[1]

# The routers own this prefix. A path under it that no route matched is a real
# 404 and must keep the JSON error shape from app/errors.py, not the app shell.
API_PREFIX = "api"

INDEX_DOCUMENT = "index.html"
NOT_FOUND_DOCUMENT = "+not-found.html"


def dist_directory(configured: str) -> Path:
    """Resolve the configured build directory against the backend root."""

    path = Path(configured).expanduser()
    return path if path.is_absolute() else BACKEND_ROOT / path


def _segments(path: str) -> list[str]:
    return [segment for segment in path.split("/") if segment not in ("", ".")]


def _candidate_names(directory: Path, segment: str) -> list[str]:
    """The literal segment, then any `[param]` placeholder Expo wrote here."""

    if not directory.is_dir():
        return [segment]
    placeholders = {
        entry.name[: -len(".html")] if entry.suffix == ".html" else entry.name
        for entry in directory.iterdir()
        if entry.name.startswith("[")
    }
    return [segment, *sorted(placeholders - {segment})]


def resolve_document(root: Path, segments: list[str]) -> str | None:
    """Return the build-relative HTML document for a route, or None."""

    if not segments:
        return INDEX_DOCUMENT if (root / INDEX_DOCUMENT).is_file() else None

    head, *rest = segments
    for name in _candidate_names(root, head):
        if rest:
            nested = resolve_document(root / name, rest)
            if nested is not None:
                return f"{name}/{nested}"
        elif (root / f"{name}.html").is_file():
            return f"{name}.html"
        elif (root / name / INDEX_DOCUMENT).is_file():
            return f"{name}/{INDEX_DOCUMENT}"
    return None


class ExpoWebFiles(StaticFiles):
    """Static files, falling back to Expo Router's per-route HTML documents."""

    async def get_response(self, path: str, scope: Scope) -> Response:
        segments = _segments(path)
        if segments[:1] == [API_PREFIX] or ".." in segments:
            raise HTTPException(status_code=404, detail="Not Found")

        root = Path(self.directory)
        if segments and root.joinpath(*segments).is_file():
            return await super().get_response("/".join(segments), scope)

        document = resolve_document(root, segments)
        if document is not None:
            return await super().get_response(document, scope)

        if (root / NOT_FOUND_DOCUMENT).is_file():
            response = await super().get_response(NOT_FOUND_DOCUMENT, scope)
            response.status_code = 404
            return response
        raise HTTPException(status_code=404, detail="Not Found")


def mount_frontend(app: FastAPI, directory: Path) -> bool:
    """Mount the web build at "/" when one has been exported into `directory`.

    Mounting last leaves every router untouched: "/" only ever sees the paths
    they did not claim. A checkout with no build keeps serving the API alone.
    """

    if not (directory / INDEX_DOCUMENT).is_file():
        return False
    app.mount("/", ExpoWebFiles(directory=directory), name="frontend")
    return True
