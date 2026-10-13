from datetime import date, datetime
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator
from pydantic.alias_generators import to_camel

Role = Literal["job_seeker", "counsellor", "platform_owner"]
ProfileVisibility = Literal["public", "partial", "restricted"]
Modality = Literal["online", "in_person"]
# Payment vocabulary (payments spec §5). An order is the spec's pending_payment
# booking; a Booking row exists only once Stripe has confirmed the payment.
PaymentProvider = Literal["stripe", "stub"]
OrderStatus = Literal["awaiting_payment", "confirmed", "cancelled", "refunded_slot_taken"]
BookingStatus = Literal["confirmed", "completed", "paid_out", "cancelled", "refunded"]
PaymentStatus = Literal[
    "not_started", "paid", "failed", "refunded", "partially_refunded",
]


class CamelModel(BaseModel):
    """Wire format is camelCase; Python stays snake_case. ORM objects validate directly."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


# --- requests -------------------------------------------------------------

class RegisterRequest(CamelModel):
    """The public registration form; additional fields are not accepted."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [{
                "name": "Alex Morgan",
                "email": "alex@example.com",
                "password": "example-password",
                "passwordConfirmation": "example-password",
                "role": "job_seeker",
            }],
        },
    )

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    email: EmailStr
    password: str = Field(
        min_length=8,
        repr=False,
        description="At least eight characters; whitespace is preserved.",
        json_schema_extra={"format": "password", "writeOnly": True},
    )
    password_confirmation: str = Field(
        min_length=8,
        repr=False,
        description="Must exactly match password, including whitespace.",
        json_schema_extra={"format": "password", "writeOnly": True},
    )
    role: Literal["job_seeker", "counsellor"]


RefreshClient = Literal["web", "native"]


class LoginRequest(CamelModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(
        min_length=1, repr=False,
        json_schema_extra={"format": "password", "writeOnly": True},
    )
    #: Where the session will be stored, which decides how long its refresh token
    #: lives. Defaults to the shorter, browser-grade window when unstated.
    client: RefreshClient = "web"


class LogoutRequest(CamelModel):
    """Optional body naming the refresh token to kill alongside the access token.

    Optional so an older client that sends nothing still logs out of its access
    token; without the refresh token, though, the session can simply be minted
    again, so a current client always sends it.
    """

    model_config = ConfigDict(extra="forbid")

    refresh_token: str | None = Field(default=None, max_length=512, repr=False)


class VerifyEmailRequest(CamelModel):
    """The single-use token from the confirmation link."""

    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=512, repr=False)


class EmailRequest(CamelModel):
    """An email address alone — used to ask for a new verification or reset link.

    Both endpoints answer the same way whether or not the address has an account, so
    neither can be used to find out who is registered.
    """

    model_config = ConfigDict(extra="forbid")

    email: EmailStr


class PasswordResetRequest(CamelModel):
    """A reset link plus the new password. Confirmation is required here for the same
    reason as at registration: a typo would otherwise lock the account."""

    model_config = ConfigDict(extra="forbid")

    token: str = Field(min_length=1, max_length=512, repr=False)
    password: str = Field(
        min_length=8, repr=False, json_schema_extra={"format": "password", "writeOnly": True},
    )
    password_confirmation: str = Field(
        min_length=8, repr=False, json_schema_extra={"format": "password", "writeOnly": True},
    )


class RefreshSessionRequest(CamelModel):
    """The credential the refresh endpoint runs on. It takes no bearer token: the
    access token has usually expired by the time this is called, which is the point."""

    model_config = ConfigDict(extra="forbid")

    refresh_token: str = Field(min_length=1, max_length=512, repr=False)
    client: RefreshClient = "web"


# --- responses -----------------------------------------------------------

class RegistrationErrorOut(CamelModel):
    """Public error envelope returned by the registration endpoint."""

    code: Literal["VALIDATION_ERROR"]
    message: str
    field_errors: dict[str, str] | None = None
    request_id: str


class AuthenticationErrorOut(CamelModel):
    """Shared login/logout validation and unauthenticated response contract."""

    code: Literal["VALIDATION_ERROR", "INVALID_CREDENTIALS", "AUTHENTICATION_REQUIRED"]
    message: str
    field_errors: dict[str, str] | None = None
    request_id: str


