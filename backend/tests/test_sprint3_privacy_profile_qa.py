"""US-27/28/29: saved privacy, requester filtering and atomic profile changes.

Real API/database boundaries on current dev; external image storage, device
permissions and the unmerged privacy-hardening PR are not exercised here.
"""

import pytest
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, get_db
from app.main import app
from app.models import User

VISIBILITY = "/api/v1/me/profile-visibility"
PROFILE = "/api/v1/me/job-seeker-profile"
OWN_COUNSELLOR = "/api/v1/me/counsellor-profile"
PASSWORD = "password123"


def _login(client, email):
    response = client.post(
        "/api/v1/auth/sessions", json={"email": email, "password": PASSWORD},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['accessToken']}"}


def _register(client, role, suffix):
    email = f"qa-profile-{suffix}@example.com"
    response = client.post("/api/v1/auth/users", json={
        "name": f"QA {suffix}", "email": email, "password": PASSWORD,
        "passwordConfirmation": PASSWORD, "role": role,
    })
    assert response.status_code == 201, response.text
    return email, _login(client, email)


@pytest.mark.parametrize("level", ["public", "partial", "restricted"])
def test_saved_visibility_filters_every_public_reader_but_keeps_own_profile_complete(
    client, db_session, counsellor, service, counsellor_headers, job_seeker_headers, level,
):
    counsellor.linkedin_url = "https://www.linkedin.com/in/qa-owner"
    counsellor.background = "Private professional background"
    counsellor.experience = "Private experience"
    counsellor.qualifications = ["Private qualification"]
    counsellor.expertise = ["Private expertise"]
    counsellor.languages = ["Private language"]
    counsellor.photo_url = "https://example.com/qa-photo.png"
    counsellor.base_location_state = "VIC"
    counsellor.base_location_city = "Melbourne"
    db_session.commit()
    _, outsider = _register(client, "counsellor", "outside")
    before = client.get(OWN_COUNSELLOR, headers=counsellor_headers).json()

    saved = client.patch(VISIBILITY, headers=counsellor_headers, json={"visibility": level})
    assert saved.status_code == 200, saved.text
    renewed = _login(client, counsellor.email)
    assert client.get(VISIBILITY, headers=renewed).json() == {"visibility": level}
    # Owner's /me route must retain full details, even after a fresh login.
    assert client.get(OWN_COUNSELLOR, headers=renewed).json() == before

    protected = ["linkedinUrl", "background", "experience", "qualifications",
                 "expertise", "languages", "photoUrl", "baseLocation"]
    for headers in ({}, job_seeker_headers, outsider):
        public = client.get(f"/api/v1/counsellors/{counsellor.id}", headers=headers)
        assert public.status_code == 200, public.text
        detail = public.json()
        listed = client.get("/api/v1/counsellors", headers=headers)
        assert listed.status_code == 200, listed.text
        card = next(row for row in listed.json() if row["id"] == counsellor.id)
        assert card == detail
        assert detail["visibility"] == level
        for field in protected:
            if level == "public":
                assert detail.get(field) == before.get(field), field
            else:
                assert not detail.get(field), (level, field, detail.get(field))
        assert detail["introduction"] == ("" if level == "restricted" else before["introduction"])
        assert detail["displayName"] == before["displayName"]
        assert detail["verificationStatus"] == before["verificationStatus"]


@pytest.mark.parametrize("role", ["job_seeker", "counsellor"])
def test_privacy_transitions_survive_new_session_without_changing_another_account(client, role):
    owner_email, owner = _register(client, role, "owner")
    _, other = _register(client, role, "other")
    for level in ("restricted", "partial", "public"):
        changed = client.patch(VISIBILITY, headers=owner, json={"visibility": level})
        assert changed.status_code == 200, changed.text
        assert client.get(VISIBILITY, headers=_login(client, owner_email)).json() == {
            "visibility": level,
        }
        assert client.get(VISIBILITY, headers=other).json() == {"visibility": "public"}


