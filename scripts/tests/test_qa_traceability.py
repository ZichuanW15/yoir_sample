"""New record-consistency tests only; no backend, Jest, browser or device execution."""

from contextlib import redirect_stdout
import ast
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "check_sprint2_qa_traceability.py"
SPEC = importlib.util.spec_from_file_location("qa_traceability", SOURCE)
checker = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(checker)


class TraceabilityTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.qa = self.root / checker.QA
        self.qa.mkdir(parents=True)
        original = checker.ROOT / checker.QA
        for name in ("issue-evidence.json", "scope.json", "qa-issue-audit-20260916.json",
                     "qa-matrix.md", "test-results-multiplatform.md",
                     "native-device-results-20260916.md", "native-acceptance-delta.md"):
            (self.qa / name).write_bytes((original / name).read_bytes())
        for row in self.read()["issues"]:
            for source in row["testFiles"]:
                path = self.root / source
                path.parent.mkdir(parents=True, exist_ok=True)
                path.touch()

    def read(self, name="issue-evidence.json"):
        return json.loads((self.qa / name).read_text())

    def write(self, data, name="issue-evidence.json"):
        (self.qa / name).write_text(json.dumps(data))

    def errors(self):
        return "\n".join(checker.validate(self.root))

    def test_consistent_record_needs_no_local_artifacts_or_product_execution(self):
        self.assertEqual(checker.validate(self.root), [])

    def test_remote_closure_does_not_imply_acceptance(self):
        data = self.read()
        row = next(r for r in data["issues"] if r["qaIssue"] == 87)
        self.assertEqual(row["remoteState"], "closed")
        self.assertFalse(row["fullAcceptance"])
        row["fullAcceptance"] = True
        self.write(data)
        self.assertIn("cannot claim full acceptance", self.errors())

    def test_remote_state_and_parent_mapping_drift_are_rejected(self):
        data = self.read()
        data["issues"][0]["remoteState"] = "open"
        data["issues"][0]["parentIssue"] = 999
        self.write(data)
        errors = self.errors()
        self.assertIn("remote state drift", errors)
        self.assertIn("parentIssue mapping drift", errors)

    def test_missing_and_duplicate_issues_are_rejected(self):
        data = self.read()
        data["issues"][-1] = data["issues"][0]
        self.write(data)
        errors = self.errors()
        self.assertIn("Duplicate evidence issue", errors)
        self.assertIn("Missing or extra QA issue", errors)

    def test_parent_acceptance_source_cannot_disappear(self):
        data = self.read("qa-issue-audit-20260916.json")
        data["issues"][0]["parentAcceptanceCriteria"] = ""
        self.write(data, "qa-issue-audit-20260916.json")
        self.assertIn("missing parent AC", self.errors())

    def test_stale_native_scope_is_rejected(self):
        scope = self.read("scope.json")
        scope["nativeDeviceEvidence"] = "Not run"
        self.write(scope, "scope.json")
        self.assertIn("omits the measured limited native smoke", self.errors())

    def test_unknown_or_erased_native_gaps_are_rejected(self):
        data = self.read()
        data["issues"][0]["native"]["ios"]["remainingCases"] = ["N99"]
        data["issues"][0]["native"]["android"]["remainingCases"] = []
        self.write(data)
        errors = self.errors()
        self.assertIn("unknown remaining native scenario", errors)
        self.assertIn("native gaps silently removed", errors)

    def test_stale_matrix_cannot_disagree_with_structured_evidence(self):
        matrix = self.qa / "qa-matrix.md"
        matrix.write_text(matrix.read_text().replace("3 closed / 17 open", "All 20 open"))
        self.assertIn("qa-matrix.md differs", self.errors())

    def test_missing_test_source_is_not_passing_evidence(self):
        data = self.read()
        data["issues"][0]["testFiles"] = ["frontend/__tests__/absent.test.ts"]
        self.write(data)
        self.assertIn("Missing evidence/source file", self.errors())

    def test_traversal_absolute_and_escaping_symlink_are_rejected(self):
        for bad in ("../outside", "/outside"):
            with self.subTest(path=bad):
                data = self.read()
                data["issues"][0]["testFiles"] = [bad]
                self.write(data)
                self.assertIn("Unsafe evidence path", self.errors())
        link = self.root / "escape"
        link.symlink_to(self.root.parent, target_is_directory=True)
        data["issues"][0]["testFiles"] = ["escape/outside"]
        self.write(data)
        self.assertIn("escapes repository", self.errors())

    def test_local_digest_verification_is_explicit_and_detects_tampering(self):
        data = self.read()
        data["originalSummary"] = {"path": "artifacts/old/summary.json",
                                   "sha256": hashlib.sha256(b"original").hexdigest()}
        self.write(data)
        self.assertTrue(checker.validate(self.root, verify_local_artifacts=True))
        path = self.root / data["originalSummary"]["path"]
        path.parent.mkdir(parents=True)
        path.write_bytes(b"original")
        self.assertEqual(checker.validate(self.root, verify_local_artifacts=True), [])
        path.write_bytes(b"changed")
        self.assertIn("Original automated evidence changed",
                      checker.validate(self.root, verify_local_artifacts=True))

    def test_cli_has_honest_success_message_and_failure_exit(self):
        with patch.object(checker, "ROOT", self.root), patch("sys.argv", ["checker"]):
            output = io.StringIO()
            with redirect_stdout(output):
                self.assertEqual(checker.main(), 0)
            self.assertIn("Product tests were not executed", output.getvalue())
            (self.qa / "issue-evidence.json").write_text("not json")
            with redirect_stdout(io.StringIO()):
                self.assertEqual(checker.main(), 1)

    def test_checker_is_an_explicit_qa_package_member(self):
        # Inspect the allowlist without running packaging or touching Git.
        source = SOURCE.with_name("package_sprint2_qa.py")
        module = ast.parse(source.read_text())
        assignment = next(node for node in module.body if isinstance(node, ast.Assign)
                          and any(isinstance(t, ast.Name) and t.id == "EXACT"
                                  for t in node.targets))
        allowed = ast.literal_eval(assignment.value)
        self.assertIn("scripts/check_sprint2_qa_traceability.py", allowed)
        self.assertNotIn("frontend/src/auth/AuthContext.tsx", allowed)


if __name__ == "__main__":
    unittest.main()
