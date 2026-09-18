"""Where an online session actually happens.

A booking is useless without a place to meet, and until now nothing produced one.
The room is decided once, when the booking is confirmed, and stored on the booking
rather than derived on read: the confirmation email, the receipt and the app must
all name the same room months later, even if the counsellor changes their own
preferred one in the meantime.

Jitsi Meet is the default because it needs no account from either party and no
credentials from us — a counsellor who would rather use their own Zoom or Google
Meet room sets `meeting_url` on the service and that is used instead.
"""

import re

from app.config import get_settings
from app.models import Booking, Service

#: Rooms are namespaced so a guessed name lands somewhere obviously ours rather
#: than in an unrelated stranger's meeting.
ROOM_PREFIX = "yoir"

_UNSAFE = re.compile(r"[^a-zA-Z0-9]+")


def room_name(booking_id: str) -> str:
    """A room name from the booking id, which is already unguessable and unique.

    Jitsi treats the name as the entire access control: anyone who knows it can join.
    A sequence number or the counsellor's name would be trivially guessable, so the
    random booking id is doing real work here, not just naming.
    """
    return f"{ROOM_PREFIX}-{_UNSAFE.sub('', booking_id).lower()}"


def meeting_url_for(booking: Booking, service: Service) -> str | None:
    """The room for this booking, or None when the parties are meeting in person."""
    if booking.modality != "online":
        return None
    override = (service.meeting_url or "").strip()
    if override:
        return override
    return f"{get_settings().jitsi_base_url.rstrip('/')}/{room_name(booking.id)}"
