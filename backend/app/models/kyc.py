"""
ORM models. Mirror migrations/0001_init.sql exactly.
Schema drift between the DDL and the ORM is a recurring source of prod
incidents — these two files must be reviewed together on every change.
"""
import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


def _uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


# Enums 

class UserRole(str, enum.Enum):
    CUSTOMER = "customer"
    REVIEWER = "reviewer"
    ADMIN = "admin"


class KycStatus(str, enum.Enum):
    INITIATED = "INITIATED"
    DOC_UPLOADED = "DOC_UPLOADED"
    DOC_VERIFIED = "DOC_VERIFIED"
    LIVENESS_PASSED = "LIVENESS_PASSED"
    FACE_MATCHED = "FACE_MATCHED"
    RISK_SCORED = "RISK_SCORED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    MANUAL_REVIEW = "MANUAL_REVIEW"


# create_type=False: types already exist in Postgres via migration.
# values_callable: sends .value ("customer") not .name ("CUSTOMER").
USER_ROLE_ENUM = PGEnum(
    UserRole, name="user_role", create_type=False,
    values_callable=lambda e: [x.value for x in e],
)
KYC_STATUS_ENUM = PGEnum(
    KycStatus, name="kyc_status", create_type=False,
    values_callable=lambda e: [x.value for x in e],
)

# Explicit allowed-transition map — ADR-001.
# Enforced in services/session_state.py only — never write .status directly.
ALLOWED_TRANSITIONS: dict[KycStatus, set[KycStatus]] = {
    KycStatus.INITIATED:       {KycStatus.DOC_UPLOADED},
    KycStatus.DOC_UPLOADED:    {KycStatus.DOC_VERIFIED, KycStatus.REJECTED},
    KycStatus.DOC_VERIFIED:    {KycStatus.LIVENESS_PASSED, KycStatus.REJECTED},
    KycStatus.LIVENESS_PASSED: {KycStatus.FACE_MATCHED, KycStatus.REJECTED},
    KycStatus.FACE_MATCHED:    {KycStatus.RISK_SCORED, KycStatus.REJECTED},
    KycStatus.RISK_SCORED:     {KycStatus.APPROVED, KycStatus.REJECTED, KycStatus.MANUAL_REVIEW},
    KycStatus.MANUAL_REVIEW:   {KycStatus.APPROVED, KycStatus.REJECTED},
    KycStatus.APPROVED:        set(),
    KycStatus.REJECTED:        set(),
}


# ORM Models 

class User(Base):
    __tablename__ = "users"

    id:            Mapped[uuid.UUID] = _uuid_pk()
    email:         Mapped[str]       = mapped_column(String(255), unique=True, nullable=False)
    phone:         Mapped[str | None]= mapped_column(String(20))
    password_hash: Mapped[str]       = mapped_column(String(255), nullable=False)
    role:          Mapped[UserRole]  = mapped_column(USER_ROLE_ENUM, default=UserRole.CUSTOMER)
    full_name:     Mapped[str | None]= mapped_column(String(255))
    is_active:     Mapped[bool]      = mapped_column(Boolean, default=True)
    created_at:    Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at:    Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now())


class ConsentRecord(Base):
    __tablename__ = "consent_records"

    id:           Mapped[uuid.UUID]  = _uuid_pk()
    user_id:      Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    session_id:   Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"))
    purpose:      Mapped[str]        = mapped_column(String(100), nullable=False)
    consent_text: Mapped[str]        = mapped_column(Text, nullable=False)
    granted_at:   Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())
    revoked_at:   Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class KycSession(Base):
    __tablename__ = "kyc_sessions"

    id:              Mapped[uuid.UUID]  = _uuid_pk()
    user_id:         Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    status:          Mapped[KycStatus]  = mapped_column(KYC_STATUS_ENUM, default=KycStatus.INITIATED)
    doc_type:        Mapped[str | None] = mapped_column(String(50))
    region:          Mapped[str]        = mapped_column(String(10), default="IN")
    retention_until: Mapped[date | None]= mapped_column(Date)
    created_at:      Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at:      Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())

    documents: Mapped[list["Document"]] = relationship(back_populates="session")


