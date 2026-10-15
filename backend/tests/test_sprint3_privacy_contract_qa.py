"""US-28 AC2 / QA #186: redacted values and absent fields are different claims.

The implemented mapper already chooses background/experience/qualifications as
private in partial mode. This test does not invent a field-per-level PO policy:
it checks the parent's explicit omission requirement for those known fields.
"""

import pytest
from qa_acceptance import KnownAcceptanceDefect


@pytest.mark.parametrize("requester", ["guest", "other-seeker"])
@pytest.mark.xfail(
    strict=True,
    raises=KnownAcceptanceDefect,
    reason=(
        "S3-BE-PRIVACY-FIELD-OMISSION: US-28 AC2 / QA #186; partial profiles "
        "return empty private fields instead of omitting them from the API response"
    ),
)
def test_partial_profile_omits_private_fields_instead_of_returning_empty_placeholders(
    client, db_session, counsellor, counsellor_headers, job_seeker_headers, requester,
):
    counsellor.background = "Private biography"
    counsellor.experience = "Private work history"
    counsellor.qualifications = ["Private qualification"]
    db_session.commit()
    saved = client.patch(
        "/api/v1/me/profile-visibility", headers=counsellor_headers,
        json={"visibility": "partial"},
    )
    assert saved.status_code == 200, saved.text
    own = client.get("/api/v1/me/counsellor-profile", headers=counsellor_headers)
    assert own.status_code == 200
    private_fields = {"background", "experience", "qualifications"}
    assert all(own.json()[field] for field in private_fields)

    response = client.get(
        f"/api/v1/counsellors/{counsellor.id}",
        headers={} if requester == "guest" else job_seeker_headers,
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["visibility"] == "partial"
    # Actual private-value leakage or a failure to save privacy remains blocking.
    assert all(not data.get(field) for field in private_fields)
    retained = sorted(private_fields.intersection(data))
    if retained:
        raise KnownAcceptanceDefect(f"Hidden field keys remain in partial response: {retained}")
