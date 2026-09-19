"""US-01: the app can integrate registration using the published HTTP contract."""

from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

from app.main import app

CONTRACT_PATH = (
    Path(__file__).resolve().parents[2]
    / "docs/sprint1/executable-architecture/openapi.yaml"
)


def resolve_schema(document: dict, schema: dict) -> dict:
    if "$ref" not in schema:
        return schema
    node = document
    for part in schema["$ref"].removeprefix("#/").split("/"):
        node = node[part]
    return node


@pytest.fixture(scope="module")
def published_contract() -> dict:
    return yaml.safe_load(CONTRACT_PATH.read_text())


def test_registration_request_matches_published_app_fields(published_contract: dict) -> None:
    runtime = app.openapi()
    operation = runtime["paths"]["/api/v1/auth/users"]["post"]
    request_body = operation["requestBody"]
    request_schema = resolve_schema(
        runtime, request_body["content"]["application/json"]["schema"]
    )
    published = published_contract["components"]["schemas"]["RegisterRequest"]

    assert request_body["required"] is True
    assert set(request_schema["required"]) == set(published["required"])
    assert set(request_schema["properties"]) == set(published["properties"])
    assert request_schema["additionalProperties"] is published["additionalProperties"] is False
    for name, expected in published["properties"].items():
        actual = request_schema["properties"][name]
        for constraint in ("type", "format", "minLength", "maxLength", "enum"):
            if constraint in expected:
                assert actual[constraint] == expected[constraint], (name, constraint)
    for name in ("password", "passwordConfirmation"):
        assert request_schema["properties"][name]["writeOnly"] is True


def test_registration_publishes_public_success_and_error_responses(
    published_contract: dict,
) -> None:
    runtime = app.openapi()
    actual = runtime["paths"]["/api/v1/auth/users"]["post"]
    published = published_contract["paths"]["/auth/users"]["post"]

    assert actual["operationId"] == published["operationId"] == "register"
    assert actual.get("security", runtime.get("security", [])) == []
    assert set(actual["x-requirement-ids"]) == set(published["x-requirement-ids"])
    assert set(published["responses"]).issubset(actual["responses"])
    assert "422" not in actual["responses"]

    success = resolve_schema(
        runtime, actual["responses"]["201"]["content"]["application/json"]["schema"]
    )
    published_user = published_contract["components"]["schemas"]["User"]
    assert set(success["required"]) == set(published_user["required"])
    assert set(success["properties"]) == set(published_user["properties"])
    for code in ("400", "409"):
        error = resolve_schema(
            runtime, actual["responses"][code]["content"]["application/json"]["schema"]
        )
        assert set(error["required"]) == {"code", "message", "requestId"}
        assert set(error["properties"]) == {"code", "message", "requestId", "fieldErrors"}


@pytest.mark.parametrize("expected_status", [400, 409])
def test_registration_errors_follow_the_advertised_body(
    client: TestClient, expected_status: int
) -> None:
    payload = {
        "name": "Contract Test",
        "email": "contract-test@example.com",
        "password": "contract-password",
        "passwordConfirmation": "contract-password",
        "role": "job_seeker",
    }
    if expected_status == 409:
        assert client.post("/api/v1/auth/users", json=payload).status_code == 201
    else:
        payload["email"] = "invalid-email"

    response = client.post("/api/v1/auth/users", json=payload)
    assert response.status_code == expected_status
    runtime = app.openapi()
    error_schema = resolve_schema(
        runtime,
        runtime["paths"]["/api/v1/auth/users"]["post"]["responses"][str(expected_status)]
        ["content"]["application/json"]["schema"],
    )
    body = response.json()
    assert set(error_schema["required"]).issubset(body)
    assert set(body).issubset(error_schema["properties"])
    assert body["code"] == "VALIDATION_ERROR"
    assert body["message"]
    assert body["requestId"] == response.headers["x-request-id"]
    assert isinstance(body["fieldErrors"]["email"], str)
    assert body["fieldErrors"]["email"]
    assert payload["password"] not in response.text
