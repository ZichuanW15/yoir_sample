#!/usr/bin/env python3
"""QA checks for repository links, YAML, JSON and contract traceability."""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

import yaml

ROOT = Path(__file__).resolve().parents[1]
IGNORED_PARTS = {".git", ".expo", ".venv", "node_modules", "coverage", "dist", "build"}
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head", "trace"}
MARKDOWN_LINK = re.compile(r"!?\[[^\]]*\]\(([^)]+)\)")


def markdown_files() -> list[Path]:
    return [
        path
        for path in ROOT.rglob("*.md")
        if not any(part in IGNORED_PARTS for part in path.relative_to(ROOT).parts)
    ]


def check_markdown_links() -> tuple[int, list[str]]:
    checked = 0
    broken: list[str] = []
    for markdown in markdown_files():
        for line_number, line in enumerate(markdown.read_text(errors="replace").splitlines(), 1):
            for match in MARKDOWN_LINK.finditer(line):
                target = match.group(1).strip()
                if target.startswith("<") and ">" in target:
                    target = target[1 : target.index(">")]
                else:
                    target = target.split(maxsplit=1)[0]
                if not target or target.startswith(("#", "/", "http://", "https://", "mailto:")):
                    continue
                path_text = unquote(target.split("#", 1)[0].split("?", 1)[0])
                if not path_text:
                    continue
                checked += 1
                resolved = (markdown.parent / path_text).resolve()
                if not resolved.exists():
                    broken.append(
                        f"{markdown.relative_to(ROOT)}:{line_number} -> {target}"
                    )
    return checked, broken


def walk_refs(value):
    if isinstance(value, dict):
        if "$ref" in value:
            yield value["$ref"]
        for child in value.values():
            yield from walk_refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_refs(child)


def resolve_ref(specification: dict, ref: str):
    if not ref.startswith("#/"):
        raise AssertionError(f"Unexpected external ref: {ref}")
    node = specification
    for part in ref[2:].split("/"):
        node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def check_contract() -> tuple[int, int]:
    openapi_path = ROOT / "docs" / "api" / "openapi.yaml"
    traceability_path = ROOT / "docs" / "traceability" / "interface-traceability.csv"
    specification = yaml.safe_load(openapi_path.read_text())
    operations = [
        (definition["operationId"], method.upper(), path, definition)
        for path, path_item in specification["paths"].items()
        for method, definition in path_item.items()
        if method in HTTP_METHODS
    ]
    assert specification["openapi"] == "3.0.3", "Expected an OpenAPI 3.0.3 contract"
    assert operations, "The published contract must contain at least one operation"
    operation_ids = [item[0] for item in operations]
    assert len(operation_ids) == len(set(operation_ids)), "Duplicate operationId"
    assert all(item[3].get("x-requirement-ids") for item in operations), (
        "Every operation must declare x-requirement-ids"
    )

    refs = set(walk_refs(specification))
    for ref in refs:
        resolve_ref(specification, ref)

    expected = {
        (operation_id, method, path): {str(value) for value in definition["x-requirement-ids"]}
        for operation_id, method, path, definition in operations
    }
    with traceability_path.open(newline="") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
    required_columns = {
        "operationId",
        "method",
        "path",
        "actor",
        "requirement_ids",
        "verification",
    }
    missing_columns = required_columns.difference(reader.fieldnames or [])
    assert not missing_columns, (
        f"Traceability is missing required columns: {sorted(missing_columns)}"
    )
    row_keys = [(row["operationId"], row["method"], row["path"]) for row in rows]
    assert len(row_keys) == len(set(row_keys)), "Duplicate traceability operation rows"
    assert all(row["actor"].strip() for row in rows), "Traceability actor must be populated"
    assert all(row["verification"].strip() for row in rows), (
        "Traceability verification must be populated"
    )
    actual = {
        (row["operationId"], row["method"], row["path"]): set(
            value.strip()
            for value in row["requirement_ids"].split(";")
            if value.strip()
        )
        for row in rows
    }
    assert len(rows) == len(expected), (
        "Traceability must contain exactly one row per OpenAPI operation"
    )
    assert actual == expected, "Traceability operation/method/path/requirements drift"
    return len(operations), len(refs)


def main() -> int:
    failures: list[str] = []

    for workflow in sorted((ROOT / ".github" / "workflows").glob("*.yml")):
        try:
            yaml.safe_load(workflow.read_text())
        except Exception as error:  # pragma: no cover - diagnostic path
            failures.append(f"{workflow.relative_to(ROOT)}: {error}")

    seed_path = ROOT / "backend" / "app" / "seed_data.json"
    if seed_path.exists():
        try:
            json.loads(seed_path.read_text())
        except Exception as error:  # pragma: no cover - diagnostic path
            failures.append(f"{seed_path.relative_to(ROOT)}: {error}")

    try:
        operation_count, ref_count = check_contract()
        print(f"OpenAPI/traceability: {operation_count} operations, {ref_count} local refs, Pass")
    except Exception as error:
        failures.append(f"OpenAPI/traceability: {error}")

    checked_links, broken_links = check_markdown_links()
    print(f"Markdown relative links: {checked_links} checked, {len(broken_links)} broken")
    failures.extend(broken_links)

    if failures:
        for failure in failures:
            print(f"FAIL {failure}", file=sys.stderr)
        return 1

    print("Workflow YAML and seed JSON: Pass")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
