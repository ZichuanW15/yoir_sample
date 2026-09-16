#!/usr/bin/env python3
"""Package every local QA change into an explicit, empty directory outside Git.

This command reads Git only. It never stages, commits, pushes, installs, or edits
project files. Copy working-tree/ over the recorded baseline to reconstruct the
reviewed overlay. Deleted files, symlinks and out-of-scope changes are refused.
"""
from __future__ import annotations

import argparse
from datetime import UTC, datetime
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import stat
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE_NAME = "sprint2-qa-review-package.tar.gz"
MANIFEST_NAME = "submission-manifest.json"
CHECKSUM_NAME = "sprint2-qa-review-package.sha256"
ALLOWED = ("backend/tests/", "frontend/__tests__/", "frontend/e2e/",
           "docs/sprint2/qa/", "scripts/tests/")
EXACT = {".github/workflows/app-ci.yml", ".gitignore", ".gitattributes", "README.md",
         "frontend/package.json", "frontend/package-lock.json", "frontend/jest.config.js",
         "frontend/jest.config.defects.js", "frontend/jest.config.planned.js",
         "frontend/jest.config.native.js", "frontend/jest.config.ios.js",
         "frontend/jest.config.android.js", "frontend/jest.config.ios-defects.js",
         "frontend/jest.config.android-defects.js",
         "frontend/playwright.config.ts", "scripts/run_sprint2_qa.py",
         "scripts/package_sprint2_qa.py", "scripts/check_sprint2_qa_traceability.py",
         "scripts/check_defect_report.cjs"}


class PackageError(ValueError):
    """The requested package would be incomplete, unsafe or unverifiable."""


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], cwd=ROOT)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def checked_output(output: Path) -> Path:
    """Resolve aliases before comparing paths, and never overwrite evidence."""
    if output.is_symlink():
        raise PackageError("--output cannot be a symlink")
    resolved = output.resolve()
    if resolved.is_relative_to(ROOT.resolve()):
        raise PackageError("--output must be outside the repository (including docs/evidence)")
    if resolved.exists() and (not resolved.is_dir() or any(resolved.iterdir())):
        raise PackageError("--output must be a new or empty directory; existing evidence is preserved")
    return resolved


def collect_payload() -> list[tuple[str, bytes]]:
    # --no-renames exposes both sides of a rename: the deletion cannot silently
    # disappear from an overlay that only knows how to restore ordinary files.
    deleted = git("diff", "--name-only", "--diff-filter=D", "--no-renames", "-z", "HEAD")
    if deleted:
        names = ", ".join(name.decode("utf-8") for name in deleted.split(b"\0") if name)
        raise PackageError(f"Refusing deleted files: {names}")
    changed = git("diff", "--name-only", "--no-renames", "-z", "HEAD")
    untracked = git("ls-files", "--others", "--exclude-standard", "-z")
    names = sorted({name.decode("utf-8") for name in (changed + untracked).split(b"\0") if name})
    payload = []
    for name in names:
        relative = PurePosixPath(name)
        if relative.is_absolute() or ".." in relative.parts or relative.as_posix() != name:
            raise PackageError(f"Unsafe repository path: {name}")
        if name not in EXACT and not name.startswith(ALLOWED):
            raise PackageError(f"Out-of-scope change (including business source): {name}; nothing is silently omitted")
        if any(part in {".git", "node_modules", "__pycache__"}
               or part == ".env" or part.startswith(".env.") for part in relative.parts):
            raise PackageError(f"Environment/dependency artifact is not QA source: {name}")
        path = ROOT / name
        # Check every component before read_bytes can follow an intermediate link.
        current = ROOT
        for part in relative.parts:
            current /= part
            if current.is_symlink():
                raise PackageError(f"Refusing symlink: {name}")
        if not path.exists() or not stat.S_ISREG(path.stat().st_mode):
            raise PackageError(f"Refusing deleted/non-regular file: {name}")
        if not path.resolve().is_relative_to(ROOT.resolve()):
            raise PackageError(f"Path escapes the repository: {name}")
        payload.append((name, path.read_bytes()))
    if not payload:
        raise PackageError("No local QA changes to package")
    return payload