class UserOut(CamelModel):
    id: str
    name: str
    email: EmailStr
    role: Role
    #: False until the address is confirmed. The app shows a banner and gates booking
    #: and publishing on it, rather than refusing the sign-in outright. Required, not
    #: defaulted: the server always knows the answer, and a client that treated a
    #: missing field as "verified" would silently drop the gate.
    email_verified: bool


class SessionOut(CamelModel):
    access_token: str
    expires_at: datetime
    user: UserOut
    #: Exchanged at /auth/sessions/refresh for a new session. Returned once, on the
    #: response that creates it, and never readable again.
    refresh_token: str | None = Field(default=None, repr=False)
    #: When the sliding window closes if the session is never used again.
    refresh_expires_at: datetime | None = None


class CounsellorSummary(CamelModel):
    id: str
    display_name: str
    introduction: str | None = None
    verification_status: Literal["pending", "verified", "rejected"]
    overall_rating: float | None = None
    review_count: int


class CounsellorProfileOut(CamelModel):
    """US-30. The professional profile a counsellor maintains and the Marketplace shows."""

    id: str
    display_name: str
    photo_url: str | None = None
    #: US-31 — what the Platform Owner verifies them from.
    linkedin_url: str = ""
    introduction: str = ""
    background: str = ""
    experience: str = ""
    qualifications: list[str] = []
    expertise: list[str] = []
    languages: list[str] = []
    base_location: "Location | None" = None
    default_modality: Modality = "online"
    verification_status: Literal["pending", "verified", "rejected"]
    overall_rating: float | None = None
    review_count: int
    visibility: ProfileVisibility | None = None
    restricted: bool | None = None


class PrivacySettingsOut(CamelModel):
    visibility: ProfileVisibility


class UpdateProfileVisibilityRequest(CamelModel):
    model_config = ConfigDict(extra="forbid")

    visibility: ProfileVisibility


class OnboardingStateOut(CamelModel):
    """US-05. Whether a Career Professional has cleared first-login onboarding.

    Two checks, not one, because the app lists them separately: `profileComplete`
    mirrors what `update_own_counsellor_profile` already requires before it accepts
    a save (a LinkedIn URL plus an introduction, background and experience), and
    `verificationSubmitted` mirrors `verificationState()` on the frontend — a
    LinkedIn URL on file is a submission, whatever the Platform Owner has since
    decided about it. `complete` is both, so the app has one flag to route on
    without re-deriving the rule client-side.
    """

    profile_complete: bool
    verification_submitted: bool
    complete: bool


#: One qualification, skill or language on a Career Professional's profile.
ProfileItem = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=160)]


class UpdateCounsellorProfileRequest(CamelModel):
    """US-30, US-31. The whole profile, as the form submits it."""

    model_config = ConfigDict(extra="forbid")

    photo_url: str | None = Field(default=None, max_length=2000)
    linkedin_url: str = Field(min_length=1, max_length=2000)
    introduction: str = Field(default="", max_length=5000)
    background: str = Field(default="", max_length=5000)
    experience: str = Field(default="", max_length=5000)
    qualifications: list[ProfileItem] = Field(default=[], max_length=20)
    expertise: list[ProfileItem] = Field(default=[], max_length=20)
    languages: list[ProfileItem] = Field(default=[], max_length=20)
    base_location: "Location | None" = None
    default_modality: Modality = "online"


class Location(CamelModel):
    state: str
    city_or_region: str


class JobSeekerProfileOut(CamelModel):
    """The job seeker's own profile: who they are and what they want help with."""

    name: str
    email: EmailStr
    photo_url: str | None = None
    headline: str = ""
    career_goals: str = ""


#: A job seeker's photo travels and is stored as a data URI, because the backend has
#: no file storage and the database is what every deployment keeps. Raster types
#: only: an SVG can carry script. About 1.5 MB of image once decoded.
PhotoDataUri = Annotated[str, StringConstraints(
    max_length=2_000_000, pattern=r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$",
)]


class UpdateJobSeekerProfileRequest(CamelModel):
    """The whole profile, as the form submits it. A null photo removes it."""

    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    photo_url: PhotoDataUri | None = None
    headline: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""
    career_goals: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""


