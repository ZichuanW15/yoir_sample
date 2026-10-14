from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, get_db
from app.main import app
from app.models import User

SETTINGS_PATH = "/api/v1/me/profile-visibility"


def test_career_professional_can_save_and_read_privacy(
    client: TestClient, counsellor_headers: dict[str, str],
) -> None:
    initial = client.get(SETTINGS_PATH, headers=counsellor_headers)
    assert initial.status_code == 200
    assert initial.json() == {"visibility": "public"}

    saved = client.patch(
        SETTINGS_PATH,
        headers=counsellor_headers,
        json={"visibility": "restricted"},
    )
    assert saved.status_code == 200
    assert saved.json() == {"visibility": "restricted"}

    current = client.get(SETTINGS_PATH, headers=counsellor_headers)
    assert current.json() == {"visibility": "restricted"}
    assert current.headers["cache-control"] == "private, no-store"


def test_job_seeker_can_save_and_read_privacy(
    client: TestClient, job_seeker_headers: dict[str, str],
) -> None:
    saved = client.patch(
        SETTINGS_PATH,
        headers=job_seeker_headers,
        json={"visibility": "partial"},
    )

    assert saved.status_code == 200
    assert saved.json() == {"visibility": "partial"}
    assert client.get(SETTINGS_PATH, headers=job_seeker_headers).json() == {
        "visibility": "partial"
    }


@pytest.mark.parametrize("visibility", ["private", "", None, 1])
def test_invalid_visibility_is_rejected_without_changing_the_saved_value(
    client: TestClient,
    db_session: Any,
    job_seeker: Any,
    job_seeker_headers: dict[str, str],
    visibility: object,
) -> None:
    job_seeker.profile_visibility = "restricted"
    db_session.commit()

    response = client.patch(
        SETTINGS_PATH,
        headers=job_seeker_headers,
        json={"visibility": visibility},
    )

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    db_session.expire_all()
    assert db_session.get(type(job_seeker), job_seeker.id).profile_visibility == "restricted"


def test_visibility_route_cannot_target_another_account(
    client: TestClient,
    db_session: Any,
    job_seeker: Any,
    counsellor: Any,
    job_seeker_headers: dict[str, str],
) -> None:
    """The endpoint is deliberately /me; an injected account id is rejected rather
    than ignored, and neither account is changed."""
    response = client.patch(
        SETTINGS_PATH,
        headers=job_seeker_headers,
        json={"visibility": "restricted", "userId": counsellor.id},
    )

    assert response.status_code == 400
    db_session.expire_all()
    assert db_session.get(type(job_seeker), job_seeker.id).profile_visibility == "public"
    assert db_session.get(type(counsellor), counsellor.id).profile_visibility == "public"


def test_platform_owner_has_no_user_facing_privacy_setting(
    client: TestClient, platform_owner_headers: dict[str, str],
) -> None:
    assert client.get(SETTINGS_PATH, headers=platform_owner_headers).status_code == 403
    assert client.patch(
        SETTINGS_PATH,
        headers=platform_owner_headers,
        json={"visibility": "restricted"},
    ).status_code == 403


