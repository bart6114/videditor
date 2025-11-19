"""Job runner configuration using Pydantic settings."""

from typing import Literal, Optional

from pydantic import Field, HttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class TigrisConfig(BaseSettings):
    """Tigris storage configuration."""

    TIGRIS_ENDPOINT: HttpUrl
    TIGRIS_REGION: str = Field(min_length=1)
    TIGRIS_BUCKET: str = Field(min_length=1)
    TIGRIS_ACCESS_KEY_ID: str = Field(min_length=1)
    TIGRIS_SECRET_ACCESS_KEY: str = Field(min_length=1)


class JobRunnerConfig(BaseSettings):
    """Job runner environment configuration."""

    model_config = SettingsConfigDict(
        env_file="../../.env.local",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application settings
    NODE_ENV: Literal["development", "test", "production"] = "development"
    PORT: int = Field(default=8081, ge=1, le=65535)

    # Database
    DATABASE_URL: str = Field(min_length=1)

    # Job processing
    JOB_CONCURRENCY: int = Field(default=1, ge=1, le=20)
    POLL_INTERVAL_MS: int = Field(default=1000, ge=100)

    # FFmpeg (optional)
    FFMPEG_BINARY: Optional[str] = None

    # Tigris storage
    TIGRIS_ENDPOINT: HttpUrl
    TIGRIS_REGION: str = Field(min_length=1)
    TIGRIS_BUCKET: str = Field(min_length=1)
    TIGRIS_ACCESS_KEY_ID: str = Field(min_length=1)
    TIGRIS_SECRET_ACCESS_KEY: str = Field(min_length=1)

    @field_validator("DATABASE_URL")
    @classmethod
    def validate_database_url(cls, v: str) -> str:
        """Ensure DATABASE_URL is not empty."""
        if not v or not v.strip():
            raise ValueError("DATABASE_URL is required")
        return v

    @property
    def tigris(self) -> dict[str, str]:
        """Get Tigris configuration as a dict."""
        return {
            "endpoint": str(self.TIGRIS_ENDPOINT),
            "region": self.TIGRIS_REGION,
            "bucket": self.TIGRIS_BUCKET,
            "accessKeyId": self.TIGRIS_ACCESS_KEY_ID,
            "secretAccessKey": self.TIGRIS_SECRET_ACCESS_KEY,
        }


def load_job_config() -> JobRunnerConfig:
    """
    Load and validate job runner configuration from environment.

    Raises:
        ValidationError: If environment variables are invalid or missing.
    """
    try:
        return JobRunnerConfig()  # type: ignore
    except Exception as e:
        print(f"Invalid job runner configuration: {e}")
        raise RuntimeError(
            "Cannot start job runner without valid environment variables."
        ) from e
