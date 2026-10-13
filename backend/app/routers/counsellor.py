from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.availability import LIVE_BOOKING_STATUSES
from app.config import get_settings
from app.db import get_db
from app.errors import NOT_FOUND, VALIDATION_ERROR, ApiError
from app.models import AvailabilityWindow, Booking, Service, User
from app.payments import gateway, receipts
from app.routers.services import own_service_to_out
from app.schemas import (
    AvailabilityWindowOut,
    CommissionStatementLineOut,
    CommissionStatementOut,
    CounsellorProfileOut,
    CreateAvailabilityWindowRequest,
    CreateServiceRequest,
    Location,
    OnboardingStateOut,
    OwnServiceOut,
    PayoutStatusOut,
    StripeOnboardingOut,
    StripeOnboardingRequest,
    TaxDetailsRequest,
    UpdateAvailabilityWindowRequest,
    UpdateCounsellorProfileRequest,
)
from app.security import require_counsellor, require_publishing_counsellor

router = APIRouter(prefix="/me", tags=["Counsellor"])


# --- US-34 / US-35 / US-37 / US-38: services --------------------------------


@router.get("/services", response_model=list[OwnServiceOut])
def list_own_services(
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> list[OwnServiceOut]:
    """US-34, US-36. Every service the calling counsellor owns, active or not."""
    services = db.scalars(
        select(Service)
        .where(Service.counsellor_id == user.id)
        .order_by(Service.title)
    )
    return [own_service_to_out(s) for s in services]


@router.post("/services", status_code=status.HTTP_201_CREATED,
             response_model=OwnServiceOut)
def create_service(
    payload: CreateServiceRequest,
    user: User = Depends(require_publishing_counsellor),
    db: Session = Depends(get_db),
) -> OwnServiceOut:
    """US-34, US-35, US-37, US-38. An eligible counsellor lists a new service."""
    state = payload.location.state.strip() if payload.location else None
    city = payload.location.city_or_region.strip() if payload.location else None
    if "in_person" in payload.modalities and not (state and city):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "An in-person service needs a meeting area.",
            {"location": "State and city or region are required for in-person delivery."},
        )

    service = Service(
        counsellor_id=user.id,
        title=payload.title,
        description=payload.description,
        price_minor=payload.price_minor,
        duration_minutes=payload.duration_minutes,
        currency=payload.currency,
        modalities=list(payload.modalities),
        location_state=state,
        location_city=city,
        meeting_url=(payload.meeting_url or "").strip() or None,
        active=True,
        review_count=0,
    )
    db.add(service)
    try:
        db.flush()
        # Build the response — including the counsellor relationship read — before
        # committing. A failure here rolls back instead of leaving a saved service
        # behind a 500, which would otherwise invite a duplicate-creating retry.
        result = own_service_to_out(service)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result


def _owned_service_for_edit(db: Session, service_id: str, user: User) -> Service:
    """A service the caller owns. Someone else's is reported as missing, not
    forbidden: whether a given service id exists is not theirs to learn."""
    service = db.get(Service, service_id)
    if service is None or service.counsellor_id != user.id:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Service not found.")
    return service


@router.patch("/services/{service_id}", response_model=OwnServiceOut)
def update_service(
    service_id: str,
    payload: CreateServiceRequest,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> OwnServiceOut:
    """US-36. Edit a service the caller owns.

    The body is the whole service, not a patch of changed fields: the edit form
    submits every field, and applying a partial update to a form that always sends
    the lot would silently drop a cleared location.

    Editing does not disturb bookings already made — those carry their own frozen
    price and details, so changing the listing never rewrites what someone has
    already agreed to pay.
    """
    service = _owned_service_for_edit(db, service_id, user)
    state = payload.location.state.strip() if payload.location else None
    city = payload.location.city_or_region.strip() if payload.location else None
    if "in_person" in payload.modalities and not (state and city):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "An in-person service needs a meeting area.",
            {"location": "State and city or region are required for in-person delivery."},
        )

    service.title = payload.title
    service.description = payload.description
    service.price_minor = payload.price_minor
    service.duration_minutes = payload.duration_minutes
    service.currency = payload.currency
    service.modalities = list(payload.modalities)
    service.location_state = state
    service.location_city = city
    # Clearing the field returns the service to auto-generated rooms, which is the
    # only way back once a counsellor has set one.
    service.meeting_url = (payload.meeting_url or "").strip() or None
    try:
        db.flush()
        result = own_service_to_out(service)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result


