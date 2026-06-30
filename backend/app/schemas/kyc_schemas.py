"""Pydantic V2 schemas — API contracts. Never expose ORM models directly."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10)
    full_name: str | None = None
    phone: str | None = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    email: EmailStr
    full_name: str | None
    role: str
    created_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class KycSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    status: str
    doc_type: str | None
    region: str
    created_at: datetime


class LivenessChallengeOut(BaseModel):
    token: str
    sequence: list[str]
    expires_at: datetime


class LivenessVerifyIn(BaseModel):
    challenge_token: str
    performed_sequence: list[str]


class LivenessResultOut(BaseModel):
    passive_spoof_score: float
    active_challenge_passed: bool
    passed: bool


class FaceMatchOut(BaseModel):
    similarity_score: float
    matched: bool
    threshold_used: float
    model_version: str


class RiskDecisionOut(BaseModel):
    composite_score: float
    decision: str
    breakdown: dict


class AadhaarVerifyOut(BaseModel):
    signature_valid: bool
    masked_aadhaar_last4: str | None
    demographic_match: bool | None


class AuditEventOut(BaseModel):
    id: int
    event_type: str
    event_payload: dict
    row_hash: str
    created_at: datetime
    chain_integrity: bool


class ReviewDecisionIn(BaseModel):
    decision: str   # "APPROVED" | "REJECTED"
    notes: str | None = None
