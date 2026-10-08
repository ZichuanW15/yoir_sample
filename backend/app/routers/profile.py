from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import PrivacySettingsOut, UpdateProfileVisibilityRequest
from app.security import get_current_user

router = APIRouter(prefix="/me", tags=["Profile"])


@router.get("/profile-visibility", response_model=PrivacySettingsOut)
def get_profile_visibility(
    user: User = Depends(get_current_user),
) -> PrivacySettingsOut:
    """US-27. Return the signed-in member's current privacy choice."""
    return PrivacySettingsOut(visibility=user.profile_visibility or "public")


@router.patch("/profile-visibility", response_model=PrivacySettingsOut)
def update_profile_visibility(
    payload: UpdateProfileVisibilityRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PrivacySettingsOut:
    """US-27. Save privacy for either a Job Seeker or Career Professional."""
    user.profile_visibility = payload.visibility
    db.commit()
    return PrivacySettingsOut(visibility=user.profile_visibility)