def verify_package(output: Path) -> dict:
    """Verify archive structure, external/embedded manifest, and every SHA-256."""
    archive_path = output / ARCHIVE_NAME
    raw = (output / MANIFEST_NAME).read_bytes()
    manifest = json.loads(raw)
    checksum = (output / CHECKSUM_NAME).read_text()
    if checksum != f"{sha256(archive_path.read_bytes())}  {ARCHIVE_NAME}\n":
        raise PackageError("Archive checksum mismatch")
    expected = manifest["sha256"]
    with tarfile.open(archive_path, "r:gz") as archive:
        members = archive.getmembers()
        names = [member.name for member in members]
        if len(names) != len(set(names)) or set(names) != {"manifest.json", *expected}:
            raise PackageError("Archive members do not exactly match the manifest")
        if not all(member.isfile() for member in members):
            raise PackageError("Archive contains a non-regular member")
        embedded = archive.extractfile("manifest.json")
        if embedded is None or embedded.read() != raw:
            raise PackageError("External and embedded manifests differ")
        for name, digest in expected.items():
            relative = PurePosixPath(name)
            if (relative.is_absolute() or ".." in relative.parts
                    or not name.startswith("working-tree/")):
                raise PackageError(f"Unsafe archive member: {name}")
            stream = archive.extractfile(name)
            if stream is None or sha256(stream.read()) != digest:
                raise PackageError(f"Member checksum mismatch: {name}")
    return manifest


def create_package(output: Path) -> Path:
    output = checked_output(output)
    baseline = git("rev-parse", "HEAD").decode().strip()
    branch = git("branch", "--show-current").decode().strip()
    payload = collect_payload()
    manifest = {
        "schemaVersion": 1,
        "createdAt": datetime.now(UTC).isoformat(),
        "scope": "Implemented Sprint 2 Web, iOS/Android components and shared API, plus separately recorded limited simulator smoke; no full native sign-off; planned probes are not current evidence",
        "baseline": baseline, "branch": branch,
        "gitWrites": False, "publication": "local only",
        "reconstruction": "Copy working-tree/ over a fresh checkout at baseline. Install dependencies from its lockfiles. No deletions are encoded.",
        "traceWarning": "Browser traces may include disposable local QA accounts/tokens. Never package live user data.",
        "includedChangedFiles": [name for name, _ in payload],
        "sha256": {f"working-tree/{name}": sha256(data) for name, data in payload},
    }
    raw = (json.dumps(manifest, indent=2) + "\n").encode()
    output.mkdir(parents=True, exist_ok=True)
    # Exclusive creation is a second overwrite guard if the output changes after
    # validation. No path under ROOT is used as a destination.
    archive_path = output / ARCHIVE_NAME
    with tarfile.open(archive_path, "x:gz") as archive:
        for name, data in [("manifest.json", raw), *[(f"working-tree/{n}", d) for n, d in payload]]:
            member = tarfile.TarInfo(name)
            member.size = len(data)
            member.mode = 0o644
            archive.addfile(member, io.BytesIO(data))
    with (output / MANIFEST_NAME).open("xb") as stream:
        stream.write(raw)
    with (output / CHECKSUM_NAME).open("x") as stream:
        stream.write(f"{sha256(archive_path.read_bytes())}  {ARCHIVE_NAME}\n")
    verify_package(output)
    # Changes during packaging invalidate the snapshot rather than disappearing
    # from the submission. Preserve any produced artifacts for investigation.
    if (collect_payload() != payload or git("rev-parse", "HEAD").decode().strip() != baseline
            or git("branch", "--show-current").decode().strip() != branch):
        raise PackageError("Repository changed while packaging; this package is not a current snapshot. Use a new output directory after review")
    return archive_path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True,
                        help="Explicit new or empty directory outside the repository")
    args = parser.parse_args()
    try:
        archive = create_package(args.output)
    except (PackageError, OSError, UnicodeError, subprocess.CalledProcessError) as error:
        parser.error(str(error))
    print(f"Verified local QA archive: {archive}")
    print(f"Manifest and SHA-256: {archive.parent}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
