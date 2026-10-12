import uuid
from datetime import UTC, date, datetime

from sqlalchemy import JSON, Boolean, Date, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base, UtcDateTime


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


class User(Base):
    """Accounts plus both role profiles in one wide table, per database-schema.md."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    # role: job_seeker | counsellor | platform_owner
    role: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)
    # Null until the address is confirmed. A timestamp rather than a flag, because
    # "when did they confirm" is the question that actually gets asked later.
    email_verified_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    # Access tokens issued before this moment are refused. Revoking refresh tokens
    # alone would still leave an attacker up to an hour of access after a password
    # reset, and an hour is exactly when it matters most.
    sessions_invalidated_at: Mapped[datetime | None] = mapped_column(
        UtcDateTime, nullable=True,
    )

    # Any role's profile photo: a counsellor's URL, or a job seeker's image stored
    # inline as a data URI (there is no file storage to hold an upload).
    photo_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # US-27/US-28: applies to both member roles. Public profile serializers must
    # enforce this server-side so a client cannot recover fields merely by calling
    # the API directly.
    profile_visibility: Mapped[str] = mapped_column(
        String, default="public", nullable=False,
    )

    # Job-seeker-only profile fields (left null for other roles).
    headline: Mapped[str | None] = mapped_column(String, nullable=True)
    career_goals: Mapped[str | None] = mapped_column(String, nullable=True)

    # Counsellor-only profile fields (left null for other roles).
    introduction: Mapped[str | None] = mapped_column(String, nullable=True)
    # US-30/US-31: the professional profile a counsellor maintains, and the LinkedIn
    # URL the Platform Owner verifies them from.
    linkedin_url: Mapped[str | None] = mapped_column(String, nullable=True)
    background: Mapped[str | None] = mapped_column(String, nullable=True)
    experience: Mapped[str | None] = mapped_column(String, nullable=True)
    # US-30: what a Job Seeker weighs up before booking, each shown as a list.
    qualifications: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    expertise: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    languages: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    base_location_state: Mapped[str | None] = mapped_column(String, nullable=True)
    base_location_city: Mapped[str | None] = mapped_column(String, nullable=True)
    default_modality: Mapped[str] = mapped_column(String, default="online", nullable=False)
    # verification_status: pending | verified | rejected
    verification_status: Mapped[str] = mapped_column(String, default="pending")
    # US-31/US-58: the review trail. The profile itself is the submission — a separate
    # submissions table would give two answers to "is this counsellor verified".
    verification_submitted_at: Mapped[datetime | None] = mapped_column(
        UtcDateTime, nullable=True,
    )
    verification_decided_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    verification_decision_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    overall_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)

    # --- Counsellor payouts (payments spec §5). Null/false for other roles. ---
    stripe_account_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    # Mirrored from account.updated webhooks; never written from the app. Only a
    # counsellor with payouts_enabled may be listed or booked (spec §8).
    charges_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    payouts_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Australian Business Number, 11 digits, and whether they charge GST. Both are
    # snapshotted onto each order so receipts stay true to the day they were issued.
    abn: Mapped[str | None] = mapped_column(String(11), nullable=True)
    gst_registered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # Collected for the ATO Sharing Economy Reporting Regime (spec §5).
    legal_name: Mapped[str | None] = mapped_column(String, nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    address: Mapped[str | None] = mapped_column(String, nullable=True)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)

    services: Mapped[list["Service"]] = relationship(back_populates="counsellor")


class Diagnosis(Base):
    """US-09–11: one private, versioned answer record per Job Seeker.

    Progress is derived from explicitly saved answers, not supplied by the client.
    An empty multi-choice answer is different from a step not yet submitted.
    """

    __tablename__ = "diagnoses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    job_seeker_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), unique=True, nullable=False,
    )
    questionnaire_version: Mapped[str] = mapped_column(String(64), nullable=False)
    answers: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now, nullable=False)


class RevokedToken(Base):
    """US-08: durable revocation of a verified JWT, without storing the credential."""

    __tablename__ = "revoked_tokens"

    # Digest of the signature-bound header.payload, not raw signature text (which
    # can have equivalent base64url encodings). New JWT jti values separate logins.
    token_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(
        UtcDateTime, nullable=False, index=True,
    )
    revoked_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=_now, nullable=False,
    )


class Service(Base):
    __tablename__ = "services"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    counsellor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    price_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    # How long this session runs. Duration belongs to what is being sold, not to the
    # counsellor's calendar: one person offering a 30-minute review and a 90-minute
    # deep-dive is offering both out of the same working hours.
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    # A counsellor's own video room, used in place of the generated one when set.
    # Optional: most will never fill it in, and a generated room always works.
    meeting_url: Mapped[str | None] = mapped_column(String, nullable=True)
    currency: Mapped[str] = mapped_column(String, default="AUD")
    modalities: Mapped[list[str]] = mapped_column(JSON, default=list)
    location_state: Mapped[str | None] = mapped_column(String, nullable=True)
    location_city: Mapped[str | None] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    average_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    review_count: Mapped[int] = mapped_column(Integer, default=0)

    counsellor: Mapped[User] = relationship(back_populates="services")


class AvailabilityWindow(Base):
    """US-39/US-41 — a stretch of time the counsellor is available, for anything.

    Availability belongs to the person, not to one of their services. A counsellor is
    one human being with one calendar: a window of 9am-noon is three hours in which
    any service they offer can be booked, and booking one of them consumes that time
    for all of them.

    Nothing is pre-cut into sellable pieces. Bookable start times are derived from
    the window, the chosen service's duration and the times already taken, which is
    why two services can share an hour without the overlapping-row problem the old
    per-service slots had.
    """

    __tablename__ = "availability_windows"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    counsellor_id: Mapped[str] = mapped_column(
        ForeignKey("users.id"), nullable=False, index=True,
    )
    starts_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    # How the counsellor can deliver during this window. Being in the office on a
    # Tuesday and at home the rest of the week is a normal way to work, so a window
    # may permit only some of the ways they otherwise offer. It never widens what a
    # service supports — it narrows when that service can be booked.
    modalities: Mapped[list[str]] = mapped_column(
        JSON, default=lambda: ["online", "in_person"], nullable=False,
    )


class Order(Base):
    __tablename__ = "orders"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    job_seeker_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    service_id: Mapped[str] = mapped_column(ForeignKey("services.id"), nullable=False)
    window_id: Mapped[str] = mapped_column(
        ForeignKey("availability_windows.id"), nullable=False, index=True,
    )
    # The exact span this order holds. A hold is now the order itself — there is no
    # row to flag "held", so an unpaid order with a live hold_expires_at is what
    # makes a time unavailable to anybody else.
    starts_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    amount_minor: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String, nullable=False, default="AUD")
    timezone: Mapped[str] = mapped_column(String, nullable=False)
    modality: Mapped[str] = mapped_column(String, nullable=False)
    # US-42 — what the job seeker wants to cover, collected before payment so the
    # counsellor can prepare. Optional; never edited after the order is placed, so a
    # booking list reads the same note the counsellor originally saw.
    pre_session_brief: Mapped[str | None] = mapped_column(String, nullable=True)
    # awaiting_payment | confirmed | cancelled | refunded_slot_taken
    status: Mapped[str] = mapped_column(String, nullable=False, default="awaiting_payment")
    # not_started | paid | failed | refunded | partially_refunded
    payment_status: Mapped[str] = mapped_column(String, nullable=False, default="not_started")
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)

    # --- Payment (payments spec §5) -------------------------------------
    # When the slot hold lapses. The release job cancels the PaymentIntent and
    # frees the slot; a payment that lands after this is refunded (spec §8).
    hold_expires_at: Mapped[datetime | None] = mapped_column(
        UtcDateTime, nullable=True, index=True,
    )
    payment_intent_id: Mapped[str | None] = mapped_column(
        String, nullable=True, unique=True, index=True,
    )

    # Amount breakdown, frozen at booking time and never recalculated. amount_minor
    # above is the spec's total_cents — what the job seeker pays.
    session_gst_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    platform_fee_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    platform_fee_gst_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    counsellor_payout_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Snapshots of the counsellor's tax status, so a receipt reprinted next year
    # still shows what was true when the job seeker paid.
    counsellor_gst_registered_at_booking: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False,
    )
    counsellor_abn_at_booking: Mapped[str | None] = mapped_column(String(11), nullable=True)


class Booking(Base):
    __tablename__ = "bookings"
    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), unique=True, nullable=False)
    service_id: Mapped[str] = mapped_column(ForeignKey("services.id"), nullable=False)
    window_id: Mapped[str] = mapped_column(
        ForeignKey("availability_windows.id"), nullable=False, index=True,
    )
    job_seeker_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    counsellor_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    starts_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    ends_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    timezone: Mapped[str] = mapped_column(String, nullable=False)
    modality: Mapped[str] = mapped_column(String, nullable=False)
    # confirmed | completed | paid_out | cancelled | refunded
    status: Mapped[str] = mapped_column(String, nullable=False, default="confirmed")
    # paid | refunded | partially_refunded
    payment_status: Mapped[str] = mapped_column(String, nullable=False, default="paid")
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)

    # --- Payout and refunds (payments spec §9, §10) ----------------------
    # Set once, by the payout job. Its presence is what stops a second Transfer.
    transfer_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    completed_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    paid_out_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    refunded_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    transfer_reversed_minor: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cancelled_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    cancelled_by_role: Mapped[str | None] = mapped_column(String, nullable=True)
    # Where an online session happens. Stored rather than derived on read, so the
    # link in a confirmation email sent months ago still matches what the app shows.
    meeting_url: Mapped[str | None] = mapped_column(String, nullable=True)
    # US-43 — the specific in-person meeting point for this one booking, set by the
    # counsellor after confirmation. The service's own location (meeting_area) only
    # ever holds a state and city/region, never a street address.
    meeting_address: Mapped[str | None] = mapped_column(String, nullable=True)
    # Raised by charge.dispute.created; holds the payout back for admin review.
    flagged_for_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    review_reason: Mapped[str | None] = mapped_column(String, nullable=True)


class ProcessedWebhookEvent(Base):
    """Payments spec §8 — Stripe redelivers events, so each one is handled once.

    The event id is the primary key: a concurrent redelivery loses the insert race
    and is skipped rather than confirming a booking or issuing a refund twice.
    """

    __tablename__ = "processed_webhook_events"

    event_id: Mapped[str] = mapped_column(String, primary_key=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    processed_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now)


class RefreshToken(Base):
    """US-06 — one issued refresh token, so a session can slide without re-login.

    Only a digest is stored, never the token: a database leak must not hand over
    usable credentials, exactly as with passwords.

    `family_id` ties every token descended from one login together. Refreshing marks
    a token used and issues its successor, so a used token appearing again means a
    copy is circulating — someone has a stolen credential. There is no way to tell
    the thief from the victim, so the whole family is revoked and both must sign in
    again. That detection is what makes a ninety-day session defensible; without
    rotation a long-lived token is a password that never expires.
    """

    __tablename__ = "refresh_tokens"

    token_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    family_id: Mapped[str] = mapped_column(String, nullable=False, index=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # web | native — decides the lifetime, since the two store secrets differently.
    client: Mapped[str] = mapped_column(String, nullable=False, default="web")
    issued_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False, index=True)
    #: Set the moment it is exchanged. A second exchange is theft, not a retry.
    used_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)


class SingleUseToken(Base):
    """US-06/US-70 — one link that works once: confirm an address, or reset a password.

    Both are the same shape, so they share a table and are told apart by `purpose`,
    which is checked on use. Without that check a link mailed to confirm an address
    would also reset the password on that account, which is a privilege escalation
    dressed up as a convenience.

    Only a digest is stored, for the same reason as refresh tokens: a database leak
    must not hand over working links.
    """

    __tablename__ = "single_use_tokens"

    token_digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    # verify_email | reset_password
    purpose: Mapped[str] = mapped_column(String, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(UtcDateTime, default=_now, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False, index=True)
    used_at: Mapped[datetime | None] = mapped_column(UtcDateTime, nullable=True)