@pytest.mark.parametrize("invalid", [
    {}, {"visibility": "friends"}, {"visibility": None}, {"visibility": 1},
    {"visibility": "public", "userId": "foreign-user"},
])
def test_rejected_privacy_write_preserves_last_confirmed_choice(
    client, job_seeker_headers, invalid,
):
    assert client.patch(
        VISIBILITY, headers=job_seeker_headers, json={"visibility": "restricted"},
    ).status_code == 200
    response = client.patch(VISIBILITY, headers=job_seeker_headers, json=invalid)
    assert response.status_code == 400, response.text
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert client.get(VISIBILITY, headers=job_seeker_headers).json() == {
        "visibility": "restricted",
    }


@pytest.mark.parametrize("path,payload", [
    (VISIBILITY, {"visibility": "restricted"}),
    (PROFILE, {"name": "Changed", "headline": "Changed headline", "careerGoals": "Changed goals"}),
])
def test_profile_commit_failure_rolls_back_flushed_changes_and_same_payload_can_retry(
    client, job_seeker, job_seeker_headers, monkeypatch, path, payload,
):
    before = client.get(path, headers=job_seeker_headers).json()
    attempted = []

    def failing_database():
        with SessionLocal() as db:
            def fail_commit():
                db.flush()
                attempted.append(True)
                raise OperationalError("QA profile commit failure", {}, RuntimeError("fault"))

            with monkeypatch.context() as patch:
                patch.setattr(db, "commit", fail_commit)
                yield db

    app.dependency_overrides[get_db] = failing_database
    try:
        failed = client.patch(path, headers=job_seeker_headers, json=payload)
        assert attempted == [True]
        assert failed.status_code == 500
    finally:
        app.dependency_overrides.pop(get_db, None)
    assert client.get(path, headers=_login(client, job_seeker.email)).json() == before
    with SessionLocal() as db:
        stored = db.get(User, job_seeker.id)
        assert stored is not None
        if path == VISIBILITY:
            assert stored.profile_visibility == before["visibility"]
        else:
            assert stored.name == before["name"]
            assert (stored.headline or "") == before["headline"]
            assert (stored.career_goals or "") == before["careerGoals"]
    retried = client.patch(path, headers=job_seeker_headers, json=payload)
    assert retried.status_code == 200, retried.text
    assert all(retried.json()[key] == value for key, value in payload.items())
    assert client.get(path, headers=_login(client, job_seeker.email)).json() == retried.json()


def test_profile_save_logout_switch_and_relogin_keeps_private_fields_and_email_owner_bound(client):
    email, owner = _register(client, "job_seeker", "profile-owner")
    _, other = _register(client, "job_seeker", "profile-other")
    other_before = client.get(PROFILE, headers=other).json()
    payload = {
        "name": "Saved name", "photoUrl": "data:image/png;base64,YWJj",
        "headline": "Saved headline", "careerGoals": "Saved goals",
    }
    saved = client.patch(PROFILE, headers=owner, json=payload)
    assert saved.status_code == 200, saved.text
    for extra in ({"email": "stolen@example.com"}, {"userId": "foreign-user"}):
        rejected = client.patch(PROFILE, headers=owner, json={**payload, **extra})
        assert rejected.status_code == 400
        assert rejected.json()["code"] == "VALIDATION_ERROR"
    assert client.delete("/api/v1/auth/sessions/current", headers=owner).status_code == 204
    assert client.get(PROFILE, headers=owner).status_code == 401
    assert client.patch(PROFILE, headers=owner, json=payload).status_code == 401
    assert client.get(PROFILE, headers=other).json() == other_before
    renewed = _login(client, email)
    assert client.get(PROFILE, headers=renewed).json() == {**payload, "email": email}


@pytest.mark.parametrize("actor", ["guest", "counsellor", "platform_owner"])
def test_profile_write_rejects_nonseeker_and_leaves_stored_seeker_unchanged(
    client, job_seeker_headers, counsellor_headers, platform_owner_headers, actor,
):
    before = client.get(PROFILE, headers=job_seeker_headers).json()
    headers = {"guest": {}, "counsellor": counsellor_headers,
               "platform_owner": platform_owner_headers}[actor]
    failed = client.patch(PROFILE, headers=headers, json={"name": "Unauthorized change"})
    assert failed.status_code == (401 if actor == "guest" else 403)
    assert client.get(PROFILE, headers=job_seeker_headers).json() == before


def test_guest_cannot_read_or_change_privacy(client):
    assert client.get(VISIBILITY).status_code == 401
    assert client.patch(VISIBILITY, json={"visibility": "restricted"}).status_code == 401
