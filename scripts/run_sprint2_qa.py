#!/usr/bin/env python3
"""Run local Sprint 2 checks and retain every result, including known failures.

Install locked dependencies first. No install, Git mutation, or remote write is
performed here. PostgreSQL/live targets must be disposable loopback QA services.
"""
from __future__ import annotations

import argparse
from datetime import UTC, datetime
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
LOOPBACK = {"localhost", "127.0.0.1", "::1"}
TERMINATION_GRACE_SECONDS = 0.5


def utc_now() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds")


def source_fingerprints() -> dict[str, str]:
    """Hash executed code/config and reconciliation inputs, not generated run output."""
    files = [ROOT / "scripts/run_sprint2_qa.py", ROOT / "scripts/package_sprint2_qa.py",
             ROOT / "scripts/check_repository_metadata.py", ROOT / "frontend/package-lock.json",
             ROOT / "frontend/package.json", ROOT / "frontend/playwright.config.ts",
             ROOT / "backend/uv.lock", ROOT / "backend/pyproject.toml", ROOT / "backend/reset_db.py",
             ROOT / "docs/sprint2/qa/scope.json", ROOT / ".github/scripts/board-insights.py",
             ROOT / "scripts/check_sprint2_qa_traceability.py",
             ROOT / "scripts/check_defect_report.cjs",
             ROOT / "docs/sprint2/qa/issue-evidence.json",
             ROOT / "docs/sprint2/qa/qa-issue-audit-20260916.json",
             ROOT / "docs/sprint2/qa/qa-matrix.md",
             ROOT / "docs/sprint2/qa/native-acceptance-delta.md",
             ROOT / ".github/mermaid/puppeteer.json",
             ROOT / "docs/sprint1/executable-architecture/openapi.yaml",
             ROOT / "docs/sprint1/executable-architecture/interface-traceability.csv"]
    for pattern in ("jest*.js", "babel.config.*", "metro.config.*", "eslint.config.*",
                    "tsconfig*.json", "app.json", "app.config.*"):
        files.extend((ROOT / "frontend").glob(pattern))
    for pattern in ("*.yml", "*.yaml"):
        files.extend((ROOT / ".github/workflows").glob(pattern))
    files.extend((ROOT / "docs/sprint2/qa").glob("*-ac-review.json"))
    for directory in ("frontend/__tests__", "frontend/e2e", "frontend/app", "frontend/src",
                      "backend/tests", "backend/app", "scripts/tests", ".github/scripts/tests"):
        files.extend(path for path in (ROOT / directory).rglob("*")
                     if path.is_file() and path.suffix in {".py", ".ts", ".tsx", ".js", ".cjs", ".json"})
    return {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
            for path in sorted(set(files)) if path.is_file()}


