from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import INVALID_CREDENTIALS, VALIDATION_ERROR, ApiError
from app.models import User
from app.schemas import LoginRequest, RegisterRequest, SessionOut, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/users", status_code=status.HTTP_201_CREATED, response_model=UserOut)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> User:
    """US-01..US-04. Account created; caller then logs in."""
    if payload.password != payload.password_confirmation:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "Passwords do not match.",
            {"passwordConfirmation": "Does not match password."},
        )

    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)) is not None:
        raise ApiError(
            status.HTTP_409_CONFLICT,
            VALIDATION_ERROR,
            "An account with this email already exists.",
            {"email": "Already registered."},
        )

    user = User(
        name=payload.name.strip(),
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/sessions", response_model=SessionOut)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> SessionOut:
    """US-06, US-07. Generic failure so the endpoint does not reveal account existence."""
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise ApiError(
            status.HTTP_401_UNAUTHORIZED,
            INVALID_CREDENTIALS,
            "The email or password is incorrect.",
        )

    token, expires_at = create_access_token(user.id, user.role)
    return SessionOut(
        access_token=token,
        expires_at=expires_at,
        user=UserOut.model_validate(user),
    )
