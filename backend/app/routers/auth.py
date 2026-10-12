import sqlite3
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, Response, status
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.errors import INVALID_CREDENTIALS, VALIDATION_ERROR, ApiError
from app.mail import messages
from app.models import RefreshToken, RevokedToken, SingleUseToken, User
from app.schemas import (
    AuthenticationErrorOut,
    EmailRequest,
    LoginRequest,
    LogoutRequest,
    PasswordResetRequest,
    RefreshSessionRequest,
    RegisterRequest,
    RegistrationErrorOut,
    SessionOut,
    UserOut,
    VerifyEmailRequest,
)
from app.security import (
    RESET_PASSWORD,
    VERIFY_EMAIL,
    AccessToken,
    create_access_token,
    digest_refresh_token,
    digest_token,
    get_access_token,
    hash_password,
    invalid_session,
    new_refresh_token,
    new_single_use_token,
    refresh_token_ttl,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def user_out(user: User) -> UserOut:
    """The public view of an account. `emailVerified` is derived, not stored twice."""
    return UserOut(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        email_verified=user.email_verified_at is not None,
    )


def issue_single_use_token(db: Session, user: User, purpose: str, ttl_hours: int) -> str:
    """Mint a link token, retiring any earlier one for the same purpose.

    Superseding matters: asking for a second verification email should not leave the
    first link working, or "resend" would quietly widen the window rather than
    replace it.
    """
    db.execute(
        update(SingleUseToken)
        .where(
            SingleUseToken.user_id == user.id,
            SingleUseToken.purpose == purpose,
            SingleUseToken.used_at.is_(None),
        )
        .values(used_at=datetime.now(UTC))
    )
    raw, digest = new_single_use_token()
    db.add(
        SingleUseToken(
            token_digest=digest,
            user_id=user.id,
            purpose=purpose,
            expires_at=datetime.now(UTC) + timedelta(hours=ttl_hours),
        )
    )
    return raw


def consume_single_use_token(db: Session, raw: str, purpose: str) -> User | None:
    """Spend a link token, or return None for anything not currently valid.

    The purpose is part of the check, not decoration: without it a link mailed to
    confirm an address would also reset the password on that account.
    """
    record = db.scalar(
        select(SingleUseToken)
        .where(SingleUseToken.token_digest == digest_token(raw))
        .with_for_update()
    )
    now = datetime.now(UTC)
    if record is None or record.purpose != purpose:
        return None
    if record.used_at is not None or record.expires_at <= now:
        return None
    record.used_at = now
    return db.get(User, record.user_id)


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
    settings = get_settings()
    try:
        db.add(user)
        db.flush()
        # The confirmation link is minted inside the same transaction as the account,
        # so a registration can never succeed without one waiting to be sent.
        verification_token = issue_single_use_token(
            db, user, VERIFY_EMAIL, settings.email_verification_ttl_hours,
        )
        # Build the safe response, and read everything the email needs, before
        # committing. A post-commit refresh can fail after the account is already
        # saved, incorrectly telling the app to retry.
        result = user_out(user)
        recipient, recipient_name = user.email, user.name
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

    # Sent after the commit: the account exists either way, and mail is best-effort.
    messages.verify_email(
        recipient, recipient_name, verification_token, settings.email_verification_ttl_hours,
    )
    return result


def _issue_session(
    db: Session, user: User, client: str, family_id: str | None = None,
) -> SessionOut:
    """Mint an access token and the refresh token that will succeed it.

    `family_id` carries the lineage forward on a rotation; a fresh login starts a new
    one. The raw refresh token is returned here and nowhere else — only its digest
    reaches the database.
    """
    token, expires_at = create_access_token(user.id, user.role)
    raw_refresh, digest = new_refresh_token()
    refresh_expires_at = datetime.now(UTC) + refresh_token_ttl(client)
    record = RefreshToken(
        token_digest=digest,
        user_id=user.id,
        client=client,
        expires_at=refresh_expires_at,
    )
    if family_id is not None:
        record.family_id = family_id
    db.add(record)
    return SessionOut(
        access_token=token,
        expires_at=expires_at,
        user=user_out(user),
        refresh_token=raw_refresh,
        refresh_expires_at=refresh_expires_at,
    )


@router.post(
    "/sessions/refresh", response_model=SessionOut, operation_id="refreshSession",
    responses={
        401: {"model": AuthenticationErrorOut, "description": "Unknown, used, revoked or expired."},
    },
    openapi_extra={"security": [], "x-requirement-ids": ["US-06"]},
)
def refresh_session(
    payload: RefreshSessionRequest, response: Response, db: Session = Depends(get_db),
) -> SessionOut:
    """US-06. Exchange a refresh token for a new session, and rotate it.

    Every failure answers the same way. Whether a token is unknown, already spent,
    revoked or merely old is not something a caller holding a bad token should be
    able to tell apart.
    """
    record = db.scalar(
        select(RefreshToken)
        .where(RefreshToken.token_digest == digest_refresh_token(payload.refresh_token))
        .with_for_update()
    )
    if record is None:
        raise invalid_session()

    now = datetime.now(UTC)
    if record.used_at is not None:
        # This token was already exchanged, so two copies exist and one of them is
        # not the owner's. There is no way to tell which, so the whole lineage goes
        # and both parties sign in again. This is the rotation's entire point.
        db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.family_id == record.family_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
        db.commit()
        raise invalid_session()
    # UtcDateTime guarantees an aware value on read, so this compares cleanly.
    if record.revoked_at is not None or record.expires_at <= now:
        raise invalid_session()

    user = db.get(User, record.user_id)
    if user is None:
        raise invalid_session()

    record.used_at = now
    result = _issue_session(db, user, payload.client, family_id=record.family_id)
    # Expired rows are of no further use and this is the natural moment to drop them.
    db.execute(delete(RefreshToken).where(RefreshToken.expires_at <= now - timedelta(days=1)))
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"
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

    result = _issue_session(db, user, payload.client)
    db.commit()
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
    payload: LogoutRequest | None = None,
    token: AccessToken = Depends(get_access_token),
    db: Session = Depends(get_db),
) -> Response:
    """Revoke only this login. Repeating logout for a valid revoked JWT is harmless.

    Intentionally validate signature/expiry/account but not the denylist here;
    every other protected endpoint uses get_current_user and rejects revoked JWTs.
    """
    if db.get(User, token.subject) is None:
        raise invalid_session()

    # Denylisting the access token alone would end nothing: its refresh token could
    # mint a new one seconds later. The whole family goes, so every token descended
    # from this login dies with it.
    if payload is not None and payload.refresh_token:
        record = db.scalar(
            select(RefreshToken).where(
                RefreshToken.token_digest == digest_refresh_token(payload.refresh_token)
            )
        )
        if record is not None and record.user_id == token.subject:
            db.execute(
                update(RefreshToken)
                .where(
                    RefreshToken.family_id == record.family_id,
                    RefreshToken.revoked_at.is_(None),
                )
                .values(revoked_at=datetime.now(UTC))
            )

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