class CreateServiceRequest(CamelModel):
    """US-34, US-35, US-37, US-38. Field-level rules live here; the "in-person needs
    a location" rule is cross-field and enforced in the router."""

    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=5000)
    price_minor: int = Field(ge=0)
    #: Bookable in 15-minute steps, which is the granularity the calendar offers.
    duration_minutes: int = Field(default=60, ge=15, le=480, multiple_of=15)
    currency: Literal["AUD"]
    modalities: list[Modality] = Field(min_length=1)
    location: Location | None = None
    #: Optional room of the counsellor's own — a standing Zoom or Google Meet link.
    #: Left empty, each booking gets a freshly named room generated for it.
    meeting_url: str | None = Field(default=None, max_length=2000)

    @field_validator("title", "description", mode="before")
    @classmethod
    def _trim_text(cls, value: object) -> object:
        # Trim first so a whitespace-only value fails the min_length rule.
        return value.strip() if isinstance(value, str) else value

    @field_validator("modalities")
    @classmethod
    def _reject_duplicate_modalities(cls, value: list[str]) -> list[str]:
        if len(value) != len(set(value)):
            raise ValueError("List the same modality only once.")
        return value


class ServiceOut(CamelModel):
    id: str
    counsellor: CounsellorSummary
    title: str
    description: str
    price_minor: int
    duration_minutes: int
    currency: Literal["AUD"]
    modalities: list[Modality]
    location: Location | None = None
    active: bool
    average_rating: float | None = None
    review_count: int


class OwnServiceOut(ServiceOut):
    """The counsellor's own view of a service they own.

    Separate from `ServiceOut` because of one field: a meeting room URL is an access
    credential, not a description. Anyone holding it can walk into the session, so it
    must not travel with the public marketplace listing.
    """

    meeting_url: str | None = None


class CreateAvailabilityWindowRequest(CamelModel):
    """US-39. Declare a stretch of time the counsellor is available.

    No service: a window is the counsellor's own time, and any service they offer can
    be booked inside it. `modalities` narrows how they can deliver during it — being
    in the office only on certain days is a normal way to work.
    """

    starts_at: datetime
    ends_at: datetime
    modalities: list[Modality] = Field(default_factory=lambda: ["online", "in_person"],
                                       min_length=1)


class UpdateAvailabilityWindowRequest(CamelModel):
    """US-39. Move a window's boundaries or change how it may be delivered."""

    starts_at: datetime | None = None
    ends_at: datetime | None = None
    modalities: list[Modality] | None = Field(default=None, min_length=1)


class AvailabilityWindowOut(CamelModel):
    id: str
    starts_at: datetime
    ends_at: datetime
    #: How the counsellor can deliver during this window.
    modalities: list[Modality] = Field(default_factory=lambda: ["online", "in_person"])
    #: True once any part of the window has been booked, so the screen can show that
    #: shortening it would strand a session rather than silently refusing the edit.
    has_bookings: bool = False


class BookableStartOut(CamelModel):
    """One time at which a particular service can be booked.

    Derived per request from the counsellor's windows, this service's duration and
    what is already taken — not a stored row. Two services sharing an hour each get
    their own answer, and booking either one changes both.
    """

    starts_at: datetime
    ends_at: datetime


class CreateOrderRequest(CamelModel):
    service_id: str
    #: The chosen start. Its end follows from the service's duration, so the client
    #: never gets to decide how long it is buying.
    starts_at: datetime
    modality: Modality
    timezone: str = Field(min_length=1, max_length=100)
    #: US-42 — optional. What the job seeker wants to cover, shown to the
    #: counsellor so they can prepare; never required to complete a booking.
    pre_session_brief: str | None = Field(default=None, max_length=500)


class BookingAmountsOut(CamelModel):
    """The commission and GST split, frozen when the order was created (spec §6).

    Shown to the counsellor so they can see what they will be paid. A job seeker
    only ever pays `totalMinor`; the rest is between the platform and the counsellor.
    """

    total_minor: int
    session_gst_minor: int
    platform_fee_minor: int
    platform_fee_gst_minor: int
    counsellor_payout_minor: int


