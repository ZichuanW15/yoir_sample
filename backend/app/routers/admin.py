"""The Platform Owner's view of the whole platform (US-32, US-48, US-58).

Two rules run through this file.

The first is that every number is *read*, never recalculated. Each order carries a
frozen breakdown written when it was paid, and that is the same breakdown the job
seeker's receipt was issued from. Recomputing totals here from the current fee
percentage would let the dashboard quietly restate history the day somebody changes
a setting, and the platform would then disagree with its own receipts.

The second is that a counsellor's profile *is* their verification submission. There
is no separate submissions table, because a second row recording the same fact would
eventually disagree with the profile about whether someone is verified.
"""

import logging
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.db import get_db
from app.errors import NOT_FOUND, VALIDATION_ERROR, ApiError
from app.mail import messages
from app.models import Booking, Order, Service, User
from app.schemas import (
    AdminBookingOut,
    AdminCounsellorOut,
    AdminMoneyOut,
    AdminStatsOut,
    PaymentOversightOut,
    SubmitVerificationRequest,
    VerificationDecisionRequest,
    VerificationSubmissionOut,
)
from app.security import require_counsellor, require_platform_owner

log = logging.getLogger(__name__)

router = APIRouter(tags=["Administration"])

#: Orders whose money actually moved. A held order that was never paid has a frozen
#: breakdown too, and counting it would inflate every total on the dashboard.
SETTLED_ORDER_STATUSES = ("confirmed", "refunded_slot_taken", "cancelled")


def aliased_user():
    """A second alias of `users`: an order names a job seeker and a counsellor, and
    joining the same table twice needs them told apart."""
    return aliased(User)


def _submission_out(user: User) -> VerificationSubmissionOut:
    return VerificationSubmissionOut(
        # The counsellor is the submission, so it is their id in both places rather
        # than a second identifier that could drift out of step with it.
        id=user.id,
        counsellor_id=user.id,
        counsellor_name=user.name,
        email=user.email,
        linked_in_url=user.linkedin_url or "",
        introduction=user.introduction or "",
        background=user.background or "",
        experience=user.experience or "",
        status=user.verification_status,
        submitted_at=user.verification_submitted_at or user.created_at,
        decided_at=user.verification_decided_at,
        decision_reason=user.verification_decision_reason,
    )


# --- US-58: the verification queue ------------------------------------------


@router.get(
    "/admin/verifications", response_model=list[VerificationSubmissionOut],
    operation_id="listVerificationSubmissions",
    openapi_extra={"x-required-role": "platform_owner", "x-requirement-ids": ["US-58"]},
)
def list_verification_submissions(
    status_filter: str = Query("pending", alias="status"),
    _owner: User = Depends(require_platform_owner),
    db: Session = Depends(get_db),
) -> list[VerificationSubmissionOut]:
    """US-58. Counsellors waiting on a decision, oldest first.

    Oldest first because this is a queue someone works through: newest-first would
    leave the person who has waited longest permanently at the bottom.
    """
    if status_filter not in {"pending", "verified", "rejected", "all"}:
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "Filter submissions by pending, verified, rejected or all.",
            {"status": "Unknown value."},
        )

    query = select(User).where(User.role == "counsellor")
    if status_filter != "all":
        query = query.where(User.verification_status == status_filter)
    submissions = db.scalars(
        query.order_by(User.verification_submitted_at.asc(), User.created_at.asc())
    )
    return [_submission_out(user) for user in submissions]


@router.post(
    "/admin/verifications/{submission_id}/decision",
    response_model=VerificationSubmissionOut, operation_id="decideVerification",
    openapi_extra={
        "x-required-role": "platform_owner", "x-requirement-ids": ["US-32", "US-58"],
    },
)
def decide_verification(
    submission_id: str,
    payload: VerificationDecisionRequest,
    _owner: User = Depends(require_platform_owner),
    db: Session = Depends(get_db),
) -> VerificationSubmissionOut:
    """US-32, US-58. Approve or reject a counsellor, and tell them which."""
    counsellor = db.get(User, submission_id)
    if counsellor is None or counsellor.role != "counsellor":
        raise ApiError(status.HTTP_404_NOT_FOUND, NOT_FOUND, "Submission not found.")

    reason = payload.reason.strip()
    if payload.decision == "rejected" and not reason:
        # A rejection with no reason is a dead end: the counsellor cannot tell what
        # to fix, so they either give up or resubmit the same thing.
        raise ApiError(
            status.HTTP_400_BAD_REQUEST,
            VALIDATION_ERROR,
            "Say why, so the counsellor knows what to change.",
            {"reason": "A reason is required when rejecting."},
        )

    counsellor.verification_status = payload.decision
    counsellor.verification_decided_at = datetime.now(UTC)
    counsellor.verification_decision_reason = reason or None
    result = _submission_out(counsellor)
    recipient, recipient_name = counsellor.email, counsellor.name
    db.commit()

    # After the commit, on values read before it: the decision stands whether or not
    # the email gets through, and a post-commit attribute read can fail. Reporting a
    # 500 here would tell the Platform Owner a recorded decision had failed, and
    # invite them to make it again.
    try:
        messages.verification_decided(recipient, recipient_name, payload.decision, reason)
    except Exception:
        log.exception("Could not send the verification decision email to %s", recipient)
    return result


