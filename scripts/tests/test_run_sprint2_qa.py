"""Recorder tests plus one short real process-tree timeout; no database is used."""
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "run_sprint2_qa.py"
SPEC = importlib.util.spec_from_file_location("sprint2_runner", SOURCE)
runner = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(runner)


class EvidenceRecorderTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / "frontend/__tests__/example.test.ts"
        self.source.parent.mkdir(parents=True)
        self.source.write_text("test('example', () => {});\n")
        self.root_patch = patch.object(runner, "ROOT", self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)

    def invoke(self, *arguments, run_callback=None):
        def git_output(command, **_):
            return "baseline-sha\n" if command[1] == "rev-parse" else "sprint2-qa\n"
        with patch.object(runner.sys, "argv", ["run_sprint2_qa.py", *arguments]), \
                patch.object(runner.subprocess, "check_output", side_effect=git_output), \
                patch.object(runner, "run_timed", side_effect=run_callback or
                             (lambda command, **_: subprocess.CompletedProcess(command, 0))) as run, \
                redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
            return runner.main(), run.call_args_list

    def test_records_actual_utc_bounds_hashes_and_progress_after_each_check(self):
        destination = self.root / "evidence"
        seen = []

        def execute(command, **_):
            # The initial manifest exists before work, and each previous result
            # was persisted. A later crash cannot discard earlier completed checks.
            manifest = json.loads((destination / "summary.json").read_text())
            self.assertEqual(len(manifest["checks"]), len(seen))
            self.assertEqual(manifest["status"], "running")
            seen.append(command)
            return subprocess.CompletedProcess(command, 0)

        code, calls = self.invoke("--output", str(destination), run_callback=execute)
        self.assertEqual(code, 0)
        data = json.loads((destination / "summary.json").read_text())
        self.assertEqual(data["status"], "completed")
        self.assertEqual(data["head"], "baseline-sha")
        self.assertEqual(data["sourceSha256"]["frontend/__tests__/example.test.ts"],
                         hashlib.sha256(self.source.read_bytes()).hexdigest())
        self.assertEqual(len(data["checks"]), len(calls))
        for record in [data, *data["checks"]]:
            start, end = (datetime.fromisoformat(record[key]) for key in ("startedAt", "completedAt"))
            self.assertIsNotNone(start.tzinfo)
            self.assertLessEqual(start, end)
        self.assertFalse((destination / "summary.json.tmp").exists())

    def test_failure_remains_failure_and_later_checks_are_still_recorded(self):
        def execute(command, **_):
            return subprocess.CompletedProcess(command, int("test:defects" in command))
        code, calls = self.invoke(run_callback=execute)
        self.assertEqual(code, 1)
        self.assertEqual(calls[-1].args[0], ["git", "diff", "--check"])
        manifest = next((self.root / "artifacts/qa/sprint2").glob("*/summary.json"))
        data = json.loads(manifest.read_text())
        failures = [check["name"] for check in data["checks"] if check["exitCode"]]
        self.assertEqual(failures, ["frontend-defects"])

    def test_repeated_default_runs_preserve_both_manifests(self):
        self.invoke()
        first = next((self.root / "artifacts/qa/sprint2").glob("*/summary.json"))
        first_bytes = first.read_bytes()
        self.invoke()
        self.assertEqual(len(list((self.root / "artifacts/qa/sprint2").glob("*/summary.json"))), 2)
        self.assertEqual(first.read_bytes(), first_bytes)

    def test_both_native_presets_are_recorded_without_claiming_device_execution(self):
        destination = self.root / "native-evidence"
        _, calls = self.invoke("--output", str(destination))
        commands = [call.args[0] for call in calls]
        for platform in ("ios", "android"):
            for suffix in ("", ":defects"):
                command = next(c for c in commands if f"test:{platform}{suffix}" in c)
                name = f"{platform}-{'defects' if suffix else 'components'}"
                self.assertIn(f"--outputFile={destination.resolve() / (name + '.json')}", command)
        data = json.loads((destination / "summary.json").read_text())
        self.assertIn("not run", data["platformEvidence"]["nativeDeviceExecution"])

    def test_native_failures_remain_nonzero_without_stopping_other_platforms(self):
        def execute(command, **_):
            return subprocess.CompletedProcess(command, int(any(
                script in command for script in ("test:ios:defects", "test:android:defects"))))
        destination = self.root / "native-failures"
        code, calls = self.invoke("--output", str(destination), run_callback=execute)
        self.assertEqual(code, 1)
        data = json.loads((destination / "summary.json").read_text())
        self.assertEqual([x["name"] for x in data["checks"] if x["exitCode"]],
                         ["ios-defects", "android-defects"])
        self.assertEqual(calls[-1].args[0], ["git", "diff", "--check"])

    def test_current_feature_run_excludes_future_contract_and_planned_proposals(self):
        _, calls = self.invoke()
        commands = [call.args[0] for call in calls]
        backend = next(command for command in commands if "pytest" in command)
        self.assertEqual(backend[backend.index("-m", backend.index("pytest") + 1) + 1], "not live and not future_contract")
        self.assertFalse(any("test:planned" in command for command in commands))
        self.assertTrue(any("test:defects" in command for command in commands))
        self.assertTrue(any("test:web:defects" in command for command in commands))

    def test_changed_test_source_invalidates_run(self):
        def execute(command, **_):
            if command == ["git", "diff", "--check"]:
                self.source.write_text("changed during evidence capture\n")
            return subprocess.CompletedProcess(command, 0)
        code, _ = self.invoke(run_callback=execute)
        self.assertEqual(code, 1)
        manifest = next((self.root / "artifacts/qa/sprint2").glob("*/summary.json"))
        data = json.loads(manifest.read_text())
        self.assertFalse(data["reproducible"])
        self.assertEqual(data["changedDuringRun"], ["frontend/__tests__/example.test.ts"])

    def test_executed_helpers_fixtures_and_configuration_are_fingerprinted(self):
        dependencies = [
            "scripts/check_repository_metadata.py", ".github/scripts/board-insights.py",
            ".github/scripts/tests/test_board_insights.py",
            ".github/scripts/tests/fixtures/project-page-1.json",
            ".github/workflows/board-insights.yml", ".github/mermaid/puppeteer.json",
            "backend/reset_db.py", "frontend/app.json", "frontend/tsconfig.json",
            "frontend/eslint.config.js", "frontend/babel.config.js", "frontend/metro.config.js",
            "frontend/jest.config.native.js", "frontend/jest.config.ios.js",
            "frontend/jest.config.android.js", "frontend/jest.config.ios-defects.js",
            "frontend/jest.config.android-defects.js",
            "docs/sprint1/executable-architecture/openapi.yaml",
            "docs/sprint1/executable-architecture/interface-traceability.csv",
        ]
        for name in dependencies:
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("original source\n")

        def execute(command, **_):
            if command == ["git", "diff", "--check"]:
                (self.root / dependencies[0]).write_text("changed metadata checker\n")
            return subprocess.CompletedProcess(command, 0)

        code, _ = self.invoke(run_callback=execute)
        self.assertEqual(code, 1)
        manifest = next((self.root / "artifacts/qa/sprint2").glob("*/summary.json"))
        data = json.loads(manifest.read_text())
        for name in dependencies:
            self.assertEqual(data["sourceSha256"][name], hashlib.sha256(b"original source\n").hexdigest())
        self.assertFalse(data["reproducible"])
        self.assertEqual(data["changedDuringRun"], [dependencies[0]])

    def test_failed_export_blocks_browser_instead_of_reusing_stale_build(self):
        def execute(command, **_):
            return subprocess.CompletedProcess(command, int("build:web" in command))
        code, calls = self.invoke(run_callback=execute)
        self.assertEqual(code, 1)
        self.assertFalse(any("test:web" in call.args[0] for call in calls))
        manifest = next((self.root / "artifacts/qa/sprint2").glob("*/summary.json"))
        blocked = [x for x in json.loads(manifest.read_text())["checks"] if x.get("status") == "blocked"]
        self.assertEqual(len(blocked), 2)

    def test_timeout_is_a_failure_and_later_checks_continue(self):
        def execute(command, **_):
            if "typecheck" in command:
                raise subprocess.TimeoutExpired(command, 1)
            return subprocess.CompletedProcess(command, 0)
        code, calls = self.invoke("--timeout-seconds", "1", run_callback=execute)
        self.assertEqual(code, 1)
        self.assertEqual(calls[-1].args[0], ["git", "diff", "--check"])
        manifest = next((self.root / "artifacts/qa/sprint2").glob("*/summary.json"))
        check = next(x for x in json.loads(manifest.read_text())["checks"] if x["name"] == "frontend-typecheck")
        self.assertEqual(check["exitCode"], 124)
        self.assertIn("TIMEOUT after 1 seconds", (manifest.parent / check["log"]).read_text())

    def test_nonempty_output_is_rejected_without_overwriting_evidence(self):
        destination = self.root / "evidence"
        destination.mkdir()
        (destination / "summary.json").write_text("original evidence")
        with self.assertRaises(SystemExit) as error:
            self.invoke("--output", str(destination))
        self.assertEqual(error.exception.code, 2)
        self.assertEqual((destination / "summary.json").read_text(), "original evidence")

    def test_ambient_database_target_is_removed_and_explicit_local_target_is_used(self):
        with patch.dict(os.environ, {"DATABASE_URL": "postgresql://shared.example/production",
                                    "YOIR_QA_ALLOW_DATABASE_RESET": "true"}):
            _, calls = self.invoke()
        self.assertNotIn("DATABASE_URL", calls[0].kwargs["env"])
        self.assertNotIn("YOIR_QA_ALLOW_DATABASE_RESET", calls[0].kwargs["env"])
        target = "postgresql://qa@127.0.0.1:55432/unit_test"
        _, calls = self.invoke("--postgres-url", target)
        self.assertEqual(calls[0].kwargs["env"]["DATABASE_URL"], target)
        self.assertEqual(calls[0].kwargs["env"]["YOIR_QA_ALLOW_DATABASE_RESET"], "true")

    def test_remote_or_nontest_database_targets_are_rejected_before_execution(self):
        for option, value in [("--postgres-url", "postgresql://shared.example/unit_test"),
                              ("--postgres-url", "postgresql://localhost/production"),
                              ("--postgres-url", "postgresql://localhost/unit_test?dbname=production"),
                              ("--live-api-url", "https://shared.example/api/v1")]:
            with self.subTest(value=value), self.assertRaises(SystemExit) as error:
                self.invoke(option, value)
            self.assertEqual(error.exception.code, 2)
        self.assertFalse((self.root / "artifacts").exists())


