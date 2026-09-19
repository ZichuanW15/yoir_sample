from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment / .env with safe local defaults."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # PostgreSQL (the engine named in the design concept). Override in .env for
    # your local server, e.g. Postgres.app commonly listens on 5433:
    #   postgresql://evelyn@localhost:5433/yoir
    database_url: str = "postgresql://localhost:5432/yoir"

    jwt_secret: str = "dev-only-insecure-secret-change-me-please-32b"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60

    # --- Refresh tokens (US-06) --------------------------------------------
    # A mobile app should not ask for a password every hour, so the session slides:
    # each refresh issues a new access token and a new refresh token. The window is
    # per platform because the two do not store a credential equally well. On a
    # device it is the Keychain/Keystore; in a browser it is localStorage, readable
    # by any script on the origin, so a long-lived token there is a far bigger prize.
    refresh_token_ttl_days_native: int = 90
    refresh_token_ttl_days_web: int = 7

    # Single-use link lifetimes. A verification link is generous because people
    # read mail hours later; a reset link is short because it is the more
    # dangerous of the two to leave lying in an inbox.
    email_verification_ttl_hours: int = 24
    password_reset_ttl_hours: int = 2

    # --- Transactional email (Mailgun) -------------------------------------
    # An empty api key leaves the app on a log-only sender, so everything runs on a
    # machine with no mail credentials — the same arrangement as the payment stub.
    mailgun_api_key: str = ""
    mailgun_domain: str = ""
    mailgun_base_url: str = "https://api.mailgun.net/v3"
    mail_from_name: str = "Yoir"
    #: Defaults to postmaster@<domain>, which is the address a Mailgun sandbox owns.
    mail_from_address: str = ""

    #: Where auto-generated meeting rooms live. Jitsi's public instance needs no
    #: account and no credentials from us; a self-hosted one is a setting away.
    jitsi_base_url: str = "https://meet.jit.si"

    #: Origin the links inside emails point at — the web build, not the API. Verify
    #: and password-reset links are useless if they point somewhere unreachable.
    app_web_url: str = "http://localhost:8081"

    @property
    def mail_enabled(self) -> bool:
        return bool(self.mailgun_api_key and self.mailgun_domain)

    @property
    def mail_sender(self) -> str:
        address = self.mail_from_address or f"postmaster@{self.mailgun_domain}"
        return f"{self.mail_from_name} <{address}>"

    @property
    def mail_domain_is_sandbox(self) -> bool:
        """A Mailgun sandbox domain only delivers to manually authorised recipients.

        Worth knowing about explicitly: mail to anyone else is accepted by the API and
        then silently dropped, which looks exactly like a bug in this application.
        """
        return "sandbox" in self.mailgun_domain.lower()

    # "*" or a comma-separated list of origins the Expo app is served from.
    cors_allow_origins: str = "*"

    # Insert the two demo services on startup when the table is empty.
    seed_on_startup: bool = True

    # --- The administrator account ------------------------------------------
    # The platform_owner role is never handed out by registration, so without one
    # of these the administration area cannot be reached at all. Set both and the
    # account is created on startup if it is not already there; it is never
    # modified or removed afterwards, so deploying again preserves whatever the
    # account has become — including a password changed since.
    #
    # This puts a password in configuration, which is why it is empty by default
    # and warned about loudly. Set it for a development deployment; for anything
    # holding real accounts, create the owner once and then clear these.
    admin_email: str = ""
    admin_password: str = ""

    @property
    def admin_bootstrap_enabled(self) -> bool:
        return bool(self.admin_email and self.admin_password)

    # Directory holding the exported Expo web build, served at "/" alongside the
    # API. Relative paths resolve against the backend root; no build there means
    # the API is served on its own.
    frontend_dist: str = "static"

    # --- Stripe (payments-spec §4) -----------------------------------------
    # Secret material lives here and nowhere else; the Expo app is served the
    # publishable key over /payments/config and never sees these values. An empty
    # stripe_secret_key leaves the platform on the development stub, so the app
    # still runs end to end on a machine with no Stripe credentials.
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""  # platform events, POST /webhook
    stripe_connect_webhook_secret: str = ""  # connected-account events, POST /webhook/connect

    # Public HTTPS origin Stripe redirects back to during Connect onboarding.
    # Account Links reject non-HTTPS URLs, so testing locally needs a tunnel.
    app_base_url: str = "http://localhost:8000"
    # Deep link the onboarding return page bounces to, matching app.json "scheme".
    app_deep_link_scheme: str = "yoir"
    # Origin the Expo web build is served from, for the browser half of Connect
    # onboarding. Empty means the backend serves it itself at app_base_url, which is
    # true in deployment; `expo start --web` runs on :8081, so set it in development.
    web_app_base_url: str = ""
    merchant_display_name: str = "Yoir"

    # --- Commission and policy (payments-spec §3) ---------------------------
    # Still being confirmed with the client's accountant, so every one of these is
    # configuration rather than a constant in the pricing code.
    platform_fee_percent: float = 20.0
    platform_gst_registered: bool = True
    # gst_inclusive: commission is taken from the full price the job seeker pays.
    # gst_exclusive: the counsellor's own GST is removed before commission.
    commission_base: Literal["gst_inclusive", "gst_exclusive"] = "gst_inclusive"
    platform_abn: str = ""
    platform_legal_name: str = "Yoir"

    cancellation_full_refund_hours: int = 24
    # What a job seeker gets back when they cancel inside the full-refund window.
    # 0 until the client settles the late-cancellation policy.
    cancellation_late_refund_percent: int = 0
    slot_hold_minutes: int = 15
    payout_delay_hours: int = 24

    # The in-process scheduler for hold expiry, session completion and payouts.
    payment_jobs_enabled: bool = True
    payment_jobs_interval_seconds: int = 60

    @property
    def payments_enabled(self) -> bool:
        """Stripe is live only when a secret key is configured; otherwise the
        development stub in /orders/{id}/payments/stub remains the payment path."""
        return bool(self.stripe_secret_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()