@router.delete("/services/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_service(
    service_id: str,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> Response:
    """US-36. Withdraw a service from the Marketplace.

    A soft delete: the row stays and is marked inactive. Bookings, orders and
    receipts all reference it, and a job seeker who paid for a session must still be
    able to see what they bought — so the listing is withdrawn, never erased.
    Deleting twice is not an error; the end state is what was asked for.
    """
    service = _owned_service_for_edit(db, service_id, user)
    service.active = False
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- US-30 / US-31: the professional profile --------------------------------


def counsellor_profile_out(
    user: User, *, enforce_visibility: bool = False,
) -> CounsellorProfileOut:
    visibility = user.profile_visibility or "public"
    if enforce_visibility and visibility == "restricted":
        return CounsellorProfileOut(
            id=user.id,
            display_name=user.name,
            verification_status=user.verification_status,
            overall_rating=user.overall_rating,
            review_count=user.review_count,
            visibility="restricted",
            restricted=True,
        )

    hide_details = enforce_visibility and visibility == "partial"
    location = None
    if not hide_details and user.base_location_state and user.base_location_city:
        location = Location(
            state=user.base_location_state, city_or_region=user.base_location_city,
        )
    return CounsellorProfileOut(
        id=user.id,
        display_name=user.name,
        photo_url=None if hide_details else user.photo_url,
        linkedin_url="" if hide_details else (user.linkedin_url or ""),
        introduction=user.introduction or "",
        background="" if hide_details else (user.background or ""),
        experience="" if hide_details else (user.experience or ""),
        qualifications=[] if hide_details else (user.qualifications or []),
        expertise=[] if hide_details else (user.expertise or []),
        languages=[] if hide_details else (user.languages or []),
        base_location=location,
        default_modality=user.default_modality or "online",
        verification_status=user.verification_status,
        overall_rating=user.overall_rating,
        review_count=user.review_count,
        visibility=visibility if enforce_visibility else None,
    )


@router.get(
    "/counsellor-profile", response_model=CounsellorProfileOut,
    response_model_exclude_none=True,
)
def get_own_counsellor_profile(
    user: User = Depends(require_counsellor),
) -> CounsellorProfileOut:
    """Return the owner's complete profile regardless of public visibility."""
    return counsellor_profile_out(user)


@router.patch(
    "/counsellor-profile", response_model=CounsellorProfileOut,
    response_model_exclude_none=True,
)
def update_own_counsellor_profile(
    payload: UpdateCounsellorProfileRequest,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> CounsellorProfileOut:
    """US-30, US-31. Save the caller's own profile.

    The LinkedIn URL is required because it is what the Platform Owner verifies the
    counsellor from; a profile without one cannot be reviewed. Verification status is
    not settable here — that is the Platform Owner's to decide, not the subject's.

    The URL itself is validated and normalised by `UpdateCounsellorProfileRequest`
    (the same check `SubmitVerificationRequest` uses) — not here, so the two write
    paths can never drift back out of agreement with each other.
    """
    user.photo_url = payload.photo_url
    user.linkedin_url = payload.linkedin_url
    user.introduction = payload.introduction
    user.background = payload.background
    user.experience = payload.experience
    user.qualifications = payload.qualifications
    user.expertise = payload.expertise
    user.languages = payload.languages
    user.base_location_state = payload.base_location.state if payload.base_location else None
    user.base_location_city = (
        payload.base_location.city_or_region if payload.base_location else None
    )
    user.default_modality = payload.default_modality
    db.commit()
    db.refresh(user)
    return counsellor_profile_out(user)


@router.get(
    "/onboarding-state", response_model=OnboardingStateOut, operation_id="getOnboardingState",
    openapi_extra={"x-requirement-ids": ["US-05"]},
)
def get_onboarding_state(
    user: User = Depends(require_counsellor),
) -> OnboardingStateOut:
    """US-05. Whether this Career Professional still has first-login setup to do.

    Read-only: this never writes `verification_submitted_at` or anything else.
    `update_own_counsellor_profile` (US-30) and `submit_verification` (US-31) already
    own those writes; this endpoint only reports what they have recorded, so the app
    has one place to ask "is onboarding done" without duplicating either rule.
    """
    profile_complete = bool(user.introduction and user.background and user.experience)
    # Matches the frontend's own verificationState(): pending with no LinkedIn URL on
    # file is "unsubmitted", everything else (pending-with-a-URL, verified, rejected)
    # is a submission that has happened.
    verification_submitted = not (user.verification_status == "pending" and not user.linkedin_url)
    return OnboardingStateOut(
        profile_complete=profile_complete,
        verification_submitted=verification_submitted,
        complete=profile_complete and verification_submitted,
    )


# --- US-39: counsellor availability windows ---------------------------------


def _as_utc(value: datetime) -> datetime:
    """Treat a naive datetime as UTC so comparisons never mix tz-aware and naive."""
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _lock_counsellor(db: Session, user: User) -> None:
    """A counsellor is one person, so their windows are one calendar. Locking their
    row serialises any concurrent create/update of any window against this one,
    making the merge check below atomic with the write that follows it."""
    db.scalar(select(User).where(User.id == user.id).with_for_update())


def _validate_window(starts_at: datetime, ends_at: datetime) -> None:
    starts_at, ends_at = _as_utc(starts_at), _as_utc(ends_at)
    if ends_at <= starts_at:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "A window must end after it starts.",
            {"endsAt": "Must be later than startsAt."},
        )
    if starts_at <= datetime.now(UTC):
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "A window must start in the future.",
            {"startsAt": "Must be in the future."},
        )


