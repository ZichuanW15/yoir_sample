"""QA checks for the local `yoir-dev` launcher's rebuild decision."""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from app.dev import build_reason, newer_sources

EARLIER = 1_000_000.0
LATER = 2_000_000.0


def _write(path: Path, when: float) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(path.name)
    os.utime(path, (when, when))
    return path


@pytest.fixture
def frontend_root(tmp_path: Path) -> Path:
    root = tmp_path / "frontend"
    _write(root / "package.json", EARLIER)
    _write(root / "app" / "index.tsx", EARLIER)
    _write(root / "src" / "api" / "client.ts", EARLIER)
    # Dependencies are not a reason to rebuild, and walking them would be slow.
    _write(root / "node_modules" / "expo" / "index.js", LATER)
    return root


@pytest.fixture
def build_dir(tmp_path: Path) -> Path:
    directory = tmp_path / "static"
    _write(directory / "index.html", LATER)
    return directory


def test_missing_build_reports_every_source(tmp_path: Path, frontend_root: Path) -> None:
    absent = tmp_path / "static"

    assert len(newer_sources(absent, frontend_root)) == 3
    assert build_reason(absent, frontend_root=frontend_root) == (
        f"building, none found in {absent}"
    )


def test_build_newer_than_every_source_is_current(
    build_dir: Path, frontend_root: Path
) -> None:
    assert newer_sources(build_dir, frontend_root) == []
    assert build_reason(build_dir, frontend_root=frontend_root) is None


def test_changed_source_triggers_a_rebuild(build_dir: Path, frontend_root: Path) -> None:
    changed = _write(frontend_root / "src" / "api" / "client.ts", LATER + 1)

    assert newer_sources(build_dir, frontend_root) == [changed]
    assert build_reason(build_dir, frontend_root=frontend_root) == (
        "rebuilding, 1 source file(s) newer than the build"
    )


def test_dependencies_are_not_a_reason_to_rebuild(
    build_dir: Path, frontend_root: Path
) -> None:
    """node_modules is newer than the build throughout this fixture."""

    assert newer_sources(build_dir, frontend_root) == []


def test_force_rebuilds_a_current_build(build_dir: Path, frontend_root: Path) -> None:
    assert build_reason(build_dir, force=True, frontend_root=frontend_root) == (
        "rebuilding (--force-build)"
    )
