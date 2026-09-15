"""Package boundary/integrity tests; Git is read-mocked and no repository is mutated."""
from contextlib import redirect_stderr, redirect_stdout
import hashlib
import importlib.util
import io
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SOURCE = Path(__file__).resolve().parents[1] / "package_sprint2_qa.py"
SPEC = importlib.util.spec_from_file_location("sprint2_packager", SOURCE)
packager = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(packager)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.work = Path(self.temporary.name)
        self.root = self.work / "repo"
        self.root.mkdir()
        self.output = self.work / "package"
        self.changed = []
        self.untracked = []
        self.deleted = []
        self.root_patch = patch.object(packager, "ROOT", self.root)
        self.root_patch.start()
        self.addCleanup(self.root_patch.stop)
        self.git_patch = patch.object(packager, "git", side_effect=self.git_output)
        self.git_mock = self.git_patch.start()
        self.addCleanup(self.git_patch.stop)
        self.write("frontend/__tests__/example.test.ts", b"test('example', () => {});\n")

    def git_output(self, *args):
        if args == ("rev-parse", "HEAD"):
            return b"baseline-sha\n"
        if args == ("branch", "--show-current"):
            return b"sprint2-qa\n"
        if args[0] == "ls-files":
            names = self.untracked
        elif args[0] == "diff":
            names = self.deleted if "--diff-filter=D" in args else self.changed
        else:
            raise AssertionError(f"Unexpected Git command: {args}")
        return b"".join(name.encode() + b"\0" for name in names)

    def write(self, name, contents=b"QA evidence\n", *, tracked=False):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(contents)
        (self.changed if tracked else self.untracked).append(name)
        return path

    def test_output_is_required_before_git_is_read(self):
        with patch("sys.argv", ["package_sprint2_qa.py"]), redirect_stderr(io.StringIO()):
            with self.assertRaises(SystemExit) as raised:
                packager.main()
        self.assertEqual(raised.exception.code, 2)
        self.git_mock.assert_not_called()

    def test_complete_qa_overlay_reconstructs_from_manifest_and_verifies(self):
        self.write(".gitattributes", b"docs/sprint2/qa/evidence/**/*.log -whitespace\n", tracked=True)
        self.write("frontend/jest.config.planned.js", b"module.exports = {};\n", tracked=True)
        self.write("backend/tests/new_test.py", b"def test_example(): pass\n")
        self.write("docs/sprint2/qa/result.json", b'{"result":"passed"}\n')
        self.output.mkdir()  # A deliberately chosen empty directory is supported.
        with patch("sys.argv", ["package_sprint2_qa.py", "--output", str(self.output)]), \
                redirect_stdout(io.StringIO()):
            self.assertEqual(packager.main(), 0)
        manifest = packager.verify_package(self.output)
        self.assertEqual(manifest["baseline"], "baseline-sha")
        self.assertEqual(manifest["branch"], "sprint2-qa")
        self.assertFalse(manifest["gitWrites"])
        self.assertEqual(set(manifest["includedChangedFiles"]), set(self.changed + self.untracked))
        with tarfile.open(self.output / packager.ARCHIVE_NAME) as archive:
            for name in self.changed + self.untracked:
                content = archive.extractfile(f"working-tree/{name}").read()
                self.assertEqual(content, (self.root / name).read_bytes())
                self.assertEqual(manifest["sha256"][f"working-tree/{name}"],
                                 hashlib.sha256(content).hexdigest())
        self.assertEqual({p.name for p in self.output.iterdir()},
                         {packager.ARCHIVE_NAME, packager.MANIFEST_NAME, packager.CHECKSUM_NAME})
        self.assertTrue(all(call.args[0] in {"diff", "ls-files", "rev-parse", "branch"}
                            for call in self.git_mock.call_args_list))

    def test_business_source_and_other_changes_are_rejected_not_omitted(self):
        for name in ("frontend/app/marketplace.tsx", "backend/app/main.py",
                     "backend/reset_db.py", "unrelated.txt", "frontend/__tests__/.env.local"):
            with self.subTest(name=name):
                path = self.write(name)
                with self.assertRaises(packager.PackageError):
                    packager.create_package(self.output)
                self.assertFalse(self.output.exists())
                self.untracked.remove(name)
                path.unlink()

    def test_repository_output_and_alias_back_into_repository_are_rejected(self):
        alias = self.work / "repo-alias"
        alias.symlink_to(self.root, target_is_directory=True)
        for output in (self.root, self.root / "docs/evidence/package", alias / "package"):
            with self.subTest(output=output), self.assertRaisesRegex(packager.PackageError, "outside"):
                packager.create_package(output)
        self.git_mock.assert_not_called()

    def test_repeated_or_nonempty_output_preserves_existing_bytes(self):
        packager.create_package(self.output)
        before = {p.name: p.read_bytes() for p in self.output.iterdir()}
        with self.assertRaisesRegex(packager.PackageError, "new or empty"):
            packager.create_package(self.output)
        self.assertEqual(before, {p.name: p.read_bytes() for p in self.output.iterdir()})
        unrelated = self.work / "existing"
        unrelated.mkdir()
        (unrelated / "keep.txt").write_text("prior evidence")
        with self.assertRaises(packager.PackageError):
            packager.create_package(unrelated)
        self.assertEqual((unrelated / "keep.txt").read_text(), "prior evidence")

    def test_symlink_files_parents_and_deleted_files_are_rejected(self):
        outside = self.work / "outside.txt"
        outside.write_text("outside")
        link = self.root / "frontend/__tests__/link.test.ts"
        link.symlink_to(outside)
        self.untracked.append(str(link.relative_to(self.root)))
        with self.assertRaisesRegex(packager.PackageError, "symlink"):
            packager.create_package(self.output)
        self.untracked.pop()
        link.unlink()
        directory_link = self.root / "backend/tests"
        directory_link.parent.mkdir()
        directory_link.symlink_to(self.work, target_is_directory=True)
        self.untracked.append("backend/tests/outside.txt")
        with self.assertRaisesRegex(packager.PackageError, "symlink"):
            packager.create_package(self.output)
        self.untracked.pop()
        self.changed.append("frontend/__tests__/deleted.test.ts")
        with self.assertRaisesRegex(packager.PackageError, "deleted"):
            packager.create_package(self.output)
        # A Git-recorded deletion is still rejected if a new untracked file with
        # the same name happens to exist in the working tree.
        self.write("frontend/__tests__/deleted.test.ts")
        self.deleted.append("frontend/__tests__/deleted.test.ts")
        with self.assertRaisesRegex(packager.PackageError, "deleted"):
            packager.create_package(self.output)
        self.assertFalse(self.output.exists())

    def test_archive_and_manifest_corruption_are_detected(self):
        packager.create_package(self.output)
        archive = self.output / packager.ARCHIVE_NAME
        original = archive.read_bytes()
        archive.write_bytes(original + b"tampering")
        with self.assertRaisesRegex(packager.PackageError, "Archive checksum"):
            packager.verify_package(self.output)
        archive.write_bytes(original)
        manifest = self.output / packager.MANIFEST_NAME
        manifest.write_bytes(manifest.read_bytes() + b" ")
        with self.assertRaisesRegex(packager.PackageError, "manifests differ"):
            packager.verify_package(self.output)

    def test_member_hash_is_checked_even_if_archive_checksum_is_recomputed(self):
        packager.create_package(self.output)
        archive_path = self.output / packager.ARCHIVE_NAME
        with tarfile.open(archive_path) as archive:
            members = [(member.name, archive.extractfile(member).read()) for member in archive.getmembers()]
        with tarfile.open(archive_path, "w:gz") as archive:
            for name, data in members:
                if name.startswith("working-tree/"):
                    data += b"changed member"
                entry = tarfile.TarInfo(name)
                entry.size = len(data)
                archive.addfile(entry, io.BytesIO(data))
        (self.output / packager.CHECKSUM_NAME).write_text(
            f"{hashlib.sha256(archive_path.read_bytes()).hexdigest()}  {packager.ARCHIVE_NAME}\n")
        with self.assertRaisesRegex(packager.PackageError, "Member checksum"):
            packager.verify_package(self.output)

    def test_source_changes_during_packaging_invalidate_the_current_snapshot(self):
        real_collect = packager.collect_payload
        count = 0

        def collect():
            nonlocal count
            count += 1
            if count == 2:
                self.write("backend/tests/late_test.py")
            return real_collect()

        with patch.object(packager, "collect_payload", side_effect=collect):
            with self.assertRaisesRegex(packager.PackageError, "changed while packaging"):
                packager.create_package(self.output)


if __name__ == "__main__":
    unittest.main()