def _owned_window(db: Session, window_id: str, user: User) -> AvailabilityWindow:
    window = db.scalar(
        select(AvailabilityWindow).where(AvailabilityWindow.id == window_id).with_for_update()
    )
    if window is None or window.counsellor_id != user.id:
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Availability window not found.")
    _lock_counsellor(db, user)
    return window


def _booked_spans(db: Session, window: AvailabilityWindow) -> list[tuple[datetime, datetime]]:
    """Sessions already committed inside this window, which an edit must not strand."""
    bookings = db.scalars(
        select(Booking).where(
            Booking.window_id == window.id,
            Booking.status.in_(LIVE_BOOKING_STATUSES),
        )
    )
    return [(b.starts_at, b.ends_at) for b in bookings]


def _window_out(db: Session, window: AvailabilityWindow) -> AvailabilityWindowOut:
    return AvailabilityWindowOut(
        id=window.id,
        starts_at=window.starts_at,
        ends_at=window.ends_at,
        modalities=list(window.modalities or ["online", "in_person"]),
        has_bookings=bool(_booked_spans(db, window)),
    )


def _merge_overlapping(
    db: Session,
    user: User,
    starts_at: datetime,
    ends_at: datetime,
    modalities: list[str],
    keep_id: str | None = None,
) -> tuple[datetime, datetime]:
    """Absorb any windows this one touches, and return the combined span.

    Overlapping windows are not an error here, unlike the slots they replace: two
    stretches of availability that meet simply describe one longer stretch, and
    refusing them made a counsellor's calendar harder to express for no benefit.
    Adjacent windows are merged too, so 9-10 and 10-11 become 9-11.
    """
    starts_at, ends_at = _as_utc(starts_at), _as_utc(ends_at)
    siblings = list(
        db.scalars(
            select(AvailabilityWindow).where(AvailabilityWindow.counsellor_id == user.id)
        )
    )
    for other in siblings:
        if other.id == keep_id:
            continue
        # Only windows offering the same ways to meet describe the same availability.
        # An online-only morning and an any-modality afternoon are two different
        # statements, and merging them would silently widen one of them.
        if set(other.modalities or []) != set(modalities):
            continue
        # <= rather than <, so touching windows join rather than sitting end to end.
        if other.starts_at <= ends_at and starts_at <= other.ends_at:
            starts_at = min(starts_at, other.starts_at)
            ends_at = max(ends_at, other.ends_at)
            db.delete(other)
    return starts_at, ends_at


