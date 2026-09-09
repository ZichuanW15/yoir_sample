from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import INVALID_CREDENTIALS, VALIDATION_ERROR, ApiError
from app.models import User
from app.schemas import LoginRequest, RegisterRequest, RegistrationErrorOut, SessionOut, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/users",
    status_code=status.HTTP_201_CREATED,
    response_model=UserOut,
    operation_id="register",
    summary="Register an account",
    response_description="Account created; no session is issued. Continue to log in.",
    responses={
        400: {
            "model": RegistrationErrorOut,
            "description": "Invalid or missing form fields, or mismatched passwords.",
        },
        409: {
            "model": RegistrationErrorOut,
            "description": "The email is already registered.",
        },
        # Our validation handler returns 400 in this envelope, not FastAPI's default 422.
        "4XX": {
            "model": RegistrationErrorOut,
            "description": "Client errors use the same error envelope; validation returns 400.",
        },
    },
    openapi_extra={"security": [], "x-requirement-ids": ["US-01", "US-02", "US-03", "US-04"]},
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> UserOut:
    """Submit name, email, password, passwordConfirmation and role without authentication.

    US-01 validates the request; US-02 commits the account with only a password hash
    and returns public user fields without a session. The shared endpoint also
    preserves the existing duplicate-email and counsellor behaviour for US-03/US-04.
    Errors contain English messages and camelCase fieldErrors for the form.
    """
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
        name=payload.name,
        email=email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    try:
        db.add(user)
        db.flush()
        # Build the safe response before committing. A post-commit refresh can fail
        # after the account is already saved, incorrectly telling the app to retry.
        result = UserOut.model_validate(user)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result


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
