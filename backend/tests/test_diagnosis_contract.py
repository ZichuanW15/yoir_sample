"""Keep the handoff's diagnosis contract aligned with the running API."""
from pathlib import Path

import pytest
import yaml

from app.diagnosis import QUESTIONNAIRE
from app.main import app

CONTRACT = Path(__file__).resolve().parents[2] / "docs/sprint1/executable-architecture/openapi.yaml"


@pytest.fixture(scope="module")
def published():
    return yaml.safe_load(CONTRACT.read_text())


def resolve(document, schema):
    if "$ref" not in schema:
        return schema
    value = document
    for part in schema["$ref"].removeprefix("#/").split("/"):
        value = value[part]
    return value


@pytest.mark.parametrize("method,path", [
    ("get", "/me/diagnosis/questionnaire"),
    ("post", "/me/diagnosis"),
    ("get", "/me/diagnosis"),
    ("get", "/diagnoses/{diagnosisId}"),
    ("get", "/diagnoses/{diagnosisId}/direction"),
    ("put", "/diagnoses/{diagnosisId}/steps/{stepId}"),
])
def test_runtime_operations_match_published_authentication_and_errors(published, method, path):
    runtime = app.openapi()
    actual = runtime["paths"][f"/api/v1{path}"][method]
    expected = published["paths"][path][method]
    assert actual["operationId"] == expected["operationId"]
    assert actual["x-requirement-ids"] == expected["x-requirement-ids"]
    assert actual["security"] == [{"bearerAuth": []}]
    assert set(expected["responses"]).issubset(actual["responses"])
    assert "422" not in actual["responses"]
    for code in ("400", "401", "403", "404", "409"):
        body = resolve(runtime, actual["responses"][code]["content"]["application/json"]["schema"])
        assert set(body["required"]) == {"code", "message", "requestId"}
        assert set(body["properties"]) == {"code", "message", "requestId", "fieldErrors"}


@pytest.mark.parametrize("method,path", [
    ("post", "/me/diagnosis"),
    ("put", "/diagnoses/{diagnosisId}/steps/{stepId}"),
])
def test_runtime_write_contract_rejects_unpublished_fields(published, method, path):
    runtime = app.openapi()
    actual = runtime["paths"][f"/api/v1{path}"][method]["requestBody"]
    expected = published["paths"][path][method]["requestBody"]
    assert actual["required"] is expected["required"] is True
    actual_schema = resolve(runtime, actual["content"]["application/json"]["schema"])
    expected_schema = resolve(published, expected["content"]["application/json"]["schema"])
    assert set(actual_schema["required"]) == set(expected_schema["required"])
    assert set(actual_schema["properties"]) == set(expected_schema["properties"])
    assert actual_schema["additionalProperties"] is expected_schema["additionalProperties"] is False


def test_published_answer_choices_match_the_versioned_questionnaire(published):
    answers = published["components"]["schemas"]["DiagnosisAnswers"]["properties"]
    for question in QUESTIONNAIRE.steps:
        field = answers[question.id]
        assert field["type"] == ("array" if question.multiple else "string")
        choices = field["items"] if question.multiple else field
        assert choices["enum"] == [option.id for option in question.options]
