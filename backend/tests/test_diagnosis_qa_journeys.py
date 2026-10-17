"""Sprint 3 QA: account/session changes and final-save recovery (US-09–11).

The existing diagnosis suite covers individual requests, validation and concurrent
writes. These cases join those boundaries into journeys using the real auth and
diagnosis routes. They are in-process API evidence, not evidence that the frontend
uses the diagnosis API or that a native device has been accepted.
"""

from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, get_db
from app.main import app
from app.models import Diagnosis, User

CURRENT = "/api/v1/me/diagnosis"
LOGIN = "/api/v1/auth/sessions"
VERSION = "yoir-six-step-v1"
PASSWORD = "password123"
FIRST_FOUR = (
    ("now", "other", "Returning after caring for family"),
    ("goal", "other", "Find a flexible career pathway"),
    ("tried", ["other", "networking"], "Spoke with a former colleague"),
    ("stuck", "direction", None),
)


def _login(client, email):
    response = client.post(LOGIN, json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text
    session = response.json()
    return session, {"Authorization": f"Bearer {session['accessToken']}"}


def _start(client, headers):
    response = client.post(CURRENT, headers=headers, json={"questionnaireVersion": VERSION})
    assert response.status_code == 200, response.text
    return response.json()


def _save(client, headers, record, step, value, other=None):
    payload = {
        "questionnaireVersion": VERSION,
        "expectedRevision": record["revision"],
        "value": value,
    }
    if other is not None:
        payload["other"] = other
    return client.put(
        f"/api/v1/diagnoses/{record['id']}/steps/{step}", headers=headers, json=payload,
    )


def _save_first_four(client, headers):
    record = _start(client, headers)
    for step, value, other in FIRST_FOUR:
        response = _save(client, headers, record, step, value, other)
        assert response.status_code == 200, response.text
        record = response.json()
    assert record["status"] == "in_progress"
    assert record["currentStep"] == 5
    return record


def _assert_persisted(record):
    # A new database session cannot be satisfied by a response-only/cache mutation.
    with SessionLocal() as db:
        stored = db.get(Diagnosis, record["id"])
        assert stored is not None
        assert stored.revision == record["revision"]
        assert stored.answers == record["answers"]


def test_incomplete_progress_survives_logout_account_switch_and_fresh_login(
    client, job_seeker, db_session,
):
    """US-09 AC2/4 and US-11 AC2/4: persisted answers belong to the account."""
    second = User(
        name="Another diagnosis seeker", email="diagnosis.second@example.com",
        role="job_seeker", password_hash=job_seeker.password_hash,
    )
    db_session.add(second)
    db_session.commit()
    second_email = second.email

    first_session, first_headers = _login(client, job_seeker.email)
    first = _save_first_four(client, first_headers)
    logout = client.request(
        "DELETE", f"{LOGIN}/current", headers=first_headers,
        json={"refreshToken": first_session["refreshToken"]},
    )
    assert logout.status_code == 204
    assert client.get(CURRENT, headers=first_headers).status_code == 401

    _, second_headers = _login(client, second_email)
    assert client.get(CURRENT, headers=second_headers).status_code == 404
    second_record = _start(client, second_headers)
    response = _save(client, second_headers, second_record, "now", "study")
    assert response.status_code == 200, response.text
    second_record = response.json()
    assert second_record["id"] != first["id"]
    assert second_record["answers"] == {"now": "study", "other": {}}

    # Switching sessions must not let the new account continue the former account's ID.
    foreign_read = client.get(
        f"/api/v1/diagnoses/{first['id']}", headers=second_headers,
    )
    foreign_write = _save(client, second_headers, first, "barriers", [])
    for denied in (foreign_read, foreign_write):
        assert denied.status_code == 404
        assert denied.json()["code"] == "NOT_FOUND"
        assert "Returning after caring for family" not in denied.text

    _, renewed_headers = _login(client, job_seeker.email)
    assert renewed_headers != first_headers
    assert client.get(CURRENT, headers=renewed_headers).json() == first
    assert _start(client, renewed_headers) == first
    completed = _save(client, renewed_headers, first, "barriers", ["local_network"])
    assert completed.status_code == 200, completed.text
    completed = completed.json()
    assert completed["status"] == "answers_complete"
    assert completed["currentStep"] == 6
    for key, value in first["answers"].items():
        assert completed["answers"][key] == value
    assert client.get(CURRENT, headers=second_headers).json() == second_record
    assert client.get(CURRENT, headers=first_headers).status_code == 401
    _assert_persisted(completed)
    _assert_persisted(second_record)


def test_replayed_final_save_after_lost_acknowledgement_recovers_without_double_write(
    client, job_seeker_headers,
):
    """US-10 AC2/3: a retry uses the old revision until the client reloads.

    The first response is deliberately ignored by the simulated client. This
    models a lost acknowledgement; it does not inject a network transport fault.
    """
    before = _save_first_four(client, job_seeker_headers)
    barriers = ["other", "local_network"]
    note = "Need appointments around caring commitments"
    acknowledged = _save(client, job_seeker_headers, before, "barriers", barriers, note)
    assert acknowledged.status_code == 200, acknowledged.text

    replay = _save(client, job_seeker_headers, before, "barriers", barriers, note)
    assert replay.status_code == 409
    assert replay.json()["code"] == "INVALID_STATE_TRANSITION"
    assert replay.json()["fieldErrors"]["expectedRevision"]

    loaded = client.get(CURRENT, headers=job_seeker_headers)
    assert loaded.status_code == 200, loaded.text
    recovered = loaded.json()
    assert recovered == acknowledged.json()
    assert recovered["revision"] == before["revision"] + 1
    assert recovered["status"] == "answers_complete"
    assert recovered["currentStep"] == 6
    assert recovered["answers"] == {
        **before["answers"], "barriers": barriers,
        "other": {**before["answers"]["other"], "barriers": note},
    }
    assert _start(client, job_seeker_headers) == recovered
    _assert_persisted(recovered)


def test_failed_final_commit_keeps_confirmed_progress_and_allows_same_revision_retry(
    client, job_seeker_headers, monkeypatch,
):
    """US-10 AC4 / US-11 AC2: final-step failure cannot become completion."""
    before = _save_first_four(client, job_seeker_headers)
    failed_commits = []

    def failing_database():
        with SessionLocal() as db:
            def fail_commit():
                db.flush()
                failed_commits.append(True)
                raise OperationalError("simulated final-save failure", {}, RuntimeError("fault"))

            with monkeypatch.context() as patch:
                patch.setattr(db, "commit", fail_commit)
                yield db

    with monkeypatch.context() as patch:
        patch.setitem(app.dependency_overrides, get_db, failing_database)
        failed = _save(client, job_seeker_headers, before, "barriers", [])

    assert failed_commits == [True]
    assert failed.status_code == 500
    assert failed.json()["code"] == "INTERNAL_ERROR"
    assert failed.json()["requestId"]
    assert "simulated final-save failure" not in failed.text
    assert client.get(CURRENT, headers=job_seeker_headers).json() == before
    assert _start(client, job_seeker_headers) == before
    _assert_persisted(before)

    retried = _save(client, job_seeker_headers, before, "barriers", [])
    assert retried.status_code == 200, retried.text
    after = retried.json()
    assert after["status"] == "answers_complete"
    assert after["currentStep"] == 6
    assert after["revision"] == before["revision"] + 1
    assert after["answers"] == {**before["answers"], "barriers": []}
    _assert_persisted(after)
    with SessionLocal() as db:
        assert list(db.scalars(select(Diagnosis.id))) == [before["id"]]
