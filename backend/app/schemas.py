from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, StringConstraints
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
