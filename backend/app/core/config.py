"""
Centralized configuration. Single source of truth for every environment
variable the app reads — never scatter os.environ.get() calls through the
codebase, it makes secrets impossible to audit.
"""
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    APP_NAME: str = "kyc-platform"
    ENV: str = Field(default="development")
    DEBUG: bool = Field(default=False)

    # --- Database ---
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://kyc:kyc@localhost:5432/kyc_platform"
    )

    # --- Object storage (MinIO / S3-compatible) ---
    OBJECT_STORE_ENDPOINT: str = Field(default="http://localhost:9000")
    OBJECT_STORE_ACCESS_KEY: str = Field(default="minioadmin")
    OBJECT_STORE_SECRET_KEY: str = Field(default="minioadmin")
    OBJECT_STORE_BUCKET: str = Field(default="kyc-evidence")
    OBJECT_STORE_USE_SSL: bool = Field(default=False)

    # --- Auth ---
    JWT_SECRET: str = Field(default="CHANGE_ME_IN_PRODUCTION")
    JWT_ALGORITHM: str = Field(default="RS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=30)
    REFRESH_TOKEN_EXPIRE_DAYS: int = Field(default=7)

    # --- ML model paths (self-hosted, no paid API) ---
    ARCFACE_MODEL_PACK: str = Field(default="buffalo_l")
    FACE_MATCH_THRESHOLD: float = Field(default=0.62)  # cosine similarity, calibrate on val set
    LIVENESS_SPOOF_THRESHOLD: float = Field(default=0.5)
    PADDLEOCR_LANG: str = Field(default="en")

    # --- Risk engine weights (configurable without redeploy in v1.1 via DB) ---
    RISK_WEIGHT_FACE_MATCH: float = 0.35
    RISK_WEIGHT_LIVENESS: float = 0.25
    RISK_WEIGHT_DOC_FORGERY: float = 0.20
    RISK_WEIGHT_AADHAAR_VERIFY: float = 0.20
    RISK_AUTO_APPROVE_THRESHOLD: float = 0.85
    RISK_AUTO_REJECT_THRESHOLD: float = 0.35

    # --- Compliance ---
    KYC_RETENTION_YEARS: int = Field(default=5)  # RBI Master Direction baseline

    # --- Rate limiting ---
    RATE_LIMIT_FACE_MATCH_PER_HOUR: int = Field(default=10)


@lru_cache
def get_settings() -> Settings:
    return Settings()