@unittest.skipUnless(os.name == "posix", "Process-group runner targets macOS/Linux")
class ProcessGroupTimeoutTests(unittest.TestCase):
    def test_timeout_kills_a_descendant_that_ignores_term_after_parent_exits(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            child_file = root / "child.py"
            pid_file = root / "child.pid"
            child_file.write_text(
                "import os, signal, sys\n"
                "from pathlib import Path\n"
                "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
                "Path(sys.argv[1]).write_text(str(os.getpid()))\n"
                "while True: signal.pause()\n"
            )
            parent_code = (
                "import subprocess, sys; "
                "subprocess.Popen([sys.executable, sys.argv[1], sys.argv[2]]).wait()"
            )
            command = [sys.executable, "-c", parent_code, str(child_file), str(pid_file)]
            started = time.monotonic()
            read_fd, write_fd = os.pipe()
            try:
                with os.fdopen(write_fd, "w") as stream:
                    with self.assertRaises(subprocess.TimeoutExpired):
                        runner.run_timed(command, cwd=root, env=os.environ.copy(),
                                         stdout=stream, timeout=0.75)
                self.assertLess(time.monotonic() - started, 3)
                self.assertTrue(pid_file.exists(), "The real child must start before the timeout")
                # The child inherits stdout and never closes it while alive.
                # EOF proves both parent and descendant closed their pipe ends,
                # without inspecting unrelated processes or depending on reaping.
                ready, _, _ = select.select([read_fd], [], [], 0.5)
                self.assertEqual(ready, [read_fd], "Timed-out descendant still holds stdout open")
                self.assertEqual(os.read(read_fd, 1024), b"")
            finally:
                os.close(read_fd)
                if pid_file.exists():
                    try:
                        os.kill(int(pid_file.read_text()), signal.SIGKILL)
                    except ProcessLookupError:
                        pass


if __name__ == "__main__":
    unittest.main()