# --- US-06 / US-70: confirming an address, and recovering an account --------


@router.post(
    "/email-verifications", response_model=SessionOut, operation_id="verifyEmail",
    responses={
        400: {"model": AuthenticationErrorOut, "description": "Unknown, spent or expired link."},
    },
    openapi_extra={"security": [], "x-requirement-ids": ["US-06"]},
)
def verify_email(
    payload: VerifyEmailRequest, response: Response, db: Session = Depends(get_db),
) -> SessionOut:
    """Confirm an address and hand back a session, so the link signs the person in.

    Someone who has just proved they own the address should not then be asked for
    their password; the whole point of the link is that it is evidence.
    """
    user = consume_single_use_token(db, payload.token, VERIFY_EMAIL)
    if user is None:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "This confirmation link is no longer valid. Ask for a new one.",
            {"token": "Expired or already used."},
        )

    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(UTC)
    result = _issue_session(db, user, "web")
    db.commit()
    response.headers["Cache-Control"] = "no-store"
    return result


@router.post(
    "/email-verification-requests", status_code=status.HTTP_202_ACCEPTED,
    operation_id="requestEmailVerification",
    responses={202: {"description": "Accepted whether or not the address has an account."}},
    openapi_extra={"security": [], "x-requirement-ids": ["US-06"]},
)
def request_email_verification(
    payload: EmailRequest, db: Session = Depends(get_db),
) -> Response:
    """Send a fresh confirmation link.

    Always 202. Answering differently for a known address would turn this into a way
    to find out who has an account.
    """
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is not None and user.email_verified_at is None:
        settings = get_settings()
        token = issue_single_use_token(
            db, user, VERIFY_EMAIL, settings.email_verification_ttl_hours,
        )
        recipient, recipient_name = user.email, user.name
        db.commit()
        messages.verify_email(
            recipient, recipient_name, token, settings.email_verification_ttl_hours,
        )
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post(
    "/password-reset-requests", status_code=status.HTTP_202_ACCEPTED,
    operation_id="requestPasswordReset",
    responses={202: {"description": "Accepted whether or not the address has an account."}},
    openapi_extra={"security": [], "x-requirement-ids": ["US-70"]},
)
def request_password_reset(
    payload: EmailRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db),
) -> Response:
    """US-70. Mail a reset link, without revealing whether the account exists.

    The status and body already match for a known and an unknown address; what does
    not match on its own is the time taken, since minting a token and sending mail
    is real work an unknown address skips entirely. Deferring the send to a
    background task — it runs after the response is already on the wire, not before
    — removes that gap for the network observer this defends against, the same
    target `_dummy_password_hash` protects login against, even though an in-process
    TestClient (which waits for background tasks before returning) cannot observe
    the difference it makes on a real connection.
    """
    user = db.scalar(select(User).where(User.email == payload.email.lower()))
    if user is not None:
        settings = get_settings()
        token = issue_single_use_token(
            db, user, RESET_PASSWORD, settings.password_reset_ttl_hours,
        )
        recipient, recipient_name = user.email, user.name
        db.commit()
        background_tasks.add_task(
            messages.password_reset, recipient, recipient_name, token,
            settings.password_reset_ttl_hours,
        )
    return Response(status_code=status.HTTP_202_ACCEPTED)


@router.post(
    "/password-resets", status_code=status.HTTP_204_NO_CONTENT, operation_id="resetPassword",
    responses={
        204: {"description": "Password changed and every other session ended."},
        400: {"model": AuthenticationErrorOut, "description": "Invalid link or password."},
    },
    openapi_extra={"security": [], "x-requirement-ids": ["US-70"]},
)
def reset_password(payload: PasswordResetRequest, db: Session = Depends(get_db)) -> Response:
    """Set a new password and end every existing session.

    A reset usually means the account was compromised, so leaving the attacker's
    sessions alive would defeat it. Both halves are needed: revoking refresh tokens
    stops the session being extended, and the `sessions_invalidated_at` cutoff retires
    access tokens already issued without having to enumerate them.
    """
    if payload.password != payload.password_confirmation:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "The passwords do not match.",
            {"passwordConfirmation": "Must match the new password."},
        )

    user = consume_single_use_token(db, payload.token, RESET_PASSWORD)
    if user is None:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "This reset link is no longer valid. Ask for a new one.",
            {"token": "Expired or already used."},
        )

    now = datetime.now(UTC)
    user.password_hash = hash_password(payload.password)
    user.sessions_invalidated_at = now
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
