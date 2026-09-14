import hashlib
import math
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from argon2.profiles import RFC_9106_LOW_MEMORY
from fastapi import Depends, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import AUTHENTICATION_REQUIRED, FORBIDDEN, ApiError
from app.models import RevokedToken, User

settings = get_settings()
# US-02: make the existing Argon2id policy explicit rather than relying on defaults.
# 64 MiB, 3 iterations, 4 lanes; each hash gets a fresh 16-byte random salt.
_hasher = PasswordHasher.from_parameters(RFC_9106_LOW_MEMORY)
# Public dummy input, not an account credential. Unknown emails still perform
# one Argon2 verification; this reduces the obvious shortcut, not all timing noise.
_dummy_password_hash = _hasher.hash("non-account verification sentinel")
_bearer = HTTPBearer(auto_error=False, scheme_name="bearerAuth")


def hash_password(password: str) -> str:
    """Return an encoded salted hash; never trim or otherwise normalise credentials."""
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        encoded = password_hash if password_hash is not None else _dummy_password_hash
        return _hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: str, role: str) -> tuple[str, datetime]:
    """US-06: independently revocable logins; refresh remains out of scope."""
    issued_at = datetime.now(UTC).replace(microsecond=0)
    expires_at = issued_at + timedelta(minutes=settings.access_token_ttl_minutes)
    payload = {
        "sub": user_id, "role": role, "exp": expires_at,
        "iat": issued_at, "jti": str(uuid.uuid4()),
    }
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return token, expires_at


@dataclass(frozen=True)
class AccessToken:
    subject: str
    expires_at: datetime
    token_digest: str


def invalid_session() -> ApiError:
    return ApiError(
        status.HTTP_401_UNAUTHORIZED,
        AUTHENTICATION_REQUIRED,
        "Your session is invalid or has expired.",
    )


def get_access_token(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> AccessToken:
    """Validate a bearer credential; only logout may omit the revocation check."""
    parts = credentials.credentials.split() if credentials else []
    if len(parts) != 1:
        raise ApiError(status.HTTP_401_UNAUTHORIZED, AUTHENTICATION_REQUIRED, "Log in to continue.")
    encoded = parts[0]
    try:
        payload = jwt.decode(
            encoded,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "role", "exp"]},
        )
        if not isinstance(payload["sub"], str) or not payload["sub"]:
            raise ValueError("Invalid subject")
        if payload["role"] not in ("job_seeker", "counsellor", "platform_owner"):
            raise ValueError("Invalid role")
        for claim in ("exp", "iat", "nbf"):
            if claim in payload:
                value = payload[claim]
                if type(value) not in (int, float) or not math.isfinite(value):
                    raise ValueError("Invalid timestamp")
        if "jti" in payload and (not isinstance(payload["jti"], str) or not payload["jti"]):
            raise ValueError("Invalid token identifier")
        expires_at = datetime.fromtimestamp(payload["exp"], UTC)
    except (jwt.PyJWTError, TypeError, ValueError, OverflowError, OSError):
        raise invalid_session() from None

    # Hash only after signature verification. Equivalent base64url encodings of
    # the signature must not let a logged-out credential evade its denylist entry.
    signing_input = encoded.rsplit(".", 1)[0]
    return AccessToken(
        subject=payload["sub"], expires_at=expires_at,
        token_digest=hashlib.sha256(signing_input.encode("ascii")).hexdigest(),
    )


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[AccessToken, Depends(get_access_token)],
) -> User:
    # Every protected route uses this persistent check; database failures fail
    # closed via the generic error handler rather than accepting an unchecked JWT.
    if db.get(RevokedToken, token.token_digest) is not None:
        raise invalid_session()
    user = db.get(User, token.subject)
    if user is None:
        raise invalid_session()
    return user


def require_job_seeker(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "job_seeker":
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            FORBIDDEN,
            "Only Job Seekers can book a service.",
        )
    return user


def require_counsellor(user: Annotated[User, Depends(get_current_user)]) -> User:
    if user.role != "counsellor":
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            FORBIDDEN,
            "Only counsellors can manage services.",
        )
    return user


def require_verified_counsellor(
    user: Annotated[User, Depends(require_counsellor)],
) -> User:
    """US-34. "Eligible" means a counsellor whose verification has been approved."""
    if user.verification_status != "verified":
        raise ApiError(
            status.HTTP_403_FORBIDDEN,
            FORBIDDEN,
            "Your counsellor account must be verified before you can create a service.",
        )
    return user
