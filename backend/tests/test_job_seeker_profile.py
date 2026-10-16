from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db import SessionLocal, get_db
from app.main import app
from app.models import User

PROFILE = "/api/v1/me/job-seeker-profile"
PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=="


def test_job_seeker_saves_profile_and_photo(
    client: TestClient, job_seeker_headers: dict[str, str],
) -> None:
    saved = client.patch(PROFILE, headers=job_seeker_headers, json={
        "name": "  Alex Morgan  ",
        "photoUrl": PHOTO,
        "headline": "Final-year engineering student",
        "careerGoals": "A graduate role in civil engineering.",
    })
    assert saved.status_code == 200

    profile = client.get(PROFILE, headers=job_seeker_headers).json()
    assert profile == {
        "name": "Alex Morgan",
        "email": "alex.jobseeker@example.com",
        "photoUrl": PHOTO,
        "headline": "Final-year engineering student",
        "careerGoals": "A graduate role in civil engineering.",
    }

    removed = client.patch(
        PROFILE, headers=job_seeker_headers, json={"name": "Alex Morgan", "photoUrl": None},
    )
    assert removed.json()["photoUrl"] is None
    assert removed.headers["cache-control"] == "private, no-store"


def test_profile_photo_must_be_an_inline_raster_image(
    client: TestClient, job_seeker_headers: dict[str, str],
) -> None:
    for photo in ["data:image/svg+xml;base64,PHN2Zz4=", "https://example.com/me.jpg"]:
        response = client.patch(
            PROFILE, headers=job_seeker_headers, json={"name": "Alex", "photoUrl": photo},
        )
        assert response.status_code == 400
        assert response.json()["code"] == "VALIDATION_ERROR"


def test_only_a_job_seeker_has_a_job_seeker_profile(
    client: TestClient,
    counsellor_headers: dict[str, str],
    platform_owner_headers: dict[str, str],
) -> None:
    assert client.get(PROFILE, headers=counsellor_headers).status_code == 403
    assert client.patch(
        PROFILE, headers=counsellor_headers, json={"name": "Not allowed"}
    ).status_code == 403
    assert client.get(PROFILE, headers=platform_owner_headers).status_code == 403
    assert client.patch(
        PROFILE, headers=platform_owner_headers, json={"name": "Not allowed"}
    ).status_code == 403
    assert client.get(PROFILE).status_code == 401


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        ({"name": "   "}, "name"),
        ({"name": "x" * 121}, "name"),
        ({"name": "Alex", "headline": "x" * 201}, "headline"),
        ({"name": "Alex", "careerGoals": "x" * 2001}, "careerGoals"),
        ({"name": "Alex", "email": "attacker@example.com"}, "email"),
    ],
)
def test_invalid_profile_update_does_not_change_the_stored_profile(
    client: TestClient,
    db_session: Any,
    job_seeker: Any,
    job_seeker_headers: dict[str, str],
    changes: dict[str, object],
    field: str,
) -> None:
    original = (job_seeker.name, job_seeker.email, job_seeker.headline, job_seeker.career_goals)

    response = client.patch(PROFILE, headers=job_seeker_headers, json=changes)

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert field in response.json()["fieldErrors"]
    db_session.expire_all()
    stored = db_session.get(type(job_seeker), job_seeker.id)
    assert (stored.name, stored.email, stored.headline, stored.career_goals) == original


def test_job_seeker_profile_route_cannot_target_another_account(
    client: TestClient,
    db_session: Any,
    job_seeker: Any,
    counsellor: Any,
    job_seeker_headers: dict[str, str],
) -> None:
    response = client.patch(
        PROFILE,
        headers=job_seeker_headers,
        json={"name": "Injected name", "userId": counsellor.id},
    )

    assert response.status_code == 400
    db_session.expire_all()
    assert db_session.get(type(job_seeker), job_seeker.id).name == "Alex Job Seeker"
    assert db_session.get(type(counsellor), counsellor.id).name == "Maya Chen"


def test_failed_profile_commit_keeps_the_previous_profile(
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
                raise OperationalError("private profile transaction", {}, RuntimeError("fault"))

            monkeypatch.setattr(request_db, "commit", fail_commit)
            yield request_db

    app.dependency_overrides[get_db] = failed_request_db
    try:
        response = client.patch(
            PROFILE,
            headers=job_seeker_headers,
            json={"name": "Should not persist", "headline": "Also rolled back"},
        )
    finally:
        app.dependency_overrides.pop(get_db, None)

    assert attempts == [True]
    assert response.status_code == 500
    assert response.json()["code"] == "INTERNAL_ERROR"
    assert "private profile transaction" not in response.text
    with SessionLocal() as db:
        stored = db.get(User, job_seeker.id)
        assert stored.name == "Alex Job Seeker"
        assert stored.headline is None
