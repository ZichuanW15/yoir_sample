"""US-09/10/11: private, durable diagnosis progress with validated step saves.

These tests stop at completed answers. Recommendations and professional matching
belong to US-12/13 and are deliberately not inferred from a finished questionnaire.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from uuid import uuid4

import jwt
import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session
from sqlalchemy.sql.dml import Insert, Update

from app.config import get_settings
from app.db import SessionLocal, get_db
from app.main import app
from app.models import Diagnosis, User
from app.security import create_access_token

CURRENT = "/api/v1/me/diagnosis"
QUESTIONNAIRE = f"{CURRENT}/questionnaire"
VERSION = "yoir-six-step-v1"
STEPS = ("now", "goal", "tried", "stuck", "barriers")
VALUES = ("job", "find_job", [], "resume", [])
OPTIONS = {
    "now": {"job", "change", "study", "returning", "direction", "other"},
    "goal": {
        "find_job", "more_interviews", "resume", "interview", "options", "course",
        "recognition", "network", "linkedin", "other",
    },
    "tried": {
        "applications", "resume", "interview", "study", "networking", "linkedin",
        "recognition", "other",
    },
    "stuck": {
        "direction", "search", "resume", "cover_letter", "ksc", "interview", "market",
        "recognition", "networking", "linkedin", "study", "not_sure",
    },
    "barriers": {
        "work_rights", "recognition", "licensing", "market", "local_network", "other",
        "not_sure",
    },
}


def start(client, headers):
    response = client.post(CURRENT, headers=headers, json={"questionnaireVersion": VERSION})
    assert response.status_code == 200, response.text
    return response.json()


def step_url(record, step):
    return f"/api/v1/diagnoses/{record['id']}/steps/{step}"


def save(client, headers, record, step, value, **extra):
    return client.put(step_url(record, step), headers=headers, json={
        "questionnaireVersion": VERSION,
        "expectedRevision": record["revision"],
        "value": value,
        **extra,
    })


def progress_to(client, headers, count):
    record = start(client, headers)
    for step, value in zip(STEPS[:count], VALUES[:count], strict=True):
        response = save(client, headers, record, step, value)
        assert response.status_code == 200, response.text
        record = response.json()
    return record


def assert_error(response, status_code, code):
    assert response.status_code == status_code, response.text
    body = response.json()
    assert body["code"] == code
    assert body["message"]
    assert body["requestId"]
    return body


def test_questionnaire_publishes_existing_five_question_contract(client, job_seeker_headers):
    response = client.get(QUESTIONNAIRE, headers=job_seeker_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["version"] == VERSION
    assert body["totalSteps"] == 6
    assert [question["id"] for question in body["steps"]] == list(STEPS)
    assert [question["step"] for question in body["steps"]] == [1, 2, 3, 4, 5]
    for question in body["steps"]:
        key = question["id"]
        assert question["title"]
        assert question["hint"]
        assert question["multiple"] is (key in {"tried", "barriers"})
        assert question["otherAllowed"] is (key != "stuck")
        assert {option["id"] for option in question["options"]} == OPTIONS[key]
        assert all(option["label"] for option in question["options"])
    assert body["resultStep"] == {
        "step": 6, "title": "Your Yoir Direction", "requiresAnswers": True,
    }


def test_start_is_safe_to_repeat_and_read_has_no_creation_side_effect(
    client, job_seeker_headers, job_seeker, db_session,
):
    assert_error(client.get(CURRENT, headers=job_seeker_headers), 404, "NOT_FOUND")
    assert db_session.scalar(select(func.count()).select_from(Diagnosis)) == 0
    record = start(client, job_seeker_headers)
    assert record["questionnaireVersion"] == VERSION
    assert record["revision"] == 0
    assert record["status"] == "in_progress"
    assert record["currentStep"] == 1
    assert record["totalSteps"] == 6
    assert record["completedSteps"] == []
    assert record["answers"] == {"other": {}}
    created_at = datetime.fromisoformat(record["createdAt"].replace("Z", "+00:00"))
    assert created_at.utcoffset() is not None
    updated_at = datetime.fromisoformat(record["updatedAt"].replace("Z", "+00:00"))
    assert updated_at >= created_at
    assert start(client, job_seeker_headers) == record
    assert client.get(CURRENT, headers=job_seeker_headers).json() == record
    assert client.get(
        f"/api/v1/diagnoses/{record['id']}", headers=job_seeker_headers,
    ).json() == record
    db_session.expire_all()
    rows = list(db_session.scalars(select(Diagnosis)))
    assert len(rows) == 1 and rows[0].job_seeker_id == job_seeker.id


def test_each_successful_step_persists_before_advancing_and_resumes_in_new_session(
    client, job_seeker_headers,
):
    record = start(client, job_seeker_headers)
    expected_answers = {"other": {}}
    for index, (step, value) in enumerate(zip(STEPS, VALUES, strict=True), start=1):
        response = save(client, job_seeker_headers, record, step, value)
        assert response.status_code == 200, response.text
        expected_answers[step] = value
        record = response.json()
        assert record["revision"] == index
        assert record["answers"] == expected_answers
        assert record["completedSteps"] == list(STEPS[:index])
        assert record["currentStep"] == index + 1
        assert record["status"] == ("answers_complete" if index == 5 else "in_progress")
        with SessionLocal() as fresh_db:
            persisted = fresh_db.get(Diagnosis, record["id"])
            assert persisted is not None
            assert persisted.answers == expected_answers
            assert persisted.revision == index
        assert start(client, job_seeker_headers) == record
        assert client.get(CURRENT, headers=job_seeker_headers).json() == record
    assert "direction" not in record and "matches" not in record


@pytest.mark.parametrize("completed", [3, 5])
def test_editing_an_earlier_step_retains_later_answers_and_resume_position(
    client, job_seeker_headers, completed,
):
    before = progress_to(client, job_seeker_headers, completed)
    response = save(client, job_seeker_headers, before, "now", "change")
    assert response.status_code == 200
    after = response.json()
    assert after["answers"] == {**before["answers"], "now": "change"}
    assert after["revision"] == before["revision"] + 1
    for key in ("id", "createdAt", "currentStep", "completedSteps", "status"):
        assert after[key] == before[key]


@pytest.mark.parametrize("step", ["goal", "tried", "stuck", "barriers"])
def test_future_steps_cannot_skip_unanswered_predecessors(client, job_seeker_headers, step):
    before = start(client, job_seeker_headers)
    response = save(client, job_seeker_headers, before, step, VALUES[STEPS.index(step)])
    assert_error(response, 409, "INVALID_STATE_TRANSITION")
    assert client.get(CURRENT, headers=job_seeker_headers).json() == before


@pytest.mark.parametrize("step,value", [
    ("now", ""), ("now", "unknown"), ("now", []), ("now", 123), ("now", None),
    ("goal", "search"), ("goal", ["find_job"]), ("tried", "resume"),
    ("tried", ["unknown"]), ("tried", ["resume", "resume"]),
    ("tried", ["resume", 1]), ("tried", None), ("stuck", "other"),
    ("stuck", ["resume"]), ("barriers", "market"), ("barriers", ["unknown"]),
    ("barriers", ["market", "market"]), ("barriers", [False]),
])
def test_invalid_answers_return_field_errors_without_mutating_saved_progress(
    client, job_seeker_headers, step, value,
):
    before = progress_to(client, job_seeker_headers, STEPS.index(step))
    response = save(client, job_seeker_headers, before, step, value)
    body = assert_error(response, 400, "VALIDATION_ERROR")
    assert body.get("fieldErrors")
    assert client.get(CURRENT, headers=job_seeker_headers).json() == before


@pytest.mark.parametrize("changes", [
    {"expectedRevision": -1}, {"expectedRevision": True}, {"expectedRevision": "0"},
    {"expectedRevision": 0.5}, {"questionnaireVersion": "invented-v2"},
    {"other": "x" * 201}, {"other": ["text"]}, {"jobSeekerId": "someone-else"},
    {"currentStep": 6}, {"status": "answers_complete"}, {"direction": "made up"},
])
def test_invalid_request_metadata_cannot_change_owner_progress_or_answers(
    client, job_seeker_headers, changes,
):
    before = start(client, job_seeker_headers)
    response = save(client, job_seeker_headers, before, "now", "other", **changes)
    assert_error(response, 400, "VALIDATION_ERROR")
    assert client.get(CURRENT, headers=job_seeker_headers).json() == before


@pytest.mark.parametrize("payload", [
    {}, {"questionnaireVersion": "old-version"},
    {"questionnaireVersion": VERSION, "jobSeekerId": "not-caller"},
])
def test_start_rejects_missing_version_and_extra_fields_without_creating_record(
    client, job_seeker_headers, payload,
):
    assert_error(client.post(CURRENT, headers=job_seeker_headers, json=payload),
                 400, "VALIDATION_ERROR")
    assert_error(client.get(CURRENT, headers=job_seeker_headers), 404, "NOT_FOUND")


@pytest.mark.parametrize("omitted", ["value", "expectedRevision", "questionnaireVersion"])
def test_step_requires_all_contract_fields(client, job_seeker_headers, omitted):
    before = start(client, job_seeker_headers)
    payload = {"value": "job", "expectedRevision": 0, "questionnaireVersion": VERSION}
    payload.pop(omitted)
    assert_error(client.put(step_url(before, "now"), headers=job_seeker_headers, json=payload),
                 400, "VALIDATION_ERROR")
    assert client.get(CURRENT, headers=job_seeker_headers).json() == before


@pytest.mark.parametrize("step", ["now", "goal", "tried", "barriers"])
@pytest.mark.parametrize("clear", ["omit", "null", "changed_choice"])
def test_optional_other_text_is_saved_and_cleared_without_changing_other_steps(
    client, job_seeker_headers, step, clear,
):
    record = progress_to(client, job_seeker_headers, STEPS.index(step))
    value = ["other"] if step in {"tried", "barriers"} else "other"
    saved = save(client, job_seeker_headers, record, step, value, other="My own situation")
    assert saved.status_code == 200, saved.text
    record = saved.json()
    assert record["answers"]["other"][step] == "My own situation"
    extra = {"other": None} if clear == "null" else {}
    value = VALUES[STEPS.index(step)] if clear == "changed_choice" else value
    changed = save(client, job_seeker_headers, record, step, value, **extra)
    assert changed.status_code == 200, changed.text
    assert step not in changed.json()["answers"]["other"]
    assert changed.json()["completedSteps"] == record["completedSteps"]


def test_other_text_is_not_accepted_without_other_option(client, job_seeker_headers):
    before = start(client, job_seeker_headers)
    assert_error(save(client, job_seeker_headers, before, "now", "job", other="hidden note"),
                 400, "VALIDATION_ERROR")
    assert client.get(CURRENT, headers=job_seeker_headers).json() == before


def test_other_text_accepts_the_200_character_limit_without_losing_unicode(
    client, job_seeker_headers,
):
    before = start(client, job_seeker_headers)
    note = "职业" * 100
    response = save(client, job_seeker_headers, before, "now", "other", other=note)
    assert response.status_code == 200
    assert response.json()["answers"]["other"] == {"now": note}
    assert client.get(CURRENT, headers=job_seeker_headers).json()["answers"]["other"] == {
        "now": note,
    }


def test_optional_empty_multichoice_and_not_sure_combinations_are_not_invented_errors(
    client, job_seeker_headers,
):
    record = progress_to(client, job_seeker_headers, 4)
    response = save(client, job_seeker_headers, record, "barriers", ["not_sure", "market"])
    assert response.status_code == 200
    assert response.json()["answers"]["barriers"] == ["not_sure", "market"]


@pytest.mark.parametrize("step", ["step-six", "6", "recommendations"])
def test_unknown_step_never_generates_a_result_or_updates_progress(
    client, job_seeker_headers, step,
):
    before = progress_to(client, job_seeker_headers, 5)
    assert_error(save(client, job_seeker_headers, before, step, "resume"),
                 400, "VALIDATION_ERROR")
    assert client.get(CURRENT, headers=job_seeker_headers).json() == before


def test_stale_revision_is_rejected_without_overwriting_newer_answers(client, job_seeker_headers):
    stale = start(client, job_seeker_headers)
    response = save(client, job_seeker_headers, stale, "now", "job")
    assert response.status_code == 200
    latest = response.json()
    assert_error(save(client, job_seeker_headers, stale, "now", "change"),
                 409, "INVALID_STATE_TRANSITION")
    assert client.get(CURRENT, headers=job_seeker_headers).json() == latest
    retried = save(client, job_seeker_headers, latest, "now", "change")
    assert retried.status_code == 200
    assert retried.json()["answers"]["now"] == "change"


@pytest.mark.parametrize("headers_fixture,status_code", [
    (None, 401), ("counsellor_headers", 403), ("platform_owner_headers", 403),
])
def test_all_diagnosis_routes_require_a_job_seeker(
    client, job_seeker_headers, request, headers_fixture, status_code,
):
    record = start(client, job_seeker_headers)
    headers = request.getfixturevalue(headers_fixture) if headers_fixture else {}
    calls = [
        client.get(QUESTIONNAIRE, headers=headers),
        client.get(CURRENT, headers=headers),
        client.post(CURRENT, headers=headers, json={"questionnaireVersion": VERSION}),
        client.get(f"/api/v1/diagnoses/{record['id']}", headers=headers),
        save(client, headers, record, "now", "job"),
    ]
    code = "AUTHENTICATION_REQUIRED" if status_code == 401 else "FORBIDDEN"
    for response in calls:
        assert_error(response, status_code, code)
    assert client.get(CURRENT, headers=job_seeker_headers).json() == record


def test_another_job_seeker_cannot_read_or_modify_a_foreign_diagnosis(
    client, job_seeker_headers, db_session, job_seeker,
):
    victim = progress_to(client, job_seeker_headers, 1)
    stranger = User(name="Second seeker", email="second@example.com", role="job_seeker",
                    password_hash=job_seeker.password_hash)
    db_session.add(stranger)
    db_session.commit()
    token, _ = create_access_token(stranger.id, stranger.role)
    headers = {"Authorization": f"Bearer {token}"}
    assert_error(client.get(CURRENT, headers=headers), 404, "NOT_FOUND")
    foreign_get = assert_error(
        client.get(f"/api/v1/diagnoses/{victim['id']}", headers=headers), 404, "NOT_FOUND",
    )
    unknown_get = assert_error(
        client.get(f"/api/v1/diagnoses/{uuid4()}", headers=headers), 404, "NOT_FOUND",
    )
    assert foreign_get["message"] == unknown_get["message"]
    assert_error(save(client, headers, victim, "now", "change"), 404, "NOT_FOUND")
    assert client.get(CURRENT, headers=job_seeker_headers).json() == victim
    own = start(client, headers)
    assert own["id"] != victim["id"] and own["answers"] == {"other": {}}


@pytest.mark.parametrize("credential_state", ["expired", "revoked", "role_changed"])
def test_old_or_revoked_credentials_cannot_reopen_or_modify_private_progress(
    client, job_seeker_headers, job_seeker, db_session, credential_state,
):
    before = progress_to(client, job_seeker_headers, 1)
    headers = job_seeker_headers
    if credential_state == "expired":
        settings = get_settings()
        token = jwt.encode({
            "sub": job_seeker.id, "role": "job_seeker",
            "exp": datetime.now(UTC) - timedelta(minutes=1),
        }, settings.jwt_secret, algorithm=settings.jwt_algorithm)
        headers = {"Authorization": f"Bearer {token}"}
    elif credential_state == "revoked":
        assert client.delete(
            "/api/v1/auth/sessions/current", headers=headers,
        ).status_code == 204
    else:
        job_seeker.role = "counsellor"
        db_session.commit()

    responses = [
        client.get(QUESTIONNAIRE, headers=headers),
        client.get(CURRENT, headers=headers),
        client.post(CURRENT, headers=headers, json={"questionnaireVersion": VERSION}),
        client.get(f"/api/v1/diagnoses/{before['id']}", headers=headers),
        save(client, headers, before, "goal", "find_job"),
    ]
    status_code = 403 if credential_state == "role_changed" else 401
    code = "FORBIDDEN" if status_code == 403 else "AUTHENTICATION_REQUIRED"
    for response in responses:
        assert_error(response, status_code, code)
    with SessionLocal() as fresh_db:
        persisted = fresh_db.get(Diagnosis, before["id"])
        assert persisted.answers == before["answers"]
        assert persisted.revision == before["revision"]


def test_successful_private_reads_and_writes_are_not_cached(client, job_seeker_headers):
    record = start(client, job_seeker_headers)
    responses = [
        client.get(QUESTIONNAIRE, headers=job_seeker_headers),
        client.get(CURRENT, headers=job_seeker_headers),
        client.get(f"/api/v1/diagnoses/{record['id']}", headers=job_seeker_headers),
        client.post(CURRENT, headers=job_seeker_headers, json={"questionnaireVersion": VERSION}),
        save(client, job_seeker_headers, record, "now", "job"),
    ]
    for response in responses:
        assert response.status_code == 200
        assert "no-store" in response.headers.get("cache-control", "")


@pytest.mark.parametrize("operation", ["start", "save"])
def test_commit_failure_preserves_previous_data_and_never_reports_success(
    client, job_seeker_headers, monkeypatch, operation,
):
    before = progress_to(client, job_seeker_headers, 1) if operation == "save" else None
    attempts = []

    def failed_request_db():
        with SessionLocal() as request_db:
            def fail_commit():
                request_db.flush()
                attempts.append(True)
                raise OperationalError("private diagnosis transaction", {}, RuntimeError("fault"))
            monkeypatch.setattr(request_db, "commit", fail_commit)
            yield request_db

    app.dependency_overrides[get_db] = failed_request_db
    try:
        response = (
            save(client, job_seeker_headers, before, "goal", "find_job")
            if before else client.post(CURRENT, headers=job_seeker_headers,
                                       json={"questionnaireVersion": VERSION})
        )
    finally:
        app.dependency_overrides.pop(get_db, None)
    assert attempts == [True]
    assert_error(response, 500, "INTERNAL_ERROR")
    assert "private diagnosis transaction" not in response.text
    recovered = client.get(CURRENT, headers=job_seeker_headers)
    if before:
        assert recovered.json() == before
    else:
        assert_error(recovered, 404, "NOT_FOUND")


def test_simultaneous_start_requests_create_only_one_record(
    client, job_seeker_headers, monkeypatch,
):
    barrier = Barrier(2)
    original = Session.execute

    def simultaneous_insert(self, statement, *args, **kwargs):
        if isinstance(statement, Insert) and statement.table.name == "diagnoses":
            barrier.wait(timeout=10)
        return original(self, statement, *args, **kwargs)

    monkeypatch.setattr(Session, "execute", simultaneous_insert)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(start, client, job_seeker_headers) for _ in range(2)]
        records = [future.result(timeout=20) for future in futures]
    assert records[0] == records[1]
    with SessionLocal() as db:
        assert db.scalar(select(func.count()).select_from(Diagnosis)) == 1


def test_simultaneous_saves_allow_only_one_revision_to_win(
    client, job_seeker_headers, monkeypatch,
):
    before = start(client, job_seeker_headers)
    barrier = Barrier(2)
    original = Session.execute

    def simultaneous_update(self, statement, *args, **kwargs):
        if isinstance(statement, Update) and statement.table.name == "diagnoses":
            barrier.wait(timeout=10)
        return original(self, statement, *args, **kwargs)

    monkeypatch.setattr(Session, "execute", simultaneous_update)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(save, client, job_seeker_headers, before, "now", value)
                   for value in ("job", "change")]
        responses = [future.result(timeout=20) for future in futures]
    assert sorted(response.status_code for response in responses) == [200, 409]
    winner = next(response.json() for response in responses if response.status_code == 200)
    loser = next(response for response in responses if response.status_code == 409)
    assert_error(loser, 409, "INVALID_STATE_TRANSITION")
    assert winner["revision"] == 1
    assert client.get(CURRENT, headers=job_seeker_headers).json() == winner
