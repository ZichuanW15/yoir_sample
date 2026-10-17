from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import PrivacySettingsOut, UpdateProfileVisibilityRequest
from app.security import require_profile_owner

router = APIRouter(prefix="/me", tags=["Profile"])


@router.get(
    "/profile-visibility",
    response_model=PrivacySettingsOut,
    operation_id="getProfileVisibility",
    openapi_extra={
        "x-required-role": "authenticated_member",
        "x-requirement-ids": ["US-27"],
    },
)
def get_profile_visibility(
    response: Response,
    user: User = Depends(require_profile_owner),
) -> PrivacySettingsOut:
    """US-27. Return the signed-in member's current privacy choice."""
    response.headers["Cache-Control"] = "private, no-store"
    return PrivacySettingsOut(visibility=user.profile_visibility or "public")


@router.patch(
    "/profile-visibility",
    response_model=PrivacySettingsOut,
    operation_id="updateProfileVisibility",
    openapi_extra={
        "x-required-role": "authenticated_member",
        "x-requirement-ids": ["US-27", "US-28"],
    },
)
def update_profile_visibility(
    payload: UpdateProfileVisibilityRequest,
    response: Response,
    user: User = Depends(require_profile_owner),
    db: Session = Depends(get_db),
) -> PrivacySettingsOut:
    """US-27. Save privacy for either a Job Seeker or Career Professional."""
    user.profile_visibility = payload.visibility
    result = PrivacySettingsOut(visibility=user.profile_visibility)
    try:
        db.flush()
        db.commit()
    except Exception:
        db.rollback()
        raise
    response.headers["Cache-Control"] = "private, no-store"
    return result
