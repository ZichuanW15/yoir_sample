"""US-13: translate a confirmed US-12 direction into what GET /services
(US-44/US-45) actually accepts — never more, and never silently less.
"""

from uuid import uuid4

import pytest

from app.models import User
from app.security import create_access_token

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
    response = client.post(
        "/api/v1/me/diagnosis", headers=headers, json={"questionnaireVersion": VERSION},
    )
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


def criteria_url(record):
    return f"/api/v1/diagnoses/{record['id']}/marketplace-criteria"


def assert_error(response, status_code, code):
    assert response.status_code == status_code, response.text
    body = response.json()
    assert body["code"] == code
    assert body["message"]
    assert body["requestId"]
    assert "query" not in body
    return body


def test_the_top_weighted_term_becomes_the_marketplace_query(client, job_seeker_headers):
    record = complete(
        client, job_seeker_headers,
        goal="interview", tried=["interview"], stuck="interview",
        barriers=["work_rights", "market", "local_network"],
    )

    response = client.get(criteria_url(record), headers=job_seeker_headers)

    assert response.status_code == 200
    body = response.json()
    assert body["area"] == "Interview skills"
    # "interview" is the Interview area's own first keyword — the main area's
    # keywords are all weight 10 (see test_diagnosis_direction.py's equivalent
    # case), and a stable sort keeps the first-inserted one on top of that tie.
    assert body["query"] == "interview"
    # Everything else the direction named — the rest of the Interview area's
    # own weight-10 keywords included — is a related signal, not the one
    # query string; "qualification" and "job search" come from the barrier
    # and goal passes specifically, confirming those are carried too.
    assert "interview" not in body["unsupportedSignals"]
    assert {"qualification", "job search"} <= set(body["unsupportedSignals"])


def test_modality_is_never_claimed_because_no_answer_names_one(
    client, job_seeker_headers,
):
    record = complete(client, job_seeker_headers)

    body = client.get(criteria_url(record), headers=job_seeker_headers).json()

    assert body["modality"] is None


def test_the_query_actually_finds_a_service_named_for_the_same_term(
    client, job_seeker_headers, counsellor_headers,
):
    """The point of US-13 is a criterion the Marketplace can really use — proved
    here by round-tripping the suggested query through GET /services."""
    created = client.post(
        "/api/v1/me/services", headers=counsellor_headers,
        json={
            "title": "Mock interview coaching", "description": "Practice and feedback.",
            "priceMinor": 8000, "currency": "AUD", "modalities": ["online"],
        },
    )
    assert created.status_code == 201, created.text

    record = complete(client, job_seeker_headers, goal="interview", stuck="interview")
    criteria = client.get(criteria_url(record), headers=job_seeker_headers).json()
    assert criteria["query"] == "interview"

    found = client.get("/api/v1/services", params={"query": criteria["query"]})
    assert found.status_code == 200
    assert any(service["title"] == "Mock interview coaching" for service in found.json())


@pytest.mark.parametrize("completed", range(5))
def test_incomplete_triage_names_missing_progress_and_never_fabricates_criteria(
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
        client.get(criteria_url(record), headers=job_seeker_headers),
        409,
        "INVALID_STATE_TRANSITION",
    )
    assert body["fieldErrors"]["missingSteps"] == ", ".join(STEPS[completed:])


@pytest.mark.parametrize("headers_fixture,status_code", [
    (None, 401), ("counsellor_headers", 403), ("platform_owner_headers", 403),
])
def test_marketplace_criteria_requires_a_job_seeker(
    client, job_seeker_headers, request, headers_fixture, status_code,
):
    record = complete(client, job_seeker_headers)
    headers = request.getfixturevalue(headers_fixture) if headers_fixture else {}
    code = "AUTHENTICATION_REQUIRED" if status_code == 401 else "FORBIDDEN"
    assert_error(client.get(criteria_url(record), headers=headers), status_code, code)


def test_foreign_and_unknown_diagnoses_are_indistinguishable(
    client, job_seeker_headers, job_seeker, db_session,
):
    record = complete(client, job_seeker_headers)
    stranger = User(
        name="Second seeker", email="criteria-stranger@example.com",
        role="job_seeker", password_hash=job_seeker.password_hash,
    )
    db_session.add(stranger)
    db_session.commit()
    token, _ = create_access_token(stranger.id, stranger.role)
    headers = {"Authorization": f"Bearer {token}"}

    foreign = assert_error(client.get(criteria_url(record), headers=headers), 404, "NOT_FOUND")
    unknown = assert_error(
        client.get(f"/api/v1/diagnoses/{uuid4()}/marketplace-criteria", headers=headers),
        404,
        "NOT_FOUND",
    )
    assert foreign["message"] == unknown["message"]


def test_the_response_is_not_cached(client, job_seeker_headers):
    record = complete(client, job_seeker_headers)
    response = client.get(criteria_url(record), headers=job_seeker_headers)
    assert response.headers["Cache-Control"] == "no-store"
