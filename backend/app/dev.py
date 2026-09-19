"""Local development launcher: build the web frontend, then serve it with the API.

`uv run yoir-dev` is the one local entry point. It exports the Expo web build
into the directory app/frontend.py serves, but only when the frontend sources
are newer than the build already sitting there, and then starts Uvicorn with
reload. Production never runs this: CI and the deploy workflow build the same
bundle with the same npm script.
"""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
from collections.abc import Iterator
from pathlib import Path

import uvicorn

from app.config import get_settings
from app.frontend import BACKEND_ROOT, INDEX_DOCUMENT, dist_directory

FRONTEND_ROOT = BACKEND_ROOT.parent / "frontend"

# Where `npm run build:web` writes, before the build is moved into place.
BUILD_OUTPUT = FRONTEND_ROOT / "dist" / "web"

# This process serves the build at "/", so the app calls the API on its own
# origin and the base URL is a path rather than an absolute URL.
API_BASE_URL = "/api/v1"

# Frontend inputs worth rebuilding for. node_modules is deliberately absent.
SOURCE_PATHS = ("app", "src", "assets", "package.json", "app.json", ".env")


def _source_files(frontend_root: Path) -> Iterator[Path]:
    for relative in SOURCE_PATHS:
        source = frontend_root / relative
        if source.is_file():
            yield source
        elif source.is_dir():
            yield from (path for path in source.rglob("*") if path.is_file())


def newer_sources(build_dir: Path, frontend_root: Path = FRONTEND_ROOT) -> list[Path]:
    """Frontend sources modified since the build in `build_dir` was written."""

    index = build_dir / INDEX_DOCUMENT
    if not index.is_file():
        return sorted(_source_files(frontend_root))
    built_at = index.stat().st_mtime
    return sorted(path for path in _source_files(frontend_root) if path.stat().st_mtime > built_at)


def build_reason(
    build_dir: Path, *, force: bool = False, frontend_root: Path = FRONTEND_ROOT
) -> str | None:
    """Why the frontend needs building, or None when the build is current."""

    if force:
        return "rebuilding (--force-build)"
    if not (build_dir / INDEX_DOCUMENT).is_file():
        return f"building, none found in {build_dir}"
    changed = newer_sources(build_dir, frontend_root)
    if changed:
        return f"rebuilding, {len(changed)} source file(s) newer than the build"
    return None


def build_web(build_dir: Path) -> None:
    """Export the Expo web build into the directory FastAPI serves."""

    environment = {**os.environ, "EXPO_PUBLIC_API_URL": API_BASE_URL}
    try:
        subprocess.run(
            ["npm", "run", "build:web"],
            cwd=FRONTEND_ROOT,
            env=environment,
            check=True,
        )
    except FileNotFoundError:
        raise SystemExit(
            "npm was not found. Install Node.js 20+, or run with --no-build to "
            "serve the API without rebuilding the frontend."
        ) from None
    except subprocess.CalledProcessError as error:
        raise SystemExit(
            f"The web build failed ({error.returncode}). If this is a fresh checkout, "
            f"run `npm install` in {FRONTEND_ROOT} first."
        ) from None

    if build_dir.exists():
        shutil.rmtree(build_dir)
    shutil.move(str(BUILD_OUTPUT), str(build_dir))
    files = sum(1 for path in build_dir.rglob("*") if path.is_file())
    print(f"web build: {files} files in {build_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="yoir-dev",
        description="Build the Expo web frontend and serve it with the API on one origin.",
    )
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument(
        "--no-build", action="store_true", help="serve whatever build is already in place"
    )
    parser.add_argument(
        "--force-build", action="store_true", help="rebuild even when the build is current"
    )
    args = parser.parse_args()

    # Settings read backend/.env relative to the working directory, so anchor it
    # here: a console script can be invoked from anywhere in the repository.
    os.chdir(BACKEND_ROOT)

    build_dir = dist_directory(get_settings().frontend_dist)
    if args.no_build:
        print("web build: skipped (--no-build)")
    else:
        reason = build_reason(build_dir, force=args.force_build)
        if reason is None:
            print(f"web build: up to date in {build_dir}")
        else:
            print(f"web build: {reason}")
            build_web(build_dir)

    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        reload=True,
        reload_dirs=[str(BACKEND_ROOT / "app")],
    )
