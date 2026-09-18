from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

PATH = "/api/v1/me/counsellor-profile"
PROFILE = {
    "linkedinUrl": "https://www.linkedin.com/in/example",
    "introduction": "Career Professional for graduates and career changers.",
    "qualifications": ["  Master of Career Development  "],
    "expertise": ["Interview preparation", "Resume writing"],
    "languages": ["English", "Hindi"],
}


def test_details_are_saved_and_shown_on_the_public_profile(
    client: TestClient, counsellor: Any, counsellor_headers: dict[str, str],
) -> None:
    saved = client.patch(PATH, headers=counsellor_headers, json=PROFILE)
    assert saved.status_code == 200

    public = client.get(f"/api/v1/counsellors/{counsellor.id}").json()
    assert public["qualifications"] == ["Master of Career Development"]
    assert public["expertise"] == ["Interview preparation", "Resume writing"]
    assert public["languages"] == ["English", "Hindi"]


def test_detail_lists_are_bounded(client: TestClient, counsellor_headers: dict[str, str]) -> None:
    invalid = {"expertise": ["x"] * 21, "languages": ["  "], "qualifications": ["q" * 161]}
    for field, value in invalid.items():
        response = client.patch(PATH, headers=counsellor_headers, json={**PROFILE, field: value})
        assert response.status_code == 400, field


def test_the_list_is_the_people_behind_listed_services(
    client: TestClient, counsellor: Any, service: Any, db_session: Session,
) -> None:
    listed = client.get("/api/v1/counsellors").json()
    assert [professional["id"] for professional in listed] == [counsellor.id]

    service.active = False
    db_session.commit()
    assert client.get("/api/v1/counsellors").json() == []
