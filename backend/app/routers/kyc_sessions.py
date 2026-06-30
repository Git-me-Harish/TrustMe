import hashlib
import json as _json
import uuid
from datetime import date, timedelta

import cv2
import numpy as np
from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.ml.face import arcface_matcher
from app.ml.liveness import liveness_service
from app.ml.ocr import document_ocr
from app.ml.risk import risk_engine
from app.models.kyc import (
    AadhaarVerification, Document, FaceMatchResult, KycSession, KycStatus,
    LivenessAttempt, RiskDecision, User,
)
from app.schemas.kyc_schemas import (
    AadhaarVerifyOut, AuditEventOut, FaceMatchOut, KycSessionOut,
    LivenessChallengeOut, LivenessResultOut, RiskDecisionOut,
)
from app.services import audit_service, session_state
from app.utils.rate_limit import enforce_rate_limit
from app.utils.storage import download_bytes, upload_bytes

router = APIRouter(prefix="/api/v1/sessions", tags=["kyc"])
settings = get_settings()

# In-memory challenge cache — single-process dev only.
# Replace with Redis before any multi-instance deploy.
_ACTIVE_CHALLENGES: dict[str, tuple[uuid.UUID, list[str]]] = {}


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _decode_image(raw: bytes) -> np.ndarray:
    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unreadable image file")
    return image


