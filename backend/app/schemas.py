from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field
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
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8)
    password_confirmation: str = Field(min_length=8)
    role: Literal["job_seeker", "counsellor"]


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1)


# --- responses -----------------------------------------------------------

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