def test_failed_visibility_commit_keeps_the_previous_setting(
    client: TestClient,
    job_seeker: Any,
    job_seeker_headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    attempts = []

    def failed_request_db():
        with SessionLocal() as request_db:
            def fail_commit():
                request_db.flush()
                attempts.append(True)
                raise OperationalError("private visibility transaction", {}, RuntimeError("fault"))

            monkeypatch.setattr(request_db, "commit", fail_commit)
            yield request_db

    app.dependency_overrides[get_db] = failed_request_db
    try:
        response = client.patch(
            SETTINGS_PATH,
            headers=job_seeker_headers,
            json={"visibility": "restricted"},
        )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert attempts == [True]
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert "private visibility transaction" not in response.text
    with SessionLocal() as db:
        assert db.get(User, job_seeker.id).profile_visibility == "public"


def test_restricted_career_professional_profile_does_not_leak_details(
    client: TestClient, db_session: Any, counsellor: Any,
) -> None:
    counsellor.profile_visibility = "restricted"
    counsellor.linkedin_url = "https://linkedin.com/in/private"
    counsellor.background = "Private background"
    counsellor.experience = "Private experience"
    counsellor.qualifications = ["Private qualification"]
    db_session.commit()

    response = client.get(f"/api/v1/counsellors/{counsellor.id}")
    assert response.status_code == 200
    profile = response.json()
    assert profile["restricted"] is True
    assert profile["visibility"] == "restricted"
    assert set(profile) == {
        "id",
        "displayName",
        "verificationStatus",
        "overallRating",
        "reviewCount",
        "visibility",
        "restricted",
    }
    assert response.headers["cache-control"] == "private, no-store"


def test_partial_profile_keeps_summary_but_hides_personal_details(
    client: TestClient, db_session: Any, counsellor: Any,
) -> None:
    counsellor.profile_visibility = "partial"
    counsellor.introduction = "Public professional summary"
    counsellor.background = "Private background"
    counsellor.linkedin_url = "https://linkedin.com/in/private"
    db_session.commit()

    profile = client.get(f"/api/v1/counsellors/{counsellor.id}").json()
    assert profile["visibility"] == "partial"
    assert profile["displayName"] == counsellor.name
    assert profile["introduction"] == "Public professional summary"
    assert profile["defaultModality"] == "online"
    for hidden in (
        "photoUrl",
        "linkedinUrl",
        "background",
        "experience",
        "qualifications",
        "expertise",
        "languages",
        "baseLocation",
    ):
        assert hidden not in profile


def test_owner_still_receives_the_complete_profile_when_restricted(
    client: TestClient,
    db_session: Any,
    counsellor: Any,
    counsellor_headers: dict[str, str],
) -> None:
    counsellor.profile_visibility = "restricted"
    counsellor.linkedin_url = "https://linkedin.com/in/private"
    counsellor.background = "Visible to the owner"
    db_session.commit()

    response = client.get("/api/v1/me/counsellor-profile", headers=counsellor_headers)

    assert response.status_code == 200
    assert response.json()["linkedinUrl"] == "https://linkedin.com/in/private"
    assert response.json()["background"] == "Visible to the owner"
    assert response.headers["cache-control"] == "private, no-store"


def test_counsellor_list_applies_the_same_restricted_filter(
    client: TestClient,
    db_session: Any,
    counsellor: Any,
    service: Any,
) -> None:
    counsellor.profile_visibility = "restricted"
    counsellor.linkedin_url = "https://linkedin.com/in/private"
    counsellor.background = "Must not leak through the list"
    db_session.commit()

    response = client.get("/api/v1/counsellors")

    assert response.status_code == 200
    assert len(response.json()) == 1
    profile = response.json()[0]
    assert profile["id"] == counsellor.id
    assert profile["restricted"] is True
    assert "linkedinUrl" not in profile
    assert "background" not in profile
    assert response.headers["cache-control"] == "private, no-store"


def test_visibility_change_removes_previously_public_fields_on_the_next_read(
    client: TestClient,
    db_session: Any,
    counsellor: Any,
    counsellor_headers: dict[str, str],
) -> None:
    counsellor.linkedin_url = "https://linkedin.com/in/once-public"
    counsellor.background = "Once public"
    db_session.commit()
    path = f"/api/v1/counsellors/{counsellor.id}"

    public = client.get(path)
    assert public.json()["background"] == "Once public"

    changed = client.patch(
        SETTINGS_PATH,
        headers=counsellor_headers,
        json={"visibility": "restricted"},
    )
    assert changed.status_code == 200
    restricted = client.get(path)
    assert restricted.json()["restricted"] is True
    assert "background" not in restricted.json()
    assert restricted.headers["cache-control"] == "private, no-store"
