#!/usr/bin/env python3
"""Read-only QA record consistency checks; never run or certify product tests."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import re

ROOT = Path(__file__).resolve().parents[1]
QA = Path("docs/sprint2/qa")


def render_matrix(data: dict) -> str:
    """One source for human-readable status; old snapshots remain untouched."""
    def cell(value: str) -> str:
        return value.replace("|", "\\|").replace("\n", " ")

    lines = [
        "# QA issue reconciliation — implemented scope, not full acceptance",
        "",
        f"Remote state checked at **{data['checkedAt']}**. "
        "[Source issue/parent-AC snapshot](qa-issue-audit-20260916.json); "
        "[structured evidence and exact test files](issue-evidence.json). "
        "The older [15 September snapshot](qa-issue-snapshot.json) is historical.",
        "",
        "**3 closed / 17 open** in this snapshot. Closed is GitHub state, not proof "
        "of full acceptance. All rows have remaining native or parent-story scope. "
        "Current-scope regression passes, unresolved defects, and unimplemented "
        "parent criteria are distinct; exclusions never become passes. No issue "
        "was closed or reopened by this reconciliation.",
        "",
        "Reuse the [16 September automated results](test-results-multiplatform.md) "
        "and [measured simulator smoke](native-device-results-20260916.md). "
        "No application suites were rerun for this update. Native preset components "
        "do not replace device tests. N01–N10 refer to the "
        "[remaining-only native plan](native-acceptance-delta.md).",
        "",
        "| QA / story | Remote | Existing evidence | Unresolved defects / excluded parent criteria | Native observations and remaining work |",
        "| --- | --- | --- | --- | --- |",
    ]
    for row in data["issues"]:
        url = ("https://github.com/swen90014-2026-sm2/"
               f"SWEN90014-2026-CSD-Koala/issues/{row['qaIssue']}")
        limits = ("Defects: " + "; ".join(row["unresolvedDefects"])
                  if row["unresolvedDefects"] else "No current defect in the named passing boundary.")
        if row["deferredCriteria"]:
            limits += " Excluded/not certified: " + "; ".join(row["deferredCriteria"])
        native = []
        for platform, label in (("ios", "iOS"), ("android", "Android")):
            detail = row["native"][platform]
            observed = " ".join(detail["observed"]) or "No device scenario for this issue."
            native.append(f"{label}: {observed} Remaining: {', '.join(detail['remainingCases'])}.")
        columns = [f"[#{row['qaIssue']}]({url}) / {row['story']}",
                   row["remoteState"], row["passingEvidence"], limits, " ".join(native)]
        lines.append("| " + " | ".join(cell(value) for value in columns) + " |")
    lines += ["", "Full verification/LinkedIn review remains Sprint 3. The current pending-account "
              "403 and Maya's inconsistent Pending display are implementation evidence, "
              "not approval of a publishing policy. Missing profile persistence, provider "
              "payment and other excluded functionality are not newly implemented here.",
              "", "Use `Refs`, not blanket `Closes`, when presenting this QA increment. "
              "Attach reviewed evidence before any team sign-off; local raw artifacts "
              "are not automatically available to reviewers.", ""]
    return "\n".join(lines)


def validate(root: Path, *, verify_local_artifacts: bool = False) -> list[str]:
    errors: list[str] = []

    def require(condition: bool, message: str) -> None:
        if not condition:
            errors.append(message)

    def file(relative: str) -> Path:
        path = PurePosixPath(relative)
        if path.is_absolute() or ".." in path.parts or path.as_posix() != relative:
            raise ValueError(f"Unsafe evidence path: {relative}")
        resolved = (root / path).resolve()
        if not resolved.is_relative_to(root.resolve()):
            raise ValueError(f"Evidence escapes repository: {relative}")
        if not resolved.is_file():
            raise ValueError(f"Missing evidence/source file: {relative}")
        return resolved

    def read(name: str) -> dict:
        return json.loads(file(str(QA / name)).read_text())

    try:
        data, scope = read("issue-evidence.json"), read("scope.json")
        audit = read(data["sourceSnapshot"])
        require(data["schemaVersion"] == 1, "Unsupported evidence schema")
        require(data["productCommit"] == scope["productCommit"], "Product baseline drift")
        require(data["checkedAt"] == audit["checkedAt"], "Issue snapshot timestamp drift")
        require(audit["remoteWrites"] is False, "Snapshot must identify read-only provenance")
        require(scope["issueEvidence"] == "issue-evidence.json", "Scope evidence pointer drift")
        require(scope["issueSnapshot"] == data["sourceSnapshot"], "Scope snapshot pointer drift")
        require("Limited manual Expo Go smoke" in scope["nativeDeviceEvidence"],
                "Scope omits the measured limited native smoke")
        expected = {row["qaIssue"]: row for row in scope["qaIssues"]}
        actual = {row["qaIssue"]: row for row in data["issues"]}
        remote = {row["qaIssue"]: row for row in audit["issues"]}
        require(len(expected) == len(scope["qaIssues"]) == 20, "Expected 20 unique scope issues")
        require(len(actual) == len(data["issues"]), "Duplicate evidence issue")
        require(len(remote) == len(audit["issues"]), "Duplicate snapshot issue")
        require(expected.keys() == actual.keys() == remote.keys(), "Missing or extra QA issue")
        require({i for i, row in remote.items() if row["state"] == "closed"} == {87, 94, 97},
                "Snapshot closure set changed; review the dated reconciliation wording")
        for name in (data["automatedReport"], data["nativeReport"], data["nativeDeltaPlan"]):
            file(str(QA / name))
        plan = file(str(QA / data["nativeDeltaPlan"])).read_text()
        cases = set(re.findall(r"^### (N\d{2})\b", plan, re.M))
        for issue, row in actual.items():
            require(row["remoteState"] == remote[issue]["state"], f"#{issue}: remote state drift")
            for key in ("parentIssue", "story"):
                require(row[key] == remote[issue][key] == expected[issue][key],
                        f"#{issue}: {key} mapping drift")
            require(bool(remote[issue]["parentAcceptanceCriteria"]), f"#{issue}: missing parent AC")
            require(row["assessment"] in {
                "implemented-covered", "partial-with-defects", "component-only",
                "component-and-native-ui-only",
            },
                    f"#{issue}: invalid evidence assessment")
            require(row["fullAcceptance"] is False,
                    f"#{issue}: this partial-evidence snapshot cannot claim full acceptance")
            require(bool(row["passingEvidence"]), f"#{issue}: evidence boundary is empty")
            require(isinstance(row["unresolvedDefects"], list)
                    and isinstance(row["deferredCriteria"], list), f"#{issue}: missing limitations")
            require(bool(row["testFiles"]), f"#{issue}: no test/source links")
            for source in row["testFiles"]:
                file(source)
            require(set(row["native"]) == {"ios", "android"}, f"#{issue}: missing native platform")
            for platform in ("ios", "android"):
                native = row["native"][platform]
                require(isinstance(native["observed"], list), f"#{issue}: observations must be explicit")
                require(bool(native["remainingCases"]), f"#{issue}: native gaps silently removed")
                require(set(native["remainingCases"]) <= cases,
                        f"#{issue}: unknown remaining native scenario")
        require(file(str(QA / "qa-matrix.md")).read_text() == render_matrix(data),
                "qa-matrix.md differs from structured evidence; review and regenerate its text")
        if verify_local_artifacts:
            original = data["originalSummary"]
            digest = hashlib.sha256(file(original["path"]).read_bytes()).hexdigest()
            require(digest == original["sha256"], "Original automated evidence changed")
    except (KeyError, TypeError, ValueError, OSError) as exc:
        errors.append(str(exc))
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--verify-local-artifacts", action="store_true",
                        help="Also require and hash the retained local run; no suites are executed")
    args = parser.parse_args()
    errors = validate(ROOT, verify_local_artifacts=args.verify_local_artifacts)
    for error in errors:
        print(f"ERROR: {error}")
    if not errors:
        print("QA traceability consistent: 20 issues; 3 closed / 17 open; no full-device sign-off. "
              "Product tests were not executed.")
    return int(bool(errors))


if __name__ == "__main__":
    raise SystemExit(main())