class Document(Base):
    __tablename__ = "documents"

    id:                        Mapped[uuid.UUID]  = _uuid_pk()
    session_id:                Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"))
    doc_type:                  Mapped[str]        = mapped_column(String(50), nullable=False)
    storage_key:               Mapped[str]        = mapped_column(String(500), nullable=False)
    sha256_hash:               Mapped[str]        = mapped_column(String(64), nullable=False)
    ocr_fields:                Mapped[dict | None]= mapped_column(JSONB)
    ocr_confidence:            Mapped[float | None]= mapped_column(Numeric(4, 3))
    forgery_score:             Mapped[float | None]= mapped_column(Numeric(4, 3))
    extracted_face_storage_key:Mapped[str | None] = mapped_column(String(500))
    created_at:                Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())

    session: Mapped["KycSession"] = relationship(back_populates="documents")


class LivenessAttempt(Base):
    __tablename__ = "liveness_attempts"

    id:                    Mapped[uuid.UUID]  = _uuid_pk()
    session_id:            Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"))
    challenge_sequence:    Mapped[list]       = mapped_column(JSONB, nullable=False)
    passive_spoof_score:   Mapped[float | None]= mapped_column(Numeric(4, 3))
    active_challenge_passed:Mapped[bool | None]= mapped_column(Boolean)
    video_storage_key:     Mapped[str | None] = mapped_column(String(500))
    passed:                Mapped[bool]       = mapped_column(Boolean, default=False)
    attempted_at:          Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())


class FaceMatchResult(Base):
    __tablename__ = "face_match_results"

    id:                 Mapped[uuid.UUID]  = _uuid_pk()
    session_id:         Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"))
    document_id:        Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("documents.id"))
    liveness_attempt_id:Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("liveness_attempts.id"))
    similarity_score:   Mapped[float]      = mapped_column(Numeric(5, 4), nullable=False)
    threshold_used:     Mapped[float]      = mapped_column(Numeric(5, 4), nullable=False)
    matched:            Mapped[bool]       = mapped_column(Boolean, nullable=False)
    model_version:      Mapped[str]        = mapped_column(String(50), nullable=False)
    created_at:         Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())


class AadhaarVerification(Base):
    __tablename__ = "aadhaar_verifications"

    id:                  Mapped[uuid.UUID]  = _uuid_pk()
    session_id:          Mapped[uuid.UUID]  = mapped_column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"))
    verification_mode:   Mapped[str]        = mapped_column(String(20), nullable=False)
    signature_valid:     Mapped[bool]       = mapped_column(Boolean, nullable=False)
    uidai_cert_serial:   Mapped[str | None] = mapped_column(String(100))
    masked_aadhaar_last4:Mapped[str | None] = mapped_column(String(4))
    demographic_match:   Mapped[bool | None]= mapped_column(Boolean)
    verified_at:         Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())


class RiskDecision(Base):
    __tablename__ = "risk_decisions"

    id:               Mapped[uuid.UUID] = _uuid_pk()
    session_id:       Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"), unique=True)
    composite_score:  Mapped[float]     = mapped_column(Numeric(5, 4), nullable=False)
    signal_breakdown: Mapped[dict]      = mapped_column(JSONB, nullable=False)
    decision:         Mapped[str]       = mapped_column(String(20), nullable=False)
    decided_by:       Mapped[str]       = mapped_column(String(20), default="system")
    reviewer_notes:   Mapped[str | None]= mapped_column(Text)
    decided_at:       Mapped[datetime]  = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditEvent(Base):
    """Append-only. DB role REVOKES UPDATE/DELETE — never expose an update path."""
    __tablename__ = "audit_events"

    id:            Mapped[int]             = mapped_column(primary_key=True, autoincrement=True)
    session_id:    Mapped[uuid.UUID | None]= mapped_column(UUID(as_uuid=True), ForeignKey("kyc_sessions.id"))
    actor_id:      Mapped[uuid.UUID | None]= mapped_column(UUID(as_uuid=True))
    event_type:    Mapped[str]             = mapped_column(String(100), nullable=False)
    event_payload: Mapped[dict]            = mapped_column(JSONB, nullable=False)
    prev_hash:     Mapped[str]             = mapped_column(String(64), nullable=False)
    row_hash:      Mapped[str]             = mapped_column(String(64), nullable=False)
    created_at:    Mapped[datetime]        = mapped_column(DateTime(timezone=True), server_default=func.now())
