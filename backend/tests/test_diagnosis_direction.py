"""US-12: deterministic, owned direction results from complete saved triage."""

from uuid import uuid4

import pytest

from app.models import User
from app.routers import diagnosis as diagnosis_router
from app.security import create_access_token

CURRENT = "/api/v1/me/diagnosis"
VERSION = "yoir-six-step-v1"
STEPS = ("now", "goal", "tried", "stuck", "barriers")
DEFAULTS = {
    "now": "job",
    "goal": "find_job",
    "tried": [],
    "stuck": "interview",
    "barriers": [],
}


def start(client, headers):
    response = client.post(CURRENT, headers=headers, json={"questionnaireVersion": VERSION})
    assert response.status_code == 200, response.text
    return response.json()


def complete(client, headers, **answers):
    record = start(client, headers)
    values = {**DEFAULTS, **answers}
    for step in STEPS:
        response = client.put(
            f"/api/v1/diagnoses/{record['id']}/steps/{step}",
            headers=headers,
            json={
                "questionnaireVersion": VERSION,
                "expectedRevision": record["revision"],
                "value": values[step],
            },
        )
        assert response.status_code == 200, response.text
        record = response.json()
    return record


def direction_url(record):
    return f"/api/v1/diagnoses/{record['id']}/direction"


def assert_error(response, status_code, code):
    assert response.status_code == status_code, response.text
    body = response.json()
    assert body["code"] == code
    assert body["message"]
    assert body["requestId"]
    assert "area" not in body and "matchingWeights" not in body
    return body


def test_complete_answers_return_a_reproducible_revision_tied_direction(
    client, job_seeker_headers,
):
    record = complete(client, job_seeker_headers, stuck="ksc")

    first = client.get(direction_url(record), headers=job_seeker_headers)
    second = client.get(direction_url(record), headers=job_seeker_headers)

    assert first.status_code == 200
    assert first.json() == second.json()
    result = first.json()
    assert result["diagnosisId"] == record["id"]
    assert result["questionnaireVersion"] == VERSION
    assert result["sourceRevision"] == record["revision"] == 5
    assert result["ruleVersion"] == "yoir-direction-v1"
    assert result["area"] == "Resume and applications"
    assert result["summary"]
    assert len(result["suggestedSteps"]) == 3
    assert result["matchingWeights"]["resume"] == 10
    assert result["matchingWeights"]["job search"] == 1
    assert client.get(CURRENT, headers=job_seeker_headers).json() == record
    assert "no-store" in first.headers.get("cache-control", "")


@pytest.mark.parametrize(("now", "goal", "expected"), [
    ("job", "linkedin", "Networking and LinkedIn"),
    ("study", "other", "Study and upskilling pathway"),
    ("other", "other", "Career direction"),
])
def test_not_sure_falls_back_to_goal_then_situation(
    client, job_seeker_headers, now, goal, expected,
):
    record = complete(client, job_seeker_headers, now=now, goal=goal, stuck="not_sure")
    response = client.get(direction_url(record), headers=job_seeker_headers)
    assert response.status_code == 200
    assert response.json()["area"] == expected


def test_prior_effort_and_barriers_explain_advice_and_matching_without_overriding_main_area(
    client, job_seeker_headers,
):
    record = complete(
        client,
        job_seeker_headers,
        goal="interview",
        tried=["interview"],
        stuck="interview",
        barriers=["work_rights", "market", "local_network"],
    )

    result = client.get(direction_url(record), headers=job_seeker_headers).json()

    assert result["area"] == "Interview skills"
    assert "already put work into this" in result["summary"]
    assert len(result["suggestedSteps"]) == 5  # Three area steps plus at most two barriers.
    assert "visa" in result["suggestedSteps"][3]
    assert result["matchingWeights"]["interview"] == 10
    assert result["matchingWeights"]["qualification"] == 1
    assert result["matchingWeights"]["job search"] == 1
    assert max(result["matchingWeights"].values()) == 10


@pytest.mark.parametrize("completed", range(5))
def test_incomplete_triage_names_missing_progress_and_never_fabricates_a_result(
    client, job_seeker_headers, completed,
):
    record = start(client, job_seeker_headers)
    for step in STEPS[:completed]:
        response = client.put(
            f"/api/v1/diagnoses/{record['id']}/steps/{step}",
            headers=job_seeker_headers,
            json={
                "questionnaireVersion": VERSION,
                "expectedRevision": record["revision"],
                "value": DEFAULTS[step],
            },
        )
        assert response.status_code == 200
        record = response.json()

    body = assert_error(
        client.get(direction_url(record), headers=job_seeker_headers),
        409,
        "INVALID_STATE_TRANSITION",
    )
    assert body["fieldErrors"]["missingSteps"] == ", ".join(STEPS[completed:])


@pytest.mark.parametrize("headers_fixture,status_code", [
    (None, 401), ("counsellor_headers", 403), ("platform_owner_headers", 403),
])
def test_direction_requires_a_job_seeker(
    client, job_seeker_headers, request, headers_fixture, status_code,
):
    record = complete(client, job_seeker_headers)
    headers = request.getfixturevalue(headers_fixture) if headers_fixture else {}
    code = "AUTHENTICATION_REQUIRED" if status_code == 401 else "FORBIDDEN"
    assert_error(client.get(direction_url(record), headers=headers), status_code, code)


def test_foreign_and_unknown_diagnoses_are_indistinguishable(
    client, job_seeker_headers, job_seeker, db_session,
):
    record = complete(client, job_seeker_headers)
    stranger = User(
        name="Second seeker",
        email="direction-stranger@example.com",
        role="job_seeker",
        password_hash=job_seeker.password_hash,
    )
    db_session.add(stranger)
    db_session.commit()
    token, _ = create_access_token(stranger.id, stranger.role)
    headers = {"Authorization": f"Bearer {token}"}

    foreign = assert_error(client.get(direction_url(record), headers=headers), 404, "NOT_FOUND")
    unknown = assert_error(
        client.get(f"/api/v1/diagnoses/{uuid4()}/direction", headers=headers),
        404,
        "NOT_FOUND",
    )
    assert foreign["message"] == unknown["message"]


def test_generation_failure_returns_only_the_standard_error_not_a_fallback_match(
    client, job_seeker_headers, monkeypatch,
):
    record = complete(client, job_seeker_headers)

    def fail(*_args, **_kwargs):
        raise RuntimeError("direction internals must not leak")

    monkeypatch.setattr(diagnosis_router, "direction_for", fail)
    response = client.get(direction_url(record), headers=job_seeker_headers)

    body = assert_error(response, 500, "INTERNAL_ERROR")
    assert body["message"] == "Something went wrong."
    assert "direction internals" not in response.text