def run_timed(command: list[str], *, cwd: Path, env: dict[str, str],
              stdout, timeout: float) -> subprocess.CompletedProcess:
    """Run one check in its own POSIX process group and reap timed-out children.

    npm and Playwright spawn descendants. Killing only their immediate process
    can leave a browser or development server alive after evidence says timeout.
    The group ID belongs to this new session, never the caller's process group.
    """
    process = subprocess.Popen(command, cwd=cwd, env=env, stdout=stdout,
                               stderr=subprocess.STDOUT, start_new_session=True)
    try:
        code = process.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            process.wait(timeout=TERMINATION_GRACE_SECONDS)
        except subprocess.TimeoutExpired:
            pass
        # Always address the group: the parent may have exited promptly while a
        # descendant ignored SIGTERM. Do not use process.poll() as a group check.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()
        raise
    return subprocess.CompletedProcess(command, code)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--backend-python", default=str(ROOT / "backend/.venv/bin/python"))
    parser.add_argument("--postgres-url", help="Disposable local PostgreSQL database ending in _test")
    parser.add_argument("--live-api-url", help="Optional separately running, seeded loopback QA backend")
    parser.add_argument("--output", type=Path, help="New or empty evidence directory; existing evidence is never overwritten")
    parser.add_argument("--timeout-seconds", type=int, default=600, help="Maximum time per check (default 600)")
    args = parser.parse_args()
    if args.timeout_seconds < 1:
        parser.error("--timeout-seconds must be positive")
    if args.postgres_url:
        target = urlsplit(args.postgres_url)
        if (target.scheme not in {"postgresql", "postgresql+psycopg2"}
                or target.hostname not in LOOPBACK or not target.path.endswith("_test")
                or target.query or target.fragment):
            parser.error("--postgres-url must name a disposable loopback PostgreSQL *_test database without query overrides")
    if args.live_api_url:
        target = urlsplit(args.live_api_url)
        if target.scheme != "http" or target.hostname not in LOOPBACK or target.username or target.query or target.fragment:
            parser.error("--live-api-url must name a disposable loopback HTTP backend")
    run_id = datetime.now(UTC).strftime("%Y%m%dT%H%M%S.%fZ")
    output = (args.output or ROOT / "artifacts/qa/sprint2" / run_id).resolve()
    if output.exists() and (not output.is_dir() or any(output.iterdir())):
        parser.error("--output must be new or empty; choose another directory to preserve prior evidence")
    output.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    for name in ("DATABASE_URL", "YOIR_QA_ALLOW_DATABASE_RESET", "LIVE_API_BASE_URL", "EXPO_PUBLIC_USE_DEMO_API", "EXPO_PUBLIC_API_URL"):
        env.pop(name, None)
    env.update(CI="true", TZ="Australia/Melbourne", SEED_ON_STARTUP="false",
               JWT_SECRET="qa-test-secret-that-is-at-least-32-characters",
               CORS_ALLOW_ORIGINS="http://localhost:8081")
    if args.postgres_url:
        env.update(DATABASE_URL=args.postgres_url, YOIR_QA_ALLOW_DATABASE_RESET="true")
    results = []
    summary = {"runId": run_id, "startedAt": utc_now(), "completedAt": None,
               "status": "running", "scope": "Implemented Sprint 2 Web, iOS/Android components and shared API; planned features and policies excluded",
               "platformEvidence": {
                   "web": "Chromium against a fresh export and isolated API/database",
                   "ios": "Jest Expo iOS preset: components/logic, mocked device boundaries",
                   "android": "Jest Expo Android preset: components/logic, mocked device boundaries",
                   "nativeDeviceExecution": "not run by this recorder; no simulator/device sign-off",
               },
               "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
               "branch": subprocess.check_output(["git", "branch", "--show-current"], cwd=ROOT, text=True).strip(),
               "database": "PostgreSQL" if args.postgres_url else "temporary SQLite (no concurrency evidence)",
               "sourceSha256": source_fingerprints(), "checks": results,
               "fingerprintScope": "Executed source, test inputs and configuration; final report prose is checked separately by repository-metadata, not hashed here",
               "note": "Failed acceptance assertions require review; xfails in backend XML are unresolved defects, not passes."}

    def save_summary() -> None:
        pending = output / "summary.json.tmp"
        pending.write_text(json.dumps(summary, indent=2) + "\n")
        pending.replace(output / "summary.json")

    save_summary()

    def run(name: str, command: list[str], directory: str = ".", extra: dict | None = None) -> None:
        started = time.monotonic()
        started_at = utc_now()
        print(f"Running {name} ...", flush=True)
        log = output / f"{name}.log"
        with log.open("w") as stream:
            try:
                result = run_timed(command, cwd=ROOT / directory, env=env | (extra or {}),
                                   stdout=stream, timeout=args.timeout_seconds)
                code = result.returncode
            except subprocess.TimeoutExpired:
                stream.write(f"\nTIMEOUT after {args.timeout_seconds} seconds\n")
                code = 124
            except OSError as error:
                stream.write(str(error))
                code = 127
        results.append({"name": name, "command": command, "cwd": directory,
                        "startedAt": started_at, "completedAt": utc_now(),
                        "exitCode": code, "seconds": round(time.monotonic() - started, 2), "log": log.name})
        save_summary()
        print(f"{name}: exit {code}; {log}", flush=True)

    run("runtime-versions", [args.backend_python, "-c",
        "import sys, platform, importlib.metadata as m, subprocess; "
        "print('Python', sys.version); print('Platform', platform.platform()); "
        "print({n: m.version(n) for n in ['fastapi', 'pytest', 'sqlalchemy', 'psycopg2-binary']}); "
        "subprocess.run(['node', '--version'], check=True); subprocess.run(['npm', '--version'], check=True)"])
    run("frontend-lint", ["npm", "run", "lint"], "frontend")
    run("frontend-typecheck", ["npm", "run", "typecheck"], "frontend")
    run("frontend-tests", ["npm", "run", "test:coverage", "--", "--json", f"--outputFile={output / 'frontend-tests.json'}", f"--coverageDirectory={output / 'frontend-coverage'}"], "frontend")
    run("frontend-defects", ["npm", "run", "test:defects", "--", "--json", f"--outputFile={output / 'frontend-defects.json'}"], "frontend")
    for platform in ("ios", "android"):
        for suffix in ("", ":defects"):
            name = f"{platform}-{'defects' if suffix else 'components'}"
            run(name, ["npm", "run", f"test:{platform}{suffix}", "--", "--json",
                       f"--outputFile={output / (name + '.json')}"], "frontend")
    run("frontend-production-audit", ["npm", "audit", "--omit=dev", "--audit-level=critical", "--json"], "frontend")
    run("backend-test-lint", [args.backend_python, "-m", "ruff", "check", "tests"], "backend")
    run("backend-source-lint", [args.backend_python, "-m", "ruff", "check", "app", "reset_db.py"], "backend")
    run("backend-tests", [args.backend_python, "-m", "pytest", "tests", "-m", "not live and not future_contract", "-ra",
                          f"--junitxml={output / 'backend-tests.xml'}", "--cov=app",
                          "--cov-report=term-missing", f"--cov-report=json:{output / 'backend-coverage.json'}"], "backend")
    run("repository-metadata", [args.backend_python, "scripts/check_repository_metadata.py"])
    run("qa-issue-traceability", [args.backend_python, "scripts/check_sprint2_qa_traceability.py"])
    run("evidence-runner-tests", [args.backend_python, "-m", "unittest", "discover", "-s", "scripts/tests", "-v"])
    run("defect-report-tests", ["node", "--test", "scripts/tests/test_defect_report.cjs"])
    run("board-tests", [args.backend_python, "-B", ".github/scripts/tests/test_board_insights.py", "-v"])
    run("web-build", ["npm", "run", "build:web"], "frontend",
        {"EXPO_PUBLIC_API_URL": "/api/v1", "EXPO_PUBLIC_USE_DEMO_API": "false"})
    build_ok = results[-1]["exitCode"] == 0
    for name, script in (("browser-web", "test:web"), ("browser-web-defects", "test:web:defects")):
        if build_ok:
            run(name, ["npm", "run", script], "frontend", {
                "YOIR_QA_PYTHON": args.backend_python,
                "WEB_QA_OUTPUT_DIR": str(output / name),
                "WEB_QA_DIST_DIR": str(ROOT / "frontend/dist/web"),
            })
        else:
            results.append({"name": name, "exitCode": 125, "status": "blocked",
                            "reason": "Web export failed; stale build must not be tested"})
            save_summary()
    if args.live_api_url:
        live_env = {"LIVE_API_BASE_URL": args.live_api_url}
        run("httpx-live", [args.backend_python, "-m", "pytest", "tests/test_live_api.py", "-q", "-ra",
                           f"--junitxml={output / 'httpx-live.xml'}"], "backend", live_env)
        run("typescript-live", ["npm", "run", "test:client:live", "--", "--json",
                                f"--outputFile={output / 'typescript-live.json'}"], "frontend", live_env)
    run("diff-check", ["git", "diff", "--check"])
    final_hashes = source_fingerprints()
    changed = sorted(key for key in summary["sourceSha256"].keys() | final_hashes.keys()
                     if summary["sourceSha256"].get(key) != final_hashes.get(key))
    summary.update(completedAt=utc_now(), status="completed", changedDuringRun=changed,
                   reproducible=not changed)
    save_summary()
    return int(bool(changed) or any(item["exitCode"] != 0 for item in results))


if __name__ == "__main__":
    sys.exit(main())
