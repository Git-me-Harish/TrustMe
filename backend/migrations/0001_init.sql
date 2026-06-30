-- KYC Platform — Initial schema
-- Postgres 15+. Run via Alembic in real deploy; this is the canonical DDL reference.

-- Extensions MUST come first — citext is required for email column
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ============================================================
-- USERS / AUTH
-- ============================================================
CREATE TYPE user_role AS ENUM ('customer', 'reviewer', 'admin');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           CITEXT UNIQUE NOT NULL,
    phone           VARCHAR(20),
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL DEFAULT 'customer',
    full_name       VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- CONSENT — first-class, required before any biometric processing
-- ============================================================
CREATE TABLE consent_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    session_id      UUID,                               -- linked after session created
    purpose         VARCHAR(100) NOT NULL,
    consent_text    TEXT NOT NULL,
    ip_address      INET,
    user_agent      TEXT,
    granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at      TIMESTAMPTZ
);

-- ============================================================
-- KYC SESSION — the strict state machine (ADR-001)
-- ============================================================
CREATE TYPE kyc_status AS ENUM (
    'INITIATED', 'DOC_UPLOADED', 'DOC_VERIFIED', 'LIVENESS_PASSED',
    'FACE_MATCHED', 'RISK_SCORED', 'APPROVED', 'REJECTED', 'MANUAL_REVIEW'
);

CREATE TABLE kyc_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    status          kyc_status NOT NULL DEFAULT 'INITIATED',
    doc_type        VARCHAR(50),
    region          VARCHAR(10) NOT NULL DEFAULT 'IN',
    retention_until DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyc_sessions_user ON kyc_sessions(user_id);
CREATE INDEX idx_kyc_sessions_status ON kyc_sessions(status);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES kyc_sessions(id),
    doc_type        VARCHAR(50) NOT NULL,
    storage_key     VARCHAR(500) NOT NULL,
    sha256_hash     VARCHAR(64) NOT NULL,
    ocr_fields      JSONB,
    ocr_confidence  NUMERIC(4,3),
    forgery_score   NUMERIC(4,3),
    extracted_face_storage_key VARCHAR(500),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_session ON documents(session_id);

-- ============================================================
-- LIVENESS
-- ============================================================
CREATE TABLE liveness_attempts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES kyc_sessions(id),
    challenge_sequence  JSONB NOT NULL,
    passive_spoof_score NUMERIC(4,3),
    active_challenge_passed BOOLEAN,
    video_storage_key   VARCHAR(500),
    passed              BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_liveness_session ON liveness_attempts(session_id);

-- ============================================================
-- FACE MATCH
-- ============================================================
CREATE TABLE face_match_results (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID NOT NULL REFERENCES kyc_sessions(id),
    document_id         UUID NOT NULL REFERENCES documents(id),
    liveness_attempt_id UUID REFERENCES liveness_attempts(id),
    similarity_score    NUMERIC(5,4) NOT NULL,
    threshold_used      NUMERIC(5,4) NOT NULL,
    matched             BOOLEAN NOT NULL,
    model_version       VARCHAR(50) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_face_match_session ON face_match_results(session_id);

-- ============================================================
-- AADHAAR OFFLINE VERIFICATION (ADR-002)
-- ============================================================
CREATE TABLE aadhaar_verifications (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id           UUID NOT NULL REFERENCES kyc_sessions(id),
    verification_mode    VARCHAR(20) NOT NULL,
    signature_valid      BOOLEAN NOT NULL,
    uidai_cert_serial    VARCHAR(100),
    masked_aadhaar_last4 VARCHAR(4),
    demographic_match    BOOLEAN,
    verified_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RISK / DECISION
-- ============================================================
CREATE TABLE risk_decisions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES kyc_sessions(id) UNIQUE,
    composite_score NUMERIC(5,4) NOT NULL,
    signal_breakdown JSONB NOT NULL,
    decision        VARCHAR(20) NOT NULL,
    decided_by      VARCHAR(20) NOT NULL DEFAULT 'system',
    reviewer_notes  TEXT,
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- AUDIT TRAIL — append-only, hash-chained (tamper-evident)
-- ============================================================
CREATE TABLE audit_events (
    id            BIGSERIAL PRIMARY KEY,
    session_id    UUID REFERENCES kyc_sessions(id),
    actor_id      UUID,
    event_type    VARCHAR(100) NOT NULL,
    event_payload JSONB NOT NULL,
    prev_hash     VARCHAR(64) NOT NULL,
    row_hash      VARCHAR(64) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_session ON audit_events(session_id);

-- Enforce append-only at the DB level:
-- REVOKE UPDATE, DELETE ON audit_events FROM kyc_app_role;
-- GRANT INSERT, SELECT ON audit_events TO kyc_app_role;