class OrderOut(CamelModel):
    id: str
    service_id: str
    window_id: str
    starts_at: datetime
    ends_at: datetime
    amount_minor: int
    currency: Literal["AUD"]
    status: OrderStatus
    payment_status: PaymentStatus
    #: When the slot hold lapses; the app counts down to this rather than guessing.
    hold_expires_at: datetime | None = None
    amounts: BookingAmountsOut | None = None
    #: "stripe" once STRIPE_SECRET_KEY is set, otherwise the development stub.
    payment_provider: PaymentProvider = "stub"
    #: Stripe client secret for PaymentSheet. Null on the stub. Never a secret key:
    #: a client secret authorises exactly this one payment and nothing else.
    payment_intent_client_secret: str | None = None


class BookingOut(CamelModel):
    id: str
    order_id: str
    service_id: str
    service_title: str
    starts_at: datetime
    ends_at: datetime
    timezone: str
    modality: Modality
    status: BookingStatus
    payment_status: PaymentStatus
    amount_minor: int = 0
    refunded_minor: int = 0
    cancelled_by_role: Role | None = None
    #: Where an online session happens. Null for an in-person booking, which shows
    #: the service's meeting area instead. Only the two parties ever see this.
    meeting_url: str | None = None
    #: The other person, from the caller's side of the booking: a job seeker sees the
    #: counsellor and vice versa. A list of sessions that does not say who they are
    #: with is not a list anyone can act on.
    counterparty_name: str = ""
    counterparty_role: Role | None = None
    #: Where an in-person session happens, as the service advertises it.
    meeting_area: str = ""
    #: US-43 — the specific meeting point for this booking, set by the counsellor
    #: after confirmation. Empty until they add one.
    meeting_address: str = ""
    #: US-42 — what the job seeker asked to cover, frozen from the order at booking
    #: time. Empty when none was given.
    pre_session_brief: str = ""


class UpdateMeetingAddressRequest(CamelModel):
    """US-43 — the counsellor's own words for where to meet, for one booking."""

    meeting_address: str | None = Field(default=None, max_length=300)


class StubPaymentConfirmation(CamelModel):
    payment_id: str
    payment_status: Literal["paid"]
    booking: BookingOut


class PaymentIntentOut(CamelModel):
    """What PaymentSheet needs to collect one payment (spec §7).

    `clientSecret` authorises this single PaymentIntent and nothing else; it is not
    an API key and carries no ability to read or charge anything other than this
    payment. It is returned once, to the job seeker who owns the order.
    """

    payment_intent_id: str
    client_secret: str
    status: str


class OrderStatusOut(CamelModel):
    """What the app polls after PaymentSheet closes (spec §12).

    The client never decides that a payment worked — Stripe tells the backend over
    a webhook, and the app reads the result here. `booking` appears once that has
    happened, so one response carries both "is it done" and everything the
    confirmation screen shows.
    """

    order: OrderOut
    booking: BookingOut | None = None


class WebhookAck(CamelModel):
    """Stripe only reads the status code; this keeps the body a documented shape."""

    received: bool


class PaymentConfigOut(CamelModel):
    """Public payment settings the app reads at startup.

    The publishable key belongs in a response rather than the app bundle so that
    rotating a key or moving between test and live is a backend change only.
    """

    provider: PaymentProvider
    publishable_key: str | None = None
    merchant_display_name: str
    merchant_country_code: Literal["AU"] = "AU"
    currency: Literal["AUD"] = "AUD"
    slot_hold_minutes: int
    cancellation_full_refund_hours: int
    cancellation_late_refund_percent: int


class CancelBookingRequest(CamelModel):
    reason: str | None = Field(default=None, max_length=500)


class CancelBookingOut(CamelModel):
    booking: BookingOut
    refunded_minor: int
    currency: Literal["AUD"]


class RescheduleBookingRequest(CamelModel):
    """US-69 — move a confirmed booking to another open slot on the same order.

    Shaped like `CreateOrderRequest`'s time fields rather than carrying a slot id:
    availability is derived, not stored, so there is no persisted slot row to name.
    """

    #: The new start. Its end follows from the service's duration, the same as
    #: creating an order — the client does not get to decide how long it is buying.
    starts_at: datetime
    modality: Modality
    timezone: str = Field(min_length=1, max_length=100)


