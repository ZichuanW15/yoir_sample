from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import Depends, Header, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import AUTHENTICATION_REQUIRED, FORBIDDEN, ApiError
from app.models import User

settings = get_settings()
_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_access_token(user_id: str, role: str) -> tuple[str, datetime]:
    """Stateless access token. Refresh tokens (US-08) are a follow-on slice."""
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {"sub": user_id, "role": role, "exp": expires_at}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise ApiError(status.HTTP_401_UNAUTHORIZED, AUTHENTICATION_REQUIRED, "Log in to continue.")
    try:
        payload = jwt.decode(
            authorization.removeprefix("Bearer ").strip(),
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = payload.get("sub")
    except jwt.PyJWTError as exc:
        raise ApiError(
            status.HTTP_401_UNAUTHORIZED,
            AUTHENTICATION_REQUIRED,
            "Your session is invalid or has expired.",
        ) from exc
    user = db.get(User, user_id)
    if user is None:
        raise ApiError(
            status.HTTP_401_UNAUTHORIZED,
            AUTHENTICATION_REQUIRED,
            "Your session is invalid or has expired.",
        )
    return user


def require_job_seeker(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "job_seeker":
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            FORBIDDEN,
            "Only Job Seekers can book a service.",
        )
    return user
