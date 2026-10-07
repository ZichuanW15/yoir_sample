"""Executable checks for published-contract structure and known drift."""

from __future__ import annotations

import csv
import re
from pathlib import Path

import pytest
import yaml
from qa_acceptance import KnownAcceptanceDefect

from app.main import app

ROOT = Path(__file__).resolve().parents[2]
CONTRACT_DIR = ROOT / "docs" / "sprint1" / "executable-architecture"
OPENAPI_PATH = CONTRACT_DIR / "openapi.yaml"
TRACEABILITY_PATH = CONTRACT_DIR / "interface-traceability.csv"
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "options", "head", "trace"}
IMPLEMENTED_RUNTIME_OPERATION_IDS = {
    "cancelBooking",
    "completeStubPayment",
    "createAvailabilityWindow",
    "createOrder",
    "createPaymentIntent",
    "createService",
    "decideVerification",
    "deleteAvailabilityWindow",
    "deleteService",
    "getBooking",
    "getBookingReceipt",
    "getCommissionStatement",
    "getCounsellorProfile",
    "getOwnCounsellorProfile",
    "getProfileVisibility",
    "getOnboardingState",
    "getOrder",
    "getOwnJobSeekerProfile",
    "getPaymentConfig",
    "getPayoutStatus",
    "getPlatformStats",
    "getService",
    "healthCheck",
    "listAllBookings",
    "listAllCounsellors",
    "listAllJobSeekers",
    "listCounsellors",
    "listMyBookings",
    "listOwnAvailabilityWindows",
    "listOwnServices",
    "listPaymentOversight",
    "listServices",
    "listServiceSlots",
    "listVerificationSubmissions",
    "login",
    "logout",
    "processStripeConnectWebhook",
    "processStripeWebhook",
    "refreshSession",
    "register",
    "requestEmailVerification",
    "requestPasswordReset",
    "resetPassword",
    "setBookingMeetingAddress",
    "startStripeOnboarding",
    "stripeOnboardingRefresh",
    "stripeOnboardingReturn",
    "submitVerification",
    "updateAvailabilityWindow",
    "updateOwnCounsellorProfile",
    "updateOwnJobSeekerProfile",
    "updateProfileVisibility",
    "updateService",
    "updateTaxDetails",
    "verifyEmail",
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


@pytest.mark.future_contract
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


@pytest.mark.future_contract
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
    raises=KnownAcceptanceDefect,
    reason="FastAPI publishes snake_case path parameters while the contract uses camelCase",
)
def test_backend_current_paths_match_published_parameter_names(specification: dict) -> None:
    actual = {
        (method.upper(), path.removeprefix("/api/v1"))
        for path, path_item in app.openapi()["paths"].items()
        for method in path_item
        if method in HTTP_METHODS
    }
    expected = {
        (method, path)
        for method, path, definition in operations(specification)
        if definition["operationId"] in IMPLEMENTED_RUNTIME_OPERATION_IDS
    }
    # Missing/extra operations are real failures, not the named parameter defect.
    assert {(method, path_shape(path)) for method, path in actual} == {
        (method, path_shape(path)) for method, path in expected
    }
    if actual != expected:
        raise KnownAcceptanceDefect(f"Runtime parameter names differ: {actual - expected}")


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="Implemented counsellor operations omit a published 401 response",
)
def test_every_implemented_protected_operation_publishes_401(specification: dict) -> None:
    root_security = specification.get("security")
    missing = []
    checked = []
    for method, path, definition in operations(specification):
        if definition["operationId"] not in IMPLEMENTED_RUNTIME_OPERATION_IDS:
            continue
        security = definition.get("security", root_security)
        if security:
            checked.append(definition["operationId"])
            assert isinstance(definition.get("responses"), dict)
            if "401" not in definition["responses"]:
                missing.append(f"{method} {path}")
    assert {"logout", "createOrder", "createService"}.issubset(checked)
    if missing:
        raise KnownAcceptanceDefect(f"Implemented operations omit 401: {missing}")