class StripeOnboardingRequest(CamelModel):
    """Where the app wants the counsellor returned once Stripe is done with them.

    Honoured only for this app's own deep link or an origin the server serves the
    web build from; anything else silently falls back to the deep link.
    """

    model_config = ConfigDict(extra="forbid")

    return_to: str | None = Field(default=None, max_length=2000)


class StripeOnboardingOut(CamelModel):
    """A fresh Account Link. Single-use and expires in minutes, so never cached."""

    url: str
    account_id: str


class PayoutStatusOut(CamelModel):
    stripe_account_id: str | None = None
    charges_enabled: bool
    payouts_enabled: bool
    #: True until Stripe reports payouts_enabled; the app prompts to finish setup.
    onboarding_required: bool
    abn: str | None = None
    gst_registered: bool


class TaxDetailsRequest(CamelModel):
    """US/spec §12 — the ABN and GST answers a counsellor gives for their receipts."""

    model_config = ConfigDict(extra="forbid")

    abn: str | None = None
    gst_registered: bool
    legal_name: str | None = Field(default=None, max_length=200)

    @field_validator("abn", mode="before")
    @classmethod
    def _normalise_abn(cls, value: object) -> object:
        """ABNs are written with spaces ("12 345 678 901"); store the digits."""
        if not isinstance(value, str):
            return value
        digits = value.replace(" ", "").strip()
        if not digits:
            return None
        if not (digits.isdigit() and len(digits) == 11):
            raise ValueError("An ABN is 11 digits.")
        return digits


class ReceiptOut(CamelModel):
    """The job seeker's receipt, issued in the counsellor's name (spec §11)."""

    receipt_number: str
    issued_at: datetime
    #: True only when the counsellor was GST-registered at the time of booking.
    is_tax_invoice: bool
    supplier_name: str
    supplier_abn: str | None = None
    buyer_name: str
    description: str
    session_starts_at: datetime
    total_minor: int
    gst_minor: int
    currency: str
    text: str


class CommissionStatementLineOut(CamelModel):
    booking_id: str
    session_starts_at: datetime
    description: str
    session_total_minor: int
    commission_minor: int
    commission_gst_minor: int
    payout_minor: int


class CommissionStatementOut(CamelModel):
    """The platform's monthly invoice to a counsellor for commission (spec §11)."""

    counsellor_name: str
    counsellor_abn: str | None = None
    platform_name: str
    platform_abn: str | None = None
    platform_gst_registered: bool
    period_start: date
    period_end: date
    lines: list[CommissionStatementLineOut]
    commission_total_minor: int
    commission_gst_total_minor: int
    payout_total_minor: int
    text: str


# --- administration (US-32, US-48, US-58) ----------------------------------


class VerificationSubmissionOut(CamelModel):
    """A counsellor awaiting, or having received, a decision on who they are.

    There is no submissions table and none is needed: the counsellor profile *is*
    the submission. A second row recording the same thing would eventually disagree
    with the profile about whether someone is verified.
    """

    id: str
    counsellor_id: str
    counsellor_name: str
    email: str
    linked_in_url: str
    introduction: str = ""
    background: str = ""
    experience: str = ""
    status: Literal["pending", "verified", "rejected"]
    submitted_at: datetime
    decided_at: datetime | None = None
    decision_reason: str | None = None


class VerificationDecisionRequest(CamelModel):
    """US-58's initial call, and US-33's re-decision after an additional manual
    investigation — the same shape either way, since reopening a verified or
    rejected submission back to pending is itself a decision worth recording."""

    model_config = ConfigDict(extra="forbid")

    decision: Literal["pending", "verified", "rejected"]
    #: Told to the counsellor, so a rejection is something they can act on rather
    #: than a dead end. Required for a rejection; the router enforces that.
    reason: str = Field(default="", max_length=1000)


