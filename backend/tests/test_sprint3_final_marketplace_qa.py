"""US-13/28/44/45: real query ranking, privacy boundaries and current catalogue.

The API and isolated database are real. No matching algorithm, response or search
result is mocked; these cases exercise the implemented literal query contract.
"""

import pytest

from app.config import get_settings
from app.models import Service, User


def _rows(client, path, **params):
    response = client.get(path, params=params)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("field", [
    "name", "introduction", "background", "experience", "qualifications", "expertise", "languages",
])
def test_profile_search_cannot_disclose_hidden_terms_after_privacy_changes(
    client, db_session, counsellor, service, counsellor_headers, field,
):
    """A search hit can disclose a hidden field even when its value is omitted."""
    needle = "uniquematchingmarker"
    setattr(counsellor, field, [needle] if field in {
        "qualifications", "expertise", "languages",
    } else needle)
    db_session.commit()
    for level in ("public", "partial", "restricted", "public"):
        saved = client.patch(
            "/api/v1/me/profile-visibility", headers=counsellor_headers,
            json={"visibility": level},
        )
        assert saved.status_code == 200, saved.text
        visible = level == "public" or field == "name" or (
            level == "partial" and field == "introduction"
        )
        rows = _rows(client, "/api/v1/counsellors", query=needle.upper())
        assert [row["id"] for row in rows] == ([counsellor.id] if visible else [])
        # Service search accepts listing text and the public display name; it
        # must not silently broaden into private professional-profile fields.
        services = _rows(client, "/api/v1/services", query=needle)
        assert [row["id"] for row in services] == ([service.id] if field == "name" else [])
        own = client.get("/api/v1/me/counsellor-profile", headers=counsellor_headers)
        assert own.status_code == 200
        assert needle in str(own.json())


def _owner(db, name, rating, suffix):
    owner = User(
        name=name, email=f"final-search-{suffix}@example.com", password_hash="unused-fixture",
        role="counsellor", overall_rating=rating, verification_status="verified",
    )
    db.add(owner)
    db.flush()
    return owner


def _service(db, owner, title, description, rating=0, *, active=True, modality="online"):
    item = Service(
        counsellor_id=owner.id, title=title, description=description,
        price_minor=9000, currency="AUD", average_rating=rating,
        active=active, modalities=[modality],
    )
    db.add(item)
    db.flush()
    return item


def test_professional_search_ranks_relevance_then_rating_then_name_and_deduplicates_owners(
    client, db_session,
):
    strongest = _owner(db_session, "Z Strongest", 1, "strongest")
    rated = _owner(db_session, "Z Rated", 5, "rated")
    alpha = _owner(db_session, "A Tie", 4, "alpha")
    beta = _owner(db_session, "B Tie", 4, "beta")
    for owner in (strongest, rated, alpha, beta):
        _service(db_session, owner, "Session", "licensing")
    _service(db_session, strongest, "Second session", "licensing licensing")
    db_session.commit()
    found = _rows(client, "/api/v1/counsellors", query="  LICENSING  ")
    assert [row["id"] for row in found] == [strongest.id, rated.id, alpha.id, beta.id]
    assert len({row["id"] for row in found}) == 4


def test_service_search_ranks_description_matches_then_rating_then_title_and_combines_modality(
    client, db_session, counsellor,
):
    strong = _service(db_session, counsellor, "Z Relevant", "licensing licensing", 1)
    rated = _service(db_session, counsellor, "Z Rated", "licensing", 5)
    alpha = _service(db_session, counsellor, "A Tie", "licensing", 4)
    beta = _service(db_session, counsellor, "B Tie", "licensing", 4)
    person = _service(
        db_session, counsellor, "In-person", "licensing licensing licensing", 5,
        modality="in_person",
    )
    _service(db_session, counsellor, "Hidden", "licensing " * 10, active=False)
    _service(db_session, counsellor, "Unrelated", "resume", 5)
    db_session.commit()
    found = _rows(client, "/api/v1/services", query="  LICENSING  ", modality="online")
    assert [row["id"] for row in found] == [strong.id, rated.id, alpha.id, beta.id]
    assert [row["id"] for row in _rows(
        client, "/api/v1/services", query="licensing", modality="in_person",
    )] == [person.id]


@pytest.mark.parametrize("query", ["", "   ", "\t\n"])
def test_empty_query_preserves_default_marketplace_and_professional_listing(
    client, db_session, counsellor, service, query,
):
    _service(db_session, counsellor, "Second public offering", "Resume support")
    db_session.commit()
    for path in ("/api/v1/services", "/api/v1/counsellors"):
        assert _rows(client, path, query=query) == _rows(client, path)


@pytest.mark.parametrize("query", ["%", "_", "' OR 1=1 --", "不存在"])
def test_query_uses_literal_text_and_does_not_expand_to_unrelated_results(
    client, service, query,
):
    for path in ("/api/v1/services", "/api/v1/counsellors"):
        assert _rows(client, path, query=query) == []


def test_query_drops_withdrawn_service_terms_and_keeps_the_owners_other_offering(
    client, db_session, counsellor, counsellor_headers,
):
    removed = _service(db_session, counsellor, "Licensing review", "specialist advice")
    retained = _service(db_session, counsellor, "Resume review", "application feedback")
    db_session.commit()
    assert _rows(client, "/api/v1/counsellors", query="licensing")[0]["id"] == counsellor.id
    assert client.delete(
        f"/api/v1/me/services/{removed.id}", headers=counsellor_headers,
    ).status_code == 204
    for path in ("/api/v1/services", "/api/v1/counsellors"):
        assert _rows(client, path, query="licensing") == []
    assert [row["id"] for row in _rows(client, "/api/v1/services", query="resume")] == [
        retained.id,
    ]
    assert [row["id"] for row in _rows(client, "/api/v1/counsellors", query="resume")] == [
        counsellor.id,
    ]


@pytest.mark.parametrize("account_id,payouts_enabled", [(None, True), ("acct_fixture", False)])
def test_query_cannot_bypass_payment_readiness_when_provider_mode_is_enabled(
    client, db_session, counsellor, service, monkeypatch, account_id, payouts_enabled,
):
    counsellor.stripe_account_id = account_id
    counsellor.payouts_enabled = payouts_enabled
    db_session.commit()
    monkeypatch.setattr(get_settings(), "stripe_secret_key", "sk_test_fixture_no_network")
    for path in ("/api/v1/services", "/api/v1/counsellors"):
        assert _rows(client, path, query="interview") == []
    counsellor.stripe_account_id = "acct_ready_fixture"
    counsellor.payouts_enabled = True
    db_session.commit()
    assert [row["id"] for row in _rows(client, "/api/v1/services", query="interview")] == [
        service.id,
    ]
    assert [row["id"] for row in _rows(client, "/api/v1/counsellors", query="interview")] == [
        counsellor.id,
    ]
