import sqlite3
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.errors import INVALID_CREDENTIALS, VALIDATION_ERROR, ApiError
from app.models import RevokedToken, User
from app.schemas import (
    AuthenticationErrorOut,
    LoginRequest,
    RegisterRequest,
    RegistrationErrorOut,
    SessionOut,
    UserOut,
)
from app.security import (
    AccessToken,
    create_access_token,
    get_access_token,
    hash_password,
    invalid_session,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _duplicate_email_error() -> ApiError:
    return ApiError(
        status.HTTP_409_CONFLICT,
        VALIDATION_ERROR,
        "An account with this email already exists.",
        {"email": "Already registered."},
    )


def _is_duplicate_email_violation(error: IntegrityError) -> bool:
    """Recognise only the users.email invariant, not unrelated write failures."""
    original = error.orig
    # PostgreSQL/psycopg2 supplies structured diagnostics, independent of language.
    # User.email's existing unique=True, index=True creates ix_users_email.
    if getattr(original, "pgcode", None) == "23505":
        diagnostic = getattr(original, "diag", None)
        return getattr(diagnostic, "constraint_name", None) == "ix_users_email"
    # SQLite is supported by the isolated QA harness. Its diagnostic names columns
    # rather than indexes; matching a generic "unique" message would hide other bugs.
    return (
        isinstance(original, sqlite3.IntegrityError)
        and getattr(original, "sqlite_errorcode", None) == sqlite3.SQLITE_CONSTRAINT_UNIQUE
        and str(original) == "UNIQUE constraint failed: users.email"
    )


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
            "description": (
                "The email is already registered, including concurrent registrations. "
                "Returns VALIDATION_ERROR with fieldErrors.email; no extra account is created."
            ),
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
    and returns public user fields without a session. US-03 maps both the pre-check
    and database email-uniqueness conflicts to 409; US-04's counsellor path is preserved.
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
        raise _duplicate_email_error()

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
    except IntegrityError as error:
        # Another request may have claimed this email after the pre-check. The
        # database is authoritative; roll back before translating the known conflict.
        db.rollback()
        if _is_duplicate_email_violation(error):
            raise _duplicate_email_error() from None
        raise
    except Exception:
        db.rollback()
        raise
    return result


@router.post(
    "/sessions", response_model=SessionOut, operation_id="login",
    responses={
        400: {"model": AuthenticationErrorOut, "description": "Invalid login form fields."},
        401: {"model": AuthenticationErrorOut, "description": "Generic email-or-password error."},
        "4XX": {"model": AuthenticationErrorOut, "description": "Validation returns 400, not 422."},
    },
    openapi_extra={"security": [], "x-requirement-ids": ["US-06", "US-07"]},
)
def login(
    payload: LoginRequest, response: Response, db: Session = Depends(get_db),
) -> SessionOut:
    """US-06, US-07. Generic failure so the endpoint does not reveal account existence."""
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    valid_password = verify_password(payload.password, user.password_hash if user else None)
    if user is None or not valid_password:
        raise ApiError(
            status.HTTP_401_UNAUTHORIZED,
            INVALID_CREDENTIALS,
            "The email or password is incorrect.",
        )

    token, expires_at = create_access_token(user.id, user.role)
    result = SessionOut(
        access_token=token,
        expires_at=expires_at,
        user=UserOut.model_validate(user),
    )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
    return result


@router.delete(
    "/sessions/current", status_code=status.HTTP_204_NO_CONTENT, operation_id="logout",
    responses={
        204: {"description": "Current token durably invalidated; empty response."},
        401: {"model": AuthenticationErrorOut, "description": "Missing or invalid session token."},
    },
    openapi_extra={"x-requirement-ids": ["US-08"]},
)
def logout(
    token: AccessToken = Depends(get_access_token), db: Session = Depends(get_db),
) -> Response:
    """Revoke only this login. Repeating logout for a valid revoked JWT is harmless.

    Intentionally validate signature/expiry/account but not the denylist here;
    every other protected endpoint uses get_current_user and rejects revoked JWTs.
    """
    if db.get(User, token.subject) is None:
        raise invalid_session()

    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        insert = pg_insert
    elif dialect == "sqlite":
        insert = sqlite_insert
    else:
        raise RuntimeError("Unsupported revocation database")
    now = datetime.now(UTC)
    statement = insert(RevokedToken).values(
        token_digest=token.token_digest, expires_at=token.expires_at, revoked_at=now,
    ).on_conflict_do_nothing(index_elements=[RevokedToken.token_digest])
    try:
        # Retain expired records for another day to tolerate modest worker clock
        # skew. Cleanup and insertion are atomic; no valid revocation is purged.
        db.execute(delete(RevokedToken).where(RevokedToken.expires_at <= now - timedelta(days=1)))
        db.execute(statement)
        db.commit()
    except Exception:
        db.rollback()
        raise
    # No post-commit reads: successful invalidation cannot be misreported by refresh.
    return Response(status_code=status.HTTP_204_NO_CONTENT, headers={"Cache-Control": "no-store"})
