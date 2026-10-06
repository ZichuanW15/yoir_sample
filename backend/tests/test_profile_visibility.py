from typing import Any

from fastapi.testclient import TestClient

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
    assert profile["linkedinUrl"] == ""
    assert profile["background"] == ""
    assert profile["experience"] == ""
    assert profile["qualifications"] == []


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
    assert profile["background"] == ""
    assert profile["linkedinUrl"] == ""
