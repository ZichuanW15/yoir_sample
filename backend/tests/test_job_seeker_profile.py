from fastapi.testclient import TestClient

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
    client: TestClient, counsellor_headers: dict[str, str],
) -> None:
    assert client.get(PROFILE, headers=counsellor_headers).status_code == 403
    assert client.get(PROFILE).status_code == 401