def test_payment_client_secret_is_response_visible(specification: dict) -> None:
    """Closed with the payment implementation: PaymentSheet reads clientSecret out of
    the createPaymentIntent response, and writeOnly hid it from generated clients."""
    client_secret = specification["components"]["schemas"]["PaymentIntent"]["properties"][
        "clientSecret"
    ]
    assert client_secret.get("writeOnly") is not True


def test_refresh_operation_defines_refresh_credential(specification: dict) -> None:
    """Closed with the refresh implementation: the operation now names the credential
    it runs on, rather than describing a rotation with no way to ask for one."""
    refresh = specification["paths"]["/auth/sessions/refresh"]["post"]
    cookie_parameters = [
        parameter
        for parameter in refresh.get("parameters", [])
        if parameter.get("in") == "cookie"
    ]
    assert refresh.get("requestBody") or cookie_parameters


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="The implemented backend 500 handler emits unpublished INTERNAL_ERROR",
)
def test_runtime_internal_error_code_is_published(specification: dict) -> None:
    error_codes = set(
        specification["components"]["schemas"]["Error"]["properties"]["code"]["enum"]
    )
    assert {"NOT_FOUND", "VALIDATION_ERROR", "SLOT_UNAVAILABLE"}.issubset(error_codes)
    if "INTERNAL_ERROR" not in error_codes:
        raise KnownAcceptanceDefect("Runtime INTERNAL_ERROR is absent from the published enum")


@pytest.mark.xfail(
    strict=True,
    reason="GET /services has no published 503 response despite the frontend failure fixture",
)
@pytest.mark.future_contract
def test_marketplace_contract_publishes_service_unavailable(specification: dict) -> None:
    assert "503" in specification["paths"]["/services"]["get"]["responses"]


@pytest.mark.parametrize(("method", "path"), [
    ("get", "/me/services"), ("post", "/me/services"),
    ("get", "/me/availability-windows"), ("post", "/me/availability-windows"),
    ("patch", "/me/availability-windows/{window_id}"),
    ("delete", "/me/availability-windows/{window_id}"),
])
def test_every_counsellor_operation_publishes_real_bearer_auth(method: str, path: str) -> None:
    runtime = app.openapi()
    assert runtime["paths"][f"/api/v1{path}"][method]["security"] == [{"bearerAuth": []}]
    assert runtime["components"]["securitySchemes"]["bearerAuth"]["scheme"] == "bearer"


@pytest.mark.parametrize("path", ["/services", "/services/{service_id}",
                                 "/services/{service_id}/slots"])
def test_public_marketplace_operations_do_not_advertise_required_auth(path: str) -> None:
    runtime = app.openapi()
    operation = runtime["paths"][f"/api/v1{path}"]["get"]
    assert not operation.get("security", runtime.get("security"))


@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason="S2-BE-RUNTIME-400: counsellor OpenAPI advertises 422 while real validation returns 400",
)
@pytest.mark.parametrize(("method", "path", "payload"), [
    ("post", "/me/services", {}),
    ("post", "/me/availability-windows", {}),
    ("patch", "/me/availability-windows/{window_id}", {"startsAt": "invalid-datetime"}),
])
def test_counsellor_openapi_documents_the_actual_validation_status(
    client, counsellor_headers: dict[str, str], method: str, path: str, payload: dict,
) -> None:
    response = client.request(method, "/api/v1" + path.format(window_id="missing-window"),
                              headers=counsellor_headers, json=payload)
    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert response.json()["fieldErrors"]
    operation = app.openapi()["paths"][f"/api/v1{path}"][method]
    responses = operation["responses"]
    if "400" not in responses or "422" in responses:
        raise KnownAcceptanceDefect(f"{method.upper()} {path} declares {sorted(responses)}")