async def _get_owned_session(db: AsyncSession, session_id: uuid.UUID, user: User) -> KycSession:
    session = (
        await db.execute(select(KycSession).where(KycSession.id == session_id))
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="KYC session not found")
    if session.user_id != user.id and user.role not in ("reviewer", "admin"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized for this session")
    return session


# ──────────────────────────────────────────────
# Session lifecycle
# ──────────────────────────────────────────────

@router.post("", response_model=KycSessionOut, status_code=status.HTTP_201_CREATED)
async def create_session(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KycSession:
    session = KycSession(
        user_id=user.id,
        status=KycStatus.INITIATED,
        retention_until=date.today() + timedelta(days=365 * settings.KYC_RETENTION_YEARS),
    )
    db.add(session)
    await db.flush()
    await audit_service.record_event(
        db, session_id=session.id, actor_id=user.id,
        event_type="SESSION_CREATED", payload={},
    )
    await db.commit()
    return session


@router.get("", response_model=list[KycSessionOut])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[KycSession]:
    """Return all KYC sessions belonging to the current user, newest first."""
    rows = (
        await db.execute(
            select(KycSession)
            .where(KycSession.user_id == user.id)
            .order_by(KycSession.created_at.desc())
        )
    ).scalars().all()
    return list(rows)


@router.get("/{session_id}", response_model=KycSessionOut)
async def get_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> KycSession:
    return await _get_owned_session(db, session_id, user)


@router.get("/{session_id}/audit", response_model=list[AuditEventOut])
async def get_audit_trail(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """Return the full hash-chained audit trail for a session.
    Reviewers/admins can pull this for any session; customers only see their own."""
    await _get_owned_session(db, session_id, user)
    from app.models.kyc import AuditEvent
    rows = (
        await db.execute(
            select(AuditEvent)
            .where(AuditEvent.session_id == session_id)
            .order_by(AuditEvent.id.asc())
        )
    ).scalars().all()
    # Verify chain integrity inline — flag if tampered
    chain_ok = await audit_service.verify_chain_integrity(db, session_id)
    return [
        {
            "id": r.id,
            "event_type": r.event_type,
            "event_payload": r.event_payload,
            "row_hash": r.row_hash,
            "created_at": r.created_at,
            "chain_integrity": chain_ok,
        }
        for r in rows
    ]


# ──────────────────────────────────────────────
# Consent
# ──────────────────────────────────────────────

@router.post("/{session_id}/consent", status_code=status.HTTP_201_CREATED)
async def record_consent(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Record explicit consent before any biometric data is captured.
    RBI Master Direction + GDPR both require logged, per-session consent."""
    from app.models.kyc import ConsentRecord
    existing = (
        await db.execute(
            select(ConsentRecord)
            .where(ConsentRecord.session_id == session_id, ConsentRecord.user_id == user.id)
        )
    ).scalar_one_or_none()
    if existing:
        return {"consent_id": str(existing.id), "already_recorded": True}

    consent = ConsentRecord(
        user_id=user.id,
        session_id=session_id,
        purpose="biometric_kyc_verification",
        consent_text=(
            "I consent to the collection and processing of my biometric data "
            "(facial image, liveness video frames) and identity document data "
            "for the purpose of KYC verification. Data will be retained for "
            "the period required by applicable regulations."
        ),
    )
    db.add(consent)
    await audit_service.record_event(
        db, session_id=session_id, actor_id=user.id,
        event_type="CONSENT_RECORDED",
        payload={"purpose": consent.purpose},
    )
    await db.commit()
    await db.refresh(consent)
    return {"consent_id": str(consent.id), "already_recorded": False}


# ──────────────────────────────────────────────
# Document upload
# ──────────────────────────────────────────────

@router.post("/{session_id}/document", status_code=status.HTTP_201_CREATED)
async def upload_document(
    session_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    session = await _get_owned_session(db, session_id, user)
    current_status = KycStatus(session.status)

    # Idempotency — if doc already verified, return existing record
    if current_status not in (KycStatus.INITIATED, KycStatus.DOC_UPLOADED):
        existing_doc = (
            await db.execute(
                select(Document)
                .where(Document.session_id == session.id)
                .order_by(Document.created_at.desc())
            )
        ).scalars().first()
        if existing_doc:
            return {
                "document_id": str(existing_doc.id),
                "doc_type": existing_doc.doc_type,
                "ocr_confidence": float(existing_doc.ocr_confidence or 0),
            }

    raw = await file.read()
    image = _decode_image(raw)
    extracted = document_ocr.extract_fields(image)

    if extracted.doc_type == "unknown":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not classify document type. Upload a clear image of Aadhaar, PAN, Passport, or Driving Licence.",
        )

    storage_key = upload_bytes(raw, prefix=f"sessions/{session_id}/documents")
    sha256_hash = hashlib.sha256(raw).hexdigest()

    doc = Document(
        session_id=session.id,
        doc_type=extracted.doc_type,
        storage_key=storage_key,
        sha256_hash=sha256_hash,
        ocr_fields={
            "name": extracted.name,
            "dob": extracted.dob,
            "doc_number": extracted.doc_number,
        },
        ocr_confidence=extracted.confidence,
        forgery_score=0.0,  # placeholder — v1.1: wire forgery CNN here
    )
    db.add(doc)
    session.doc_type = extracted.doc_type

    # Transition through DOC_UPLOADED → DOC_VERIFIED in one shot.
    # OCR already ran and classified successfully — no reason to stop halfway.
    if current_status == KycStatus.INITIATED:
        await session_state.transition(
            db, session, KycStatus.DOC_UPLOADED,
            actor_id=user.id, reason={"doc_type": extracted.doc_type},
        )
    await session_state.transition(
        db, session, KycStatus.DOC_VERIFIED,
        actor_id=user.id, reason={"ocr_confidence": extracted.confidence},
    )

    await db.commit()
    return {
        "document_id": str(doc.id),
        "doc_type": extracted.doc_type,
        "ocr_confidence": extracted.confidence,
        "ocr_fields": doc.ocr_fields,
    }


# ──────────────────────────────────────────────
# Liveness
# ──────────────────────────────────────────────

@router.post("/{session_id}/liveness/challenge", response_model=LivenessChallengeOut)
async def issue_liveness_challenge(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LivenessChallengeOut:
    await _get_owned_session(db, session_id, user)
    challenge = liveness_service.issue_challenge()
    _ACTIVE_CHALLENGES[challenge.token] = (session_id, challenge.sequence)
    return LivenessChallengeOut(
        token=challenge.token,
        sequence=challenge.sequence,
        expires_at=challenge.expires_at,
    )


@router.post("/{session_id}/liveness/verify", response_model=LivenessResultOut)
async def verify_liveness(
    session_id: uuid.UUID,
    face_frame: UploadFile,
    challenge_token: str = Form(...),
    performed_sequence: str = Form(...),  # JSON-encoded list[str]
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> LivenessResultOut:
    try:
        sequence = _json.loads(performed_sequence)
        if not isinstance(sequence, list):
            raise ValueError
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="performed_sequence must be a JSON array",
        )

    session = await _get_owned_session(db, session_id, user)

    cached = _ACTIVE_CHALLENGES.pop(challenge_token, None)
    if cached is None or cached[0] != session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unknown or expired challenge token",
        )

    expected_sequence = cached[1]
    raw = await face_frame.read()
    image = _decode_image(raw)

    spoof_score = liveness_service.score_passive_antispoof(
        image, allow_dev_stub=(settings.ENV != "production")
    )
    verdict = liveness_service.evaluate_liveness(
        passive_spoof_score=spoof_score,
        performed_sequence=sequence,
        expected_sequence=expected_sequence,
        spoof_threshold=settings.LIVENESS_SPOOF_THRESHOLD,
    )

    attempt = LivenessAttempt(
        session_id=session.id,
        challenge_sequence=expected_sequence,
        passive_spoof_score=verdict.passive_spoof_score,
        active_challenge_passed=verdict.active_challenge_passed,
        passed=verdict.passed,
    )
    db.add(attempt)

    if verdict.passed:
        await session_state.transition(
            db, session, KycStatus.LIVENESS_PASSED, actor_id=user.id
        )
    else:
        await audit_service.record_event(
            db, session_id=session.id, actor_id=user.id,
            event_type="LIVENESS_FAILED",
            payload={
                "spoof_score": verdict.passive_spoof_score,
                "active_passed": verdict.active_challenge_passed,
            },
        )

    await db.commit()
    return LivenessResultOut(
        passive_spoof_score=verdict.passive_spoof_score,
        active_challenge_passed=verdict.active_challenge_passed,
        passed=verdict.passed,
    )


# ──────────────────────────────────────────────
# Face match
# ──────────────────────────────────────────────

@router.post("/{session_id}/face-match", response_model=FaceMatchOut)
async def face_match(
    session_id: uuid.UUID,
    selfie: UploadFile,
    document_id: uuid.UUID = Form(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> FaceMatchOut:
    enforce_rate_limit(
        key=f"face_match:{user.id}",
        limit=settings.RATE_LIMIT_FACE_MATCH_PER_HOUR,
        window_seconds=3600,
    )
    session = await _get_owned_session(db, session_id, user)
    doc = (
        await db.execute(select(Document).where(Document.id == document_id))
    ).scalar_one_or_none()
    if doc is None or doc.session_id != session.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found for this session",
        )

    doc_image = _decode_image(download_bytes(doc.storage_key))
    selfie_image = _decode_image(await selfie.read())

    doc_face = arcface_matcher.extract_single_face(doc_image)
    selfie_face = arcface_matcher.extract_single_face(selfie_image)
    outcome = arcface_matcher.match_faces(
        doc_face.embedding, selfie_face.embedding, settings.FACE_MATCH_THRESHOLD
    )

    result_row = FaceMatchResult(
        session_id=session.id,
        document_id=doc.id,
        similarity_score=outcome.similarity,
        threshold_used=outcome.threshold,
        matched=outcome.matched,
        model_version=outcome.model_version,
    )
    db.add(result_row)

    if outcome.matched:
        await session_state.transition(
            db, session, KycStatus.FACE_MATCHED, actor_id=user.id
        )
    else:
        await audit_service.record_event(
            db, session_id=session.id, actor_id=user.id,
            event_type="FACE_MATCH_FAILED",
            payload={"similarity": outcome.similarity, "threshold": outcome.threshold},
        )

    await db.commit()
    return FaceMatchOut(
        similarity_score=outcome.similarity,
        matched=outcome.matched,
        threshold_used=outcome.threshold,
        model_version=outcome.model_version,
    )


# ──────────────────────────────────────────────
# Aadhaar offline verification
# ──────────────────────────────────────────────

@router.post("/{session_id}/aadhaar-verify", response_model=AadhaarVerifyOut)
async def aadhaar_verify(
    session_id: uuid.UUID,
    aadhaar_zip: UploadFile,
    share_code: str = Form(...),
    uidai_cert: UploadFile = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AadhaarVerifyOut:
    """Verify UIDAI Offline Aadhaar XML ZIP (downloaded from myaadhaar.uidai.gov.in).
    The user provides the ZIP and the 4-digit share code they set when downloading."""
    from app.ml.aadhaar.offline_verify import verify_offline_aadhaar, InvalidOfflineAadhaarError
    session = await _get_owned_session(db, session_id, user)

    zip_bytes = await aadhaar_zip.read()

    # Load UIDAI cert: either uploaded by user or read from default path
    if uidai_cert is not None:
        cert_pem = await uidai_cert.read()
    else:
        import os
        cert_path = os.path.join(os.path.dirname(__file__), "..", "ml", "aadhaar", "uidai_cert.pem")
        if not os.path.exists(cert_path):
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="UIDAI public certificate not configured on server. Upload it as uidai_cert field.",
            )
        with open(cert_path, "rb") as f:
            cert_pem = f.read()

    try:
        result = verify_offline_aadhaar(zip_bytes, share_code, cert_pem)
    except InvalidOfflineAadhaarError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    # Cross-check name/DOB against OCR'd doc if available
    latest_doc = (
        await db.execute(
            select(Document)
            .where(Document.session_id == session.id)
            .order_by(Document.created_at.desc())
        )
    ).scalars().first()

    demographic_match = None
    if latest_doc and latest_doc.ocr_fields and result.name:
        ocr_name = (latest_doc.ocr_fields.get("name") or "").strip().lower()
        aadhaar_name = result.name.strip().lower()
        demographic_match = (ocr_name == aadhaar_name) if ocr_name else None

    verification = AadhaarVerification(
        session_id=session.id,
        verification_mode="offline_xml",
        signature_valid=result.signature_valid,
        uidai_cert_serial=result.cert_serial,
        masked_aadhaar_last4=result.masked_aadhaar_last4,
        demographic_match=demographic_match,
    )
    db.add(verification)

    await audit_service.record_event(
        db, session_id=session.id, actor_id=user.id,
        event_type="AADHAAR_VERIFIED",
        payload={
            "signature_valid": result.signature_valid,
            "demographic_match": demographic_match,
            "last4": result.masked_aadhaar_last4,
        },
    )
    await db.commit()

    return AadhaarVerifyOut(
        signature_valid=result.signature_valid,
        masked_aadhaar_last4=result.masked_aadhaar_last4,
        demographic_match=demographic_match,
    )


# ──────────────────────────────────────────────
# Risk decision
# ──────────────────────────────────────────────

@router.post("/{session_id}/risk-decision", response_model=RiskDecisionOut)
async def compute_risk_decision(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RiskDecisionOut:
    session = await _get_owned_session(db, session_id, user)

    latest_doc = (
        await db.execute(
            select(Document)
            .where(Document.session_id == session.id)
            .order_by(Document.created_at.desc())
        )
    ).scalars().first()

    latest_face_match = (
        await db.execute(
            select(FaceMatchResult)
            .where(FaceMatchResult.session_id == session.id)
            .order_by(FaceMatchResult.created_at.desc())
        )
    ).scalars().first()

    latest_liveness = (
        await db.execute(
            select(LivenessAttempt)
            .where(LivenessAttempt.session_id == session.id)
            .order_by(LivenessAttempt.attempted_at.desc())
        )
    ).scalars().first()

    aadhaar = (
        await db.execute(
            select(AadhaarVerification)
            .where(AadhaarVerification.session_id == session.id)
        )
    ).scalars().first()

    if latest_face_match is None or latest_liveness is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Liveness and face-match must both complete before risk decision",
        )

    signals = risk_engine.RiskSignals(
        face_match_similarity=float(latest_face_match.similarity_score),
        liveness_passed=latest_liveness.passed,
        doc_forgery_score=float(latest_doc.forgery_score or 0.0) if latest_doc else 0.0,
        aadhaar_signature_valid=aadhaar.signature_valid if aadhaar else None,
    )
    result = risk_engine.compute_risk(signals, settings)

    decision_row = RiskDecision(
        session_id=session.id,
        composite_score=result.composite_score,
        signal_breakdown=result.breakdown,
        decision=result.decision,
    )
    db.add(decision_row)

    target_status = {
        "APPROVED": KycStatus.APPROVED,
        "REJECTED": KycStatus.REJECTED,
        "MANUAL_REVIEW": KycStatus.MANUAL_REVIEW,
    }[result.decision]

    session.status = KycStatus.RISK_SCORED
    await session_state.transition(
        db, session, target_status,
        actor_id=user.id, reason=result.breakdown,
    )
    await db.commit()

    return RiskDecisionOut(
        composite_score=result.composite_score,
        decision=result.decision,
        breakdown=result.breakdown,
    )
