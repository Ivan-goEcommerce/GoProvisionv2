"""Application configuration."""

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings loaded from environment variables."""

    app_name: str = "GoProvisions API"
    app_env: str = "development"
    app_version: str = "0.1.0"
    log_level: str = "INFO"
    cors_allow_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000",
        alias="CORS_ALLOW_ORIGINS",
    )

    supabase_url: str = Field(alias="SUPABASE_URL")
    supabase_service_role_key: str = Field(
        default="", alias="SUPABASE_SERVICE_ROLE_KEY"
    )
    supabase_key_fallback: str = Field(default="", alias="SUPABASE_KEY")
    webhook_secret: str = Field(
        default="dev-webhook-secret-change-me", alias="WEBHOOK_SECRET"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


settings = Settings()


def get_cors_origins() -> list[str]:
    """Parse configured CORS origins from comma-separated string."""
    origins = [origin.strip() for origin in settings.cors_allow_origins.split(",")]
    return [origin for origin in origins if origin]
