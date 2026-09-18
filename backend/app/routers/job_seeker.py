from fastapi import APIRouter, Depends
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


@router.get("/job-seeker-profile", response_model=JobSeekerProfileOut)
def get_own_job_seeker_profile(user: User = Depends(require_job_seeker)) -> JobSeekerProfileOut:
    return job_seeker_profile_out(user)


@router.patch("/job-seeker-profile", response_model=JobSeekerProfileOut)
def update_own_job_seeker_profile(
    payload: UpdateJobSeekerProfileRequest,
    user: User = Depends(require_job_seeker),
    db: Session = Depends(get_db),
) -> JobSeekerProfileOut:
    """Save the caller's own profile. The email is not editable here."""
    user.name = payload.name
    user.photo_url = payload.photo_url
    user.headline = payload.headline
    user.career_goals = payload.career_goals
    db.commit()
    db.refresh(user)
    return job_seeker_profile_out(user)
