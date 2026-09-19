"""Rendering branded emails from Jinja templates.

Every email has both an HTML and a plain-text part. The text part is not a courtesy:
some clients refuse to render HTML, and a message with no text alternative scores
worse with spam filters, which matters for a booking confirmation someone is waiting
on.

Jinja2 arrives with Starlette, so this adds no dependency.
"""

from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from app.config import get_settings

TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"

_environment = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    # Escape the HTML parts and only those. Matching on the extension would catch
    # `.txt.j2` as well, and a counsellor named "Smith & Co" would arrive as
    # "Smith &amp; Co" in the plain-text alternative.
    autoescape=lambda name: bool(name and ".html." in name),
    # A missing variable should fail loudly in a test rather than render an empty gap
    # in an email someone receives.
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)


def _shared_context() -> dict[str, Any]:
    settings = get_settings()
    return {
        "brand": settings.mail_from_name,
        "web_url": settings.app_web_url.rstrip("/"),
    }


def render(template: str, /, **context: Any) -> tuple[str, str]:
    """Return `(html, text)` for the named email.

    `template` is the stem shared by the pair, so `booking_confirmed` renders both
    `booking_confirmed.html.j2` and `booking_confirmed.txt.j2` — keeping them named
    together is what stops one being updated and the other forgotten.

    Positional-only, because otherwise it collides with the context: `name` is the
    most natural variable for a recipient's name, and every email wants one.
    """
    merged = {**_shared_context(), **context}
    html = _environment.get_template(f"{template}.html.j2").render(**merged)
    text = _environment.get_template(f"{template}.txt.j2").render(**merged)
    return html, text


def money(minor: int) -> str:
    """Money for humans. Templates must not do arithmetic."""
    return f"${minor / 100:,.2f}"


_environment.filters["money"] = money
