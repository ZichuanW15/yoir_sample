from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration, read from environment / .env with safe local defaults."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # PostgreSQL (the engine named in the design concept). Override in .env for
    # your local server, e.g. Postgres.app commonly listens on 5433:
    #   postgresql+psycopg://evelyn@localhost:5433/yoir
    database_url: str = "postgresql+psycopg://localhost:5432/yoir"

    jwt_secret: str = "dev-only-insecure-secret-change-me-please-32b"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 60

    # "*" or a comma-separated list of origins the Expo app is served from.
    cors_allow_origins: str = "*"

    # Insert the two demo services on startup when the table is empty.
    seed_on_startup: bool = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