def _require_linkedin_profile_url(value: object) -> str:
    """A safe https linkedin.com profile URL, normalised — never the raw input.

    Checking only the host (as this once did) lets a scheme ride along past it:
    `javascript://linkedin.com/...` and `ftp://linkedin.com/...` both parse a
    linkedin.com host, but are not links a browser should ever be handed. The
    app later passes the stored value to `Linking.openURL`, which on Web
    assigns it to `window.location`, so only `https` may reach that boundary.

    A backslash is rejected outright rather than parsed: Python's `urlsplit`
    does not treat it as a delimiter, but a browser's WHATWG URL parser does —
    early, and as equivalent to a forward slash — so the two can disagree on
    which host a URL names. `https://evil.example\\@linkedin.com/...` is one
    such string: this module's `.hostname` reports `linkedin.com`, a browser
    opens `evil.example`. Credentials are rejected too, on the same principle:
    a profile link legitimately has none, so the userinfo component is pure
    attack surface with no cost to removing it.
    """
    if not isinstance(value, str) or not value.strip():
        raise ValueError("Enter your LinkedIn profile URL.")
    raw = value.strip()
    if "\\" in raw:
        raise ValueError("Must be a linkedin.com profile URL.")
    if "://" in raw:
        scheme, _, _rest = raw.partition("://")
        if scheme.lower() != "https":
            raise ValueError("Must be a linkedin.com profile URL.")
        normalised = raw
    else:
        normalised = f"https://{raw}"
    parsed = urlsplit(normalised)
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Must be a linkedin.com profile URL.")
    host = (parsed.hostname or "").lower()
    if host != "linkedin.com" and not host.endswith(".linkedin.com"):
        raise ValueError("Must be a linkedin.com profile URL.")
    return normalised


class SubmitVerificationRequest(CamelModel):
    model_config = ConfigDict(extra="forbid")

    linked_in_url: str = Field(min_length=1, max_length=2000)

    @field_validator("linked_in_url", mode="before")
    @classmethod
    def _validate_linkedin_url(cls, value: object) -> object:
        # US-31 AC: a non-LinkedIn URL is rejected server-side, not just by the app.
        return _require_linkedin_profile_url(value)


class PaymentOversightOut(CamelModel):
    """An order's money, for the Platform Owner — and deliberately no card details.

    Nothing here comes from Stripe: it is the frozen breakdown stored on the order,
    so this view can never disagree with the receipt the job seeker was issued.
    """

    payment_id: str
    order_id: str
    booking_id: str | None = None
    job_seeker_name: str
    counsellor_name: str
    service_title: str
    amount_minor: int
    platform_fee_minor: int
    counsellor_payout_minor: int
    refunded_minor: int = 0
    currency: str
    payment_status: PaymentStatus
    order_status: OrderStatus
    created_at: datetime


class AdminBookingOut(CamelModel):
    """Every booking on the platform, named on both sides."""

    id: str
    service_title: str
    job_seeker_name: str
    counsellor_name: str
    starts_at: datetime
    timezone: str
    modality: Modality
    status: BookingStatus
    payment_status: PaymentStatus
    amount_minor: int
    refunded_minor: int


class AdminCounsellorOut(CamelModel):
    id: str
    name: str
    email: str
    email_verified: bool
    verification_status: Literal["pending", "verified", "rejected"]
    submitted_at: datetime | None = None
    #: Stripe onboarding. A counsellor who cannot be paid cannot be booked, so this
    #: is the other half of "ready to trade" alongside verification.
    payouts_enabled: bool
    charges_enabled: bool
    service_count: int
    booking_count: int
    gross_minor: int
    payout_minor: int
    joined_at: datetime


class AdminJobSeekerOut(CamelModel):
    id: str
    name: str
    email: str
    email_verified: bool
    booking_count: int
    joined_at: datetime


class AdminMoneyOut(CamelModel):
    """Totals read from the frozen per-order breakdown, never recalculated.

    Recalculating would let this dashboard drift from the receipts already issued —
    a fee percentage changed in configuration would silently restate history.
    """

    gross_minor: int
    platform_fee_minor: int
    platform_fee_gst_minor: int
    session_gst_minor: int
    counsellor_payout_minor: int
    refunded_minor: int
    currency: str = "AUD"


class AdminStatsOut(CamelModel):
    job_seekers: int
    counsellors: int
    counsellors_pending_verification: int
    counsellors_awaiting_payouts: int
    services_active: int
    bookings_by_status: dict[str, int]
    orders_awaiting_payment: int
    money: AdminMoneyOut


# Location is declared after the profile models that reference it.
CounsellorProfileOut.model_rebuild()
UpdateCounsellorProfileRequest.model_rebuild()