# --- US-48: money oversight -------------------------------------------------


@router.get(
    "/admin/payments", response_model=list[PaymentOversightOut],
    operation_id="listPaymentOversight",
    openapi_extra={"x-required-role": "platform_owner", "x-requirement-ids": ["US-48"]},
)
def list_payment_oversight(
    limit: int = Query(200, ge=1, le=1000),
    _owner: User = Depends(require_platform_owner),
    db: Session = Depends(get_db),
) -> list[PaymentOversightOut]:
    """US-48. Every order's money, newest first, with no card details anywhere.

    The Platform Owner needs to see that money moved and where it went; they have no
    business seeing a card number, and this application never holds one.
    """
    job_seeker = aliased_user()
    counsellor = aliased_user()
    rows = db.execute(
        select(Order, Booking, Service, job_seeker, counsellor)
        .join(Service, Service.id == Order.service_id)
        .join(job_seeker, job_seeker.id == Order.job_seeker_id)
        .join(counsellor, counsellor.id == Service.counsellor_id)
        .outerjoin(Booking, Booking.order_id == Order.id)
        .order_by(Order.created_at.desc())
        .limit(limit)
    ).all()

    return [
        PaymentOversightOut(
            # The PaymentIntent id when Stripe took the money; otherwise the order's
            # own id, so a stub-paid order still has something to quote.
            payment_id=order.payment_intent_id or order.id,
            order_id=order.id,
            booking_id=booking.id if booking is not None else None,
            job_seeker_name=seeker_row.name,
            counsellor_name=counsellor_row.name,
            service_title=service.title,
            amount_minor=order.amount_minor,
            platform_fee_minor=order.platform_fee_minor,
            counsellor_payout_minor=order.counsellor_payout_minor,
            refunded_minor=booking.refunded_minor if booking is not None else 0,
            currency=order.currency,
            payment_status=order.payment_status,
            order_status=order.status,
            created_at=order.created_at,
        )
        for order, booking, service, seeker_row, counsellor_row in rows
    ]


# --- the dashboard ----------------------------------------------------------


@router.get(
    "/admin/stats", response_model=AdminStatsOut, operation_id="getPlatformStats",
    openapi_extra={
        "x-required-role": "platform_owner", "x-requirement-ids": ["US-48", "US-58"],
    },
)
def get_platform_stats(
    _owner: User = Depends(require_platform_owner),
    db: Session = Depends(get_db),
) -> AdminStatsOut:
    """Counts and money totals, all read from columns rather than recomputed."""
    def count(*where) -> int:
        return db.scalar(select(func.count()).select_from(User).where(*where)) or 0

    bookings_by_status = {
        row.status: row.total
        for row in db.execute(
            select(Booking.status, func.count().label("total")).group_by(Booking.status)
        )
    }

    settled = select(Order).where(Order.status.in_(SETTLED_ORDER_STATUSES)).subquery()
    totals = db.execute(
        select(
            func.coalesce(func.sum(settled.c.amount_minor), 0),
            func.coalesce(func.sum(settled.c.platform_fee_minor), 0),
            func.coalesce(func.sum(settled.c.platform_fee_gst_minor), 0),
            func.coalesce(func.sum(settled.c.session_gst_minor), 0),
            func.coalesce(func.sum(settled.c.counsellor_payout_minor), 0),
        )
    ).one()
    refunded = db.scalar(
        select(func.coalesce(func.sum(Booking.refunded_minor), 0))
    ) or 0

    return AdminStatsOut(
        job_seekers=count(User.role == "job_seeker"),
        counsellors=count(User.role == "counsellor"),
        counsellors_pending_verification=count(
            User.role == "counsellor", User.verification_status == "pending",
        ),
        # Verified but unable to be paid: they can list nothing anyone can book, so
        # this is the queue that quietly costs the platform bookings.
        counsellors_awaiting_payouts=count(
            User.role == "counsellor",
            User.verification_status == "verified",
            User.payouts_enabled.is_(False),
        ),
        services_active=db.scalar(
            select(func.count()).select_from(Service).where(Service.active.is_(True))
        ) or 0,
        bookings_by_status=bookings_by_status,
        orders_awaiting_payment=db.scalar(
            select(func.count()).select_from(Order).where(Order.status == "awaiting_payment")
        ) or 0,
        money=AdminMoneyOut(
            gross_minor=int(totals[0]),
            platform_fee_minor=int(totals[1]),
            platform_fee_gst_minor=int(totals[2]),
            session_gst_minor=int(totals[3]),
            counsellor_payout_minor=int(totals[4]),
            refunded_minor=int(refunded),
        ),
    )