@router.get("/availability-windows", response_model=list[AvailabilityWindowOut])
def list_own_availability_windows(
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> list[AvailabilityWindowOut]:
    """US-39. The caller's whole calendar, soonest first."""
    windows = db.scalars(
        select(AvailabilityWindow)
        .where(AvailabilityWindow.counsellor_id == user.id)
        .order_by(AvailabilityWindow.starts_at)
    )
    return [_window_out(db, w) for w in windows]


@router.post(
    "/availability-windows",
    status_code=status.HTTP_201_CREATED,
    response_model=AvailabilityWindowOut,
)
def create_availability_window(
    payload: CreateAvailabilityWindowRequest,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> AvailabilityWindowOut:
    """US-39. Declare availability. Every service the counsellor offers can be booked
    inside it, and booking one consumes the time for all of them."""
    _lock_counsellor(db, user)
    _validate_window(payload.starts_at, payload.ends_at)
    modalities = list(payload.modalities)
    starts_at, ends_at = _merge_overlapping(
        db, user, payload.starts_at, payload.ends_at, modalities,
    )

    window = AvailabilityWindow(
        counsellor_id=user.id, starts_at=starts_at, ends_at=ends_at, modalities=modalities,
    )
    db.add(window)
    try:
        db.flush()
        result = _window_out(db, window)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result


@router.patch("/availability-windows/{window_id}", response_model=AvailabilityWindowOut)
def update_availability_window(
    window_id: str,
    payload: UpdateAvailabilityWindowRequest,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> AvailabilityWindowOut:
    """US-39. Move a window's boundaries, so long as no booked session falls outside
    the result — someone has already paid for that time."""
    if payload.starts_at is None and payload.ends_at is None:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "Provide a new startsAt or endsAt.",
            {"_": "At least one of startsAt or endsAt is required."},
        )
    window = _owned_window(db, window_id, user)
    starts_at = _as_utc(payload.starts_at or window.starts_at)
    ends_at = _as_utc(payload.ends_at or window.ends_at)
    _validate_window(starts_at, ends_at)

    for booked_start, booked_end in _booked_spans(db, window):
        if booked_start < starts_at or booked_end > ends_at:
            raise ApiError(
                status.HTTP_409_CONFLICT,
                "SLOT_UNAVAILABLE",
                "A session is already booked in the part you are removing.",
            )

    modalities = list(payload.modalities) if payload.modalities else list(window.modalities or [])
    starts_at, ends_at = _merge_overlapping(
        db, user, starts_at, ends_at, modalities, keep_id=window.id,
    )
    window.starts_at, window.ends_at = starts_at, ends_at
    window.modalities = modalities
    try:
        db.flush()
        result = _window_out(db, window)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return result


@router.delete("/availability-windows/{window_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_availability_window(
    window_id: str,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> Response:
    """US-39. Withdraw availability. Refused while a session is booked inside it:
    that time is already sold, and the way out is to cancel the booking."""
    window = _owned_window(db, window_id, user)
    if _booked_spans(db, window):
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "SLOT_UNAVAILABLE",
            "A session is booked in this window. Cancel it before removing the time.",
        )
    db.delete(window)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- payments spec §7: Stripe Connect onboarding and payouts ----------------


def _payout_status(counsellor: User) -> PayoutStatusOut:
    return PayoutStatusOut(
        stripe_account_id=counsellor.stripe_account_id,
        charges_enabled=counsellor.charges_enabled,
        payouts_enabled=counsellor.payouts_enabled,
        # Both halves are needed, not just the flag: a Transfer has to name a
        # destination account, so a counsellor with no connected account cannot be
        # paid however the flag reads, and must not be told they are ready.
        onboarding_required=not (counsellor.payouts_enabled and counsellor.stripe_account_id),
        abn=counsellor.abn,
        gst_registered=counsellor.gst_registered,
    )


@router.get("/payout-status", response_model=PayoutStatusOut)
def get_payout_status(
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> PayoutStatusOut:
    """Whether this counsellor can be paid yet.

    The flags are what Stripe last told us over account.updated. When there is an
    account but no webhook has landed — common right after onboarding, and always
    the case if webhook forwarding is not running locally — the account is read back
    from Stripe once so the counsellor is not left looking at a stale "not ready".
    """
    if user.stripe_account_id and not user.payouts_enabled and get_settings().payments_enabled:
        try:
            account = gateway.retrieve_account(user.stripe_account_id)
        except gateway.PaymentProviderError:
            return _payout_status(user)  # Stripe is unreachable; report what we know.
        user.charges_enabled = account.charges_enabled
        user.payouts_enabled = account.payouts_enabled
        db.commit()
    return _payout_status(user)


@router.post("/stripe-onboarding", response_model=StripeOnboardingOut)
def start_stripe_onboarding(
    payload: StripeOnboardingRequest | None = None,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> StripeOnboardingOut:
    """Create the connected account if there isn't one, then mint a fresh Account Link.

    Account Links are single-use and expire in minutes, so this always creates a new
    one rather than handing back a stored URL — including for a counsellor who
    abandoned onboarding half an hour ago and has come back to finish it.
    """
    if not get_settings().payments_enabled:
        raise ApiError(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "PAYMENTS_UNAVAILABLE",
            "Payouts are not configured on this server.",
        )
    try:
        if not user.stripe_account_id:
            account = gateway.create_connected_account(user)
            user.stripe_account_id = account.id
            # Commit before the link call: an account created at Stripe but not
            # recorded here would be orphaned, and the next attempt would make
            # a second one for the same counsellor.
            db.commit()
            db.refresh(user)
        # The app says where it wants the counsellor back; the gateway honours it
        # only if it is our own deep link or an origin we serve.
        url = gateway.create_account_link(
            user.stripe_account_id, payload.return_to if payload else None,
        )
    except gateway.PaymentProviderError as error:
        raise ApiError(
            status.HTTP_502_BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR", str(error),
        ) from error
    return StripeOnboardingOut(url=url, account_id=user.stripe_account_id)


@router.put("/tax-details", response_model=PayoutStatusOut)
def update_tax_details(
    payload: TaxDetailsRequest,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> PayoutStatusOut:
    """The ABN and GST registration a counsellor's receipts are issued under (spec §12).

    Changing these only affects bookings made from now on: every order already placed
    carries its own snapshot, so receipts already issued keep saying what was true.
    """
    if payload.gst_registered and not payload.abn:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "A GST-registered Career Professional needs an ABN on their tax invoices.",
            {"abn": "Required when you are registered for GST."},
        )
    user.abn = payload.abn
    user.gst_registered = payload.gst_registered
    if payload.legal_name is not None:
        user.legal_name = payload.legal_name.strip() or None
    db.commit()
    db.refresh(user)
    return _payout_status(user)


@router.get(
    "/commission-statements/{year}/{month}",
    response_model=CommissionStatementOut,
)
def get_commission_statement(
    year: int,
    month: int,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> CommissionStatementOut:
    """Payments spec §11 — the platform's monthly commission invoice to this counsellor."""
    if not 1 <= month <= 12 or not 2000 <= year <= 2999:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST, VALIDATION_ERROR, "That is not a real month.",
        )
    statement = receipts.build_commission_statement(db, user, year, month)
    return CommissionStatementOut(
        counsellor_name=statement.counsellor_name,
        counsellor_abn=statement.counsellor_abn,
        platform_name=statement.platform_name,
        platform_abn=statement.platform_abn,
        platform_gst_registered=statement.platform_gst_registered,
        period_start=statement.period_start,
        period_end=statement.period_end,
        lines=[CommissionStatementLineOut(**line.__dict__) for line in statement.lines],
        commission_total_minor=statement.commission_total_minor,
        commission_gst_total_minor=statement.commission_gst_total_minor,
        payout_total_minor=statement.payout_total_minor,
        text=statement.render_text(),
    )
