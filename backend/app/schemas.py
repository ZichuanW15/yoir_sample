from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints, field_validator
from pydantic.alias_generators import to_camel

Role = Literal["job_seeker", "counsellor", "platform_owner"]
Modality = Literal["online", "in_person"]


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


class LoginRequest(CamelModel):
    model_config = ConfigDict(extra="forbid")

    email: EmailStr
    password: str = Field(
        min_length=1, repr=False,
        json_schema_extra={"format": "password", "writeOnly": True},
    )


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


class SessionOut(CamelModel):
    access_token: str
    expires_at: datetime
    user: UserOut


class CounsellorSummary(CamelModel):
    id: str
    display_name: str
    introduction: str | None = None
    verification_status: Literal["pending", "verified", "rejected"]
    overall_rating: float | None = None
    review_count: int


class Location(CamelModel):
    state: str
    city_or_region: str


class CreateServiceRequest(CamelModel):
    """US-34, US-35, US-37, US-38. Field-level rules live here; the "in-person needs
    a location" rule is cross-field and enforced in the router."""

    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=5000)
    price_minor: int = Field(ge=0)
    currency: Literal["AUD"]
    modalities: list[Modality] = Field(min_length=1)
    location: Location | None = None

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
    currency: Literal["AUD"]
    modalities: list[Modality]
    location: Location | None = None
    active: bool
    average_rating: float | None = None
    review_count: int


class CreateAvailabilitySlotRequest(CamelModel):
    """US-39. Add one bookable slot to a service the caller owns."""

    service_id: str = Field(min_length=1)
    starts_at: datetime
    ends_at: datetime


class UpdateAvailabilitySlotRequest(CamelModel):
    """US-39. Move a slot's boundaries; both ends optional, at least one required."""

    starts_at: datetime | None = None
    ends_at: datetime | None = None


class AvailabilitySlotOut(CamelModel):
    id: str
    service_id: str
    starts_at: datetime
    ends_at: datetime
    status: Literal["open", "held", "booked"]


class CreateOrderRequest(CamelModel):
    service_id: str
    slot_id: str
    modality: Modality
    timezone: str = Field(min_length=1, max_length=100)


class OrderOut(CamelModel):
    id: str
    service_id: str
    slot_id: str
    amount_minor: int
    currency: Literal["AUD"]
    status: Literal["awaiting_payment", "confirmed", "cancelled"]
    payment_status: Literal["not_started", "paid", "failed"]


class BookingOut(CamelModel):
    id: str
    order_id: str
    service_id: str
    service_title: str
    starts_at: datetime
    ends_at: datetime
    timezone: str
    modality: Modality
    status: Literal["confirmed"]
    payment_status: Literal["paid"]


class StubPaymentConfirmation(CamelModel):
    payment_id: str
    payment_status: Literal["paid"]
    booking: BookingOut
