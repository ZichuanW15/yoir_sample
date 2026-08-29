"""Executable checks for published-contract structure and known drift."""

from __future__ import annotations

import csv
import re
from pathlib import Path

import pytest
import yaml

from app.main import app

ROOT = Path(__file__).resolve().parents[2]
CONTRACT_DIR = ROOT / "docs" / "sprint1" / "executable-architecture"
OPENAPI_PATH = CONTRACT_DIR / "openapi.yaml"
TRACEABILITY_PATH = CONTRACT_DIR / "interface-traceability.csv"
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head", "trace"}
IMPLEMENTED_RUNTIME_OPERATION_IDS = {
    "completeStubPayment",
    "createOrder",
    "getService",
    "healthCheck",
    "listServices",
    "listServiceSlots",
    "login",
    "register",
}


@pytest.fixture(scope="module")
def specification() -> dict:
    return yaml.safe_load(OPENAPI_PATH.read_text())


def operations(specification: dict) -> list[tuple[str, str, dict]]:
    return [
        (method.upper(), path, definition)
        for path, path_item in specification["paths"].items()
        for method, definition in path_item.items()
        if method in HTTP_METHODS
    ]


def resolve_ref(specification: dict, ref: str):
    assert ref.startswith("#/"), f"Only local refs are expected, found {ref}"
    node = specification
    for part in ref[2:].split("/"):
        node = node[part.replace("~1", "/").replace("~0", "~")]
    return node


def walk_refs(value):
    if isinstance(value, dict):
        if "$ref" in value:
            yield value["$ref"]
        for child in value.values():
            yield from walk_refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_refs(child)


def path_shape(path: str) -> str:
    """Compare routes by structure while parameter-name drift is tracked separately."""

    return re.sub(r"\{[^{}]+\}", "{}", path.removeprefix("/api/v1"))


def test_openapi_identity_operations_requirements_and_refs(specification: dict) -> None:
    assert specification["openapi"] == "3.0.3"
    operation_rows = operations(specification)
    assert operation_rows, "The published contract must contain at least one operation"
    operation_ids = [definition["operationId"] for _, _, definition in operation_rows]
    assert len(operation_ids) == len(set(operation_ids))
    assert all(definition.get("x-requirement-ids") for _, _, definition in operation_rows)
    refs = set(walk_refs(specification))
    assert refs, "The published contract is expected to reuse local components"
    for ref in refs:
        assert resolve_ref(specification, ref) is not None


def test_traceability_matches_all_openapi_operations(specification: dict) -> None:
    expected = {
        (definition["operationId"], method, path): {
            str(item) for item in definition["x-requirement-ids"]
        }
        for method, path, definition in operations(specification)
    }
    with TRACEABILITY_PATH.open(newline="") as handle:
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
    assert required_columns.issubset(reader.fieldnames or [])
    row_keys = [(row["operationId"], row["method"], row["path"]) for row in rows]
    assert len(row_keys) == len(set(row_keys)), "Duplicate traceability operation rows"
    assert all(row["actor"].strip() for row in rows)
    assert all(row["verification"].strip() for row in rows)

    actual = {
        (row["operationId"], row["method"], row["path"]): set(
            value.strip()
            for value in row["requirement_ids"].split(";")
            if value.strip()
        )
        for row in rows
    }
    assert len(rows) == len(expected)
    assert actual == expected


def test_backend_runtime_is_a_documented_contract_subset(specification: dict) -> None:
    actual = {
        (method.upper(), path_shape(path))
        for path, path_item in app.openapi()["paths"].items()
        for method in path_item
        if method in HTTP_METHODS
    }
    published = {
        (method, path_shape(path)): definition["operationId"]
        for method, path, definition in operations(specification)
    }
    undocumented = actual.difference(published)
    assert undocumented == set()


def test_backend_runtime_matches_the_declared_implemented_boundary(
    specification: dict,
) -> None:
    published = {
        (method, path_shape(path)): definition["operationId"]
        for method, path, definition in operations(specification)
    }
    runtime_signatures = {
        (method.upper(), path_shape(path))
        for path, path_item in app.openapi()["paths"].items()
        for method in path_item
        if method in HTTP_METHODS
    }
    implemented_operation_ids = {
        published[signature]
        for signature in runtime_signatures
        if signature in published
    }
    assert implemented_operation_ids == IMPLEMENTED_RUNTIME_OPERATION_IDS


@pytest.mark.xfail(
    strict=True,
    reason="FastAPI publishes snake_case path parameters while the contract uses camelCase",
)
def test_backend_current_paths_match_published_parameter_names() -> None:
    actual = {
        (method.upper(), path.removeprefix("/api/v1"))
        for path, path_item in app.openapi()["paths"].items()
        for method in path_item
        if method in HTTP_METHODS
    }
    expected = {
        ("GET", "/health"),
        ("POST", "/auth/users"),
        ("POST", "/auth/sessions"),
        ("GET", "/services"),
        ("GET", "/services/{serviceId}"),
        ("GET", "/services/{serviceId}/slots"),
        ("POST", "/orders"),
        ("POST", "/orders/{orderId}/payments/stub"),
    }
    assert actual == expected


@pytest.mark.xfail(
    strict=True,
    reason="Some protected operations omit a published 401 response",
)
def test_every_protected_operation_publishes_401(specification: dict) -> None:
    root_security = specification.get("security")
    missing = []
    for method, path, definition in operations(specification):
        security = definition.get("security", root_security)
        if security and "401" not in definition.get("responses", {}):
            missing.append(f"{method} {path}")
    assert missing == []


@pytest.mark.xfail(
    strict=True,
    reason="A response-only PaymentIntent clientSecret is marked writeOnly",
)
def test_payment_client_secret_is_response_visible(specification: dict) -> None:
    client_secret = specification["components"]["schemas"]["PaymentIntent"]["properties"][
        "clientSecret"
    ]
    assert client_secret.get("writeOnly") is not True


@pytest.mark.xfail(
    strict=True,
    reason="Refresh has no body or cookie carrying a refresh credential",
)
def test_refresh_operation_defines_refresh_credential(specification: dict) -> None:
    refresh = specification["paths"]["/auth/sessions/refresh"]["post"]
    cookie_parameters = [
        parameter
        for parameter in refresh.get("parameters", [])
        if parameter.get("in") == "cookie"
    ]
    assert refresh.get("requestBody") or cookie_parameters


@pytest.mark.xfail(
    strict=True,
    reason="Backend 500 and frontend fixtures use codes absent from the published Error enum",
)
def test_known_runtime_error_codes_are_published(specification: dict) -> None:
    error_codes = set(
        specification["components"]["schemas"]["Error"]["properties"]["code"]["enum"]
    )
    assert {"INTERNAL_ERROR", "CONFLICT", "SERVICE_UNAVAILABLE"}.issubset(error_codes)


@pytest.mark.xfail(
    strict=True,
    reason="GET /services has no published 503 response despite the frontend failure fixture",
)
def test_marketplace_contract_publishes_service_unavailable(specification: dict) -> None:
    assert "503" in specification["paths"]["/services"]["get"]["responses"]