@router.get(
    "/admin/bookings", response_model=list[AdminBookingOut], operation_id="listAllBookings",
    openapi_extra={"x-required-role": "platform_owner", "x-requirement-ids": ["US-48"]},
)
def list_all_bookings(
    limit: int = Query(200, ge=1, le=1000),
    _owner: User = Depends(require_platform_owner),
    db: Session = Depends(get_db),
) -> list[AdminBookingOut]:
    """Every booking on the platform, named on both sides, soonest sessions first."""
    job_seeker = aliased_user()
    counsellor = aliased_user()
    rows = db.execute(
        select(Booking, Service, Order, job_seeker, counsellor)
        .join(Service, Service.id == Booking.service_id)
        .join(Order, Order.id == Booking.order_id)
        .join(job_seeker, job_seeker.id == Booking.job_seeker_id)
        .join(counsellor, counsellor.id == Booking.counsellor_id)
        .order_by(Booking.starts_at.desc())
        .limit(limit)
    ).all()

    return [
        AdminBookingOut(
            id=booking.id,
            service_title=service.title,
            job_seeker_name=seeker_row.name,
            counsellor_name=counsellor_row.name,
            starts_at=booking.starts_at,
            timezone=booking.timezone,
            modality=booking.modality,
            status=booking.status,
            payment_status=booking.payment_status,
            amount_minor=order.amount_minor,
            refunded_minor=booking.refunded_minor,
        )
        for booking, service, order, seeker_row, counsellor_row in rows
    ]


@router.get(
    "/admin/counsellors", response_model=list[AdminCounsellorOut],
    operation_id="listAllCounsellors",
    openapi_extra={
        "x-required-role": "platform_owner", "x-requirement-ids": ["US-48", "US-58"],
    },
)
def list_all_counsellors(
    _owner: User = Depends(require_platform_owner),
    db: Session = Depends(get_db),
) -> list[AdminCounsellorOut]:
    """Every counsellor with what they have sold and what they are owed."""
    services = (
        select(Service.counsellor_id, func.count().label("total"))
        .group_by(Service.counsellor_id)
        .subquery()
    )
    trade = (
        select(
            Booking.counsellor_id,
            func.count().label("bookings"),
            func.coalesce(func.sum(Order.amount_minor), 0).label("gross"),
            func.coalesce(func.sum(Order.counsellor_payout_minor), 0).label("payout"),
        )
        .join(Order, Order.id == Booking.order_id)
        .group_by(Booking.counsellor_id)
        .subquery()
    )
    rows = db.execute(
        select(User, services.c.total, trade.c.bookings, trade.c.gross, trade.c.payout)
        .outerjoin(services, services.c.counsellor_id == User.id)
        .outerjoin(trade, trade.c.counsellor_id == User.id)
        .where(User.role == "counsellor")
        .order_by(User.created_at.desc())
    ).all()

    return [
        AdminCounsellorOut(
            id=user.id,
            name=user.name,
            email=user.email,
            email_verified=user.email_verified_at is not None,
            verification_status=user.verification_status,
            submitted_at=user.verification_submitted_at,
            payouts_enabled=user.payouts_enabled,
            charges_enabled=user.charges_enabled,
            service_count=int(service_count or 0),
            booking_count=int(booking_count or 0),
            gross_minor=int(gross or 0),
            payout_minor=int(payout or 0),
            joined_at=user.created_at,
        )
        for user, service_count, booking_count, gross, payout in rows
    ]


# --- US-31 / US-32: the counsellor's side of the same thing -----------------


@router.post(
    "/me/verification-submissions", status_code=status.HTTP_201_CREATED,
    response_model=VerificationSubmissionOut, operation_id="submitVerification",
    openapi_extra={
        "x-required-role": "counsellor", "x-requirement-ids": ["US-31", "US-32"],
    },
)
def submit_verification(
    payload: SubmitVerificationRequest,
    user: User = Depends(require_counsellor),
    db: Session = Depends(get_db),
) -> VerificationSubmissionOut:
    """US-31, US-32. Put yourself in the queue, or go back into it after a rejection.

    Resubmitting after a rejection clears the decision: leaving the old reason in
    place would show the counsellor a rejection for work they have already redone.
    """
    if user.verification_status == "verified":
        raise ApiError(
            status.HTTP_409_CONFLICT,
            "INVALID_STATE_TRANSITION",
            "Your account is already verified.",
        )

    user.linkedin_url = payload.linked_in_url.strip()
    user.verification_status = "pending"
    user.verification_submitted_at = datetime.now(UTC)
    user.verification_decided_at = None
    user.verification_decision_reason = None
    result = _submission_out(user)
    db.commit()
    return result
