"""US-05 — the first-login onboarding state a Career Professional's app routes on.

Read-only: `/me/onboarding-state` never writes anything. It reports what
`update_own_counsellor_profile` (US-30) and `submit_verification` (US-31) have
already recorded, so these tests build their own counsellors rather than mutating
the `verified`, fully-profiled `counsellor` fixture every other suite relies on.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User
from app.security import create_access_token, hash_password

PATH = "/api/v1/me/onboarding-state"


def make_counsellor(db_session: Session, **overrides: Any) -> User:
    """A counsellor who has never logged in: every onboarding field left unset,
    exactly as registration (US-04) leaves them."""
    user = User(
        name="Erika Novak",
        email=f"erika-{overrides.get('email_suffix', 'default')}@example.com",
        password_hash=hash_password("password123"),
        role="counsellor",
        email_verified_at=datetime.now(UTC),
        **{k: v for k, v in overrides.items() if k != "email_suffix"},
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def headers_for(user: User) -> dict[str, str]:
    token, _ = create_access_token(user.id, user.role)
    return {"Authorization": f"Bearer {token}"}


# --- AT-US-05-3: a brand new counsellor is reported incomplete --------------


def test_a_never_logged_in_counsellor_reports_both_steps_incomplete(
    client: TestClient, db_session: Session,
) -> None:
    erika = make_counsellor(db_session, email_suffix="fresh")

    response = client.get(PATH, headers=headers_for(erika))

    assert response.status_code == 200
    assert response.json() == {
        "profileComplete": False,
        "verificationSubmitted": False,
        "complete": False,
    }


def test_profile_fields_alone_do_not_count_as_verification_submitted(
    client: TestClient, db_session: Session,
) -> None:
    """Saving the narrative fields without ever naming a LinkedIn URL — the case the
    public form refuses, but this endpoint still has to answer honestly about."""
    partial = make_counsellor(
        db_session, email_suffix="partial",
        introduction="Helps graduates prepare for interviews.",
        background="Ten years in graduate recruitment.",
        experience="Coached hundreds of candidates.",
    )

    body = client.get(PATH, headers=headers_for(partial)).json()

    assert body == {"profileComplete": True, "verificationSubmitted": False, "complete": False}


def test_a_linkedin_url_alone_does_not_count_as_profile_complete(
    client: TestClient, db_session: Session,
) -> None:
    linked_only = make_counsellor(
        db_session, email_suffix="linked-only", linkedin_url="https://www.linkedin.com/in/erika",
    )

    body = client.get(PATH, headers=headers_for(linked_only)).json()

    assert body == {"profileComplete": False, "verificationSubmitted": True, "complete": False}


# --- AT-US-05-1 / AT-US-05-3: both steps done --------------------------------


def test_profile_saved_and_linkedin_submitted_reports_complete(
    client: TestClient, db_session: Session,
) -> None:
    """David: saved his profile and submitted LinkedIn. Still only `pending` review —
    onboarding does not wait on the Platform Owner's decision, only the submission."""
    david = make_counsellor(
        db_session, email_suffix="david",
        introduction="Helps graduates prepare for interviews.",
        background="Ten years in graduate recruitment.",
        experience="Coached hundreds of candidates.",
        linkedin_url="https://www.linkedin.com/in/david",
    )
    assert david.verification_status == "pending"

    body = client.get(PATH, headers=headers_for(david)).json()

    assert body == {"profileComplete": True, "verificationSubmitted": True, "complete": True}


def test_rejected_verification_still_counts_as_submitted(
    client: TestClient, db_session: Session,
) -> None:
    """A decision — even a 'no' — is still evidence a submission happened. US-05 gates
    on submission, not approval; a rejected counsellor is not sent back through
    onboarding, they go to the regular area and see the rejection there (US-32)."""
    rejected = make_counsellor(
        db_session, email_suffix="rejected",
        introduction="Helps graduates prepare for interviews.",
        background="Ten years in graduate recruitment.",
        experience="Coached hundreds of candidates.",
        linkedin_url="https://www.linkedin.com/in/erika",
        verification_status="rejected",
    )

    body = client.get(PATH, headers=headers_for(rejected)).json()

    assert body["verificationSubmitted"] is True
    assert body["complete"] is True


def test_the_shared_verified_counsellor_fixture_is_already_complete(
    client: TestClient, counsellor: Any, counsellor_headers: dict[str, str],
) -> None:
    """Every other counsellor-facing suite builds on this fixture assuming it never
    hits an onboarding gate; this pins that assumption so a future change to either
    the fixture or this endpoint's rule fails loudly, in one place, instead of as
    unrelated failures scattered across those suites."""
    client.patch(
        "/api/v1/me/counsellor-profile",
        headers=counsellor_headers,
        json={
            "linkedinUrl": "https://www.linkedin.com/in/maya-chen",
            "introduction": counsellor.introduction,
            "background": "Ten years in graduate recruitment.",
            "experience": "Coached hundreds of candidates.",
        },
    )

    body = client.get(PATH, headers=counsellor_headers).json()

    assert body["complete"] is True


# --- role and auth boundaries -------------------------------------------------


def test_requires_authentication(client: TestClient) -> None:
    assert client.get(PATH).status_code == 401


def test_refuses_a_job_seeker(client: TestClient, job_seeker_headers: dict[str, str]) -> None:
    response = client.get(PATH, headers=job_seeker_headers)
    assert response.status_code == 403
