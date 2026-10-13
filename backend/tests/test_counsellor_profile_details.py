from typing import Any

import pytest
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


@pytest.mark.parametrize("url", [
    "not a url", "https://example.com/in/maya-chen",
    "javascript://linkedin.com/%0Aalert(1)", "ftp://linkedin.com/in/test",
    # A parser differential: this module's hostname check reports linkedin.com,
    # a browser's WHATWG URL parser treats the backslash as a slash and opens
    # evil.example instead — the same bypass closed on the verification
    # endpoint (SubmitVerificationRequest) must hold here too, on the same
    # PROFILE-saving write path that stores what Linking.openURL is later given.
    "https://evil.example\\@linkedin.com/in/test",
    "https://user:pass@linkedin.com/in/test",
])
def test_a_non_linkedin_url_is_rejected_on_profile_save_too(
    client: TestClient, counsellor: Any, counsellor_headers: dict[str, str], url: str,
) -> None:
    before = counsellor.linkedin_url

    response = client.patch(PATH, headers=counsellor_headers, json={**PROFILE, "linkedinUrl": url})

    assert response.status_code == 400
    assert response.json()["code"] == "VALIDATION_ERROR"
    assert counsellor.linkedin_url == before


def test_a_bare_linkedin_url_is_normalised_to_https_on_profile_save(
    client: TestClient, counsellor_headers: dict[str, str],
) -> None:
    response = client.patch(
        PATH, headers=counsellor_headers,
        json={**PROFILE, "linkedinUrl": "linkedin.com/in/maya-chen"},
    )

    assert response.status_code == 200
    assert response.json()["linkedinUrl"] == "https://linkedin.com/in/maya-chen"


def test_the_list_is_the_people_behind_listed_services(
    client: TestClient, counsellor: Any, service: Any, db_session: Session,
) -> None:
    listed = client.get("/api/v1/counsellors").json()
    assert [professional["id"] for professional in listed] == [counsellor.id]

    service.active = False
    db_session.commit()
    assert client.get("/api/v1/counsellors").json() == []
