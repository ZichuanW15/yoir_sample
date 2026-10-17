from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User
from app.schemas import JobSeekerProfileOut, UpdateJobSeekerProfileRequest
from app.security import require_job_seeker

router = APIRouter(prefix="/me", tags=["Job Seeker"])


def job_seeker_profile_out(user: User) -> JobSeekerProfileOut:
    return JobSeekerProfileOut(
        name=user.name,
        email=user.email,
        photo_url=user.photo_url,
        headline=user.headline or "",
        career_goals=user.career_goals or "",
    )


@router.get(
    "/job-seeker-profile",
    response_model=JobSeekerProfileOut,
    operation_id="getOwnJobSeekerProfile",
    openapi_extra={"x-required-role": "job_seeker", "x-requirement-ids": ["US-29"]},
)
def get_own_job_seeker_profile(
    response: Response,
    user: User = Depends(require_job_seeker),
) -> JobSeekerProfileOut:
    response.headers["Cache-Control"] = "private, no-store"
    return job_seeker_profile_out(user)


@router.patch(
    "/job-seeker-profile",
    response_model=JobSeekerProfileOut,
    operation_id="updateOwnJobSeekerProfile",
    openapi_extra={"x-required-role": "job_seeker", "x-requirement-ids": ["US-29"]},
)
def update_own_job_seeker_profile(
    payload: UpdateJobSeekerProfileRequest,
    response: Response,
    user: User = Depends(require_job_seeker),
    db: Session = Depends(get_db),
) -> JobSeekerProfileOut:
    """Save the caller's own profile. The email is not editable here."""
    user.name = payload.name
    user.photo_url = payload.photo_url
    user.headline = payload.headline
    user.career_goals = payload.career_goals
    result = job_seeker_profile_out(user)
    try:
        db.flush()
        db.commit()
    except Exception:
        db.rollback()
        raise
    response.headers["Cache-Control"] = "private, no-store"
    return result
