"""
Reviewer console — routes accessible only to reviewer/admin roles.
Handles the MANUAL_REVIEW queue: list pending sessions, approve or reject
with notes, and pull audit trails for compliance review.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.db.session import get_db
from app.models.kyc import KycSession, KycStatus, RiskDecision, User
from app.schemas.kyc_schemas import KycSessionOut, ReviewDecisionIn, RiskDecisionOut
from app.services import audit_service, session_state

router = APIRouter(prefix="/api/v1/reviewer", tags=["reviewer"])


@router.get("/queue", response_model=list[KycSessionOut])
async def list_manual_review_queue(
    db: AsyncSession = Depends(get_db),
    reviewer: User = Depends(require_role("reviewer", "admin")),
) -> list[KycSession]:
    """All sessions currently awaiting manual review, oldest first."""
    rows = (
        await db.execute(
            select(KycSession)
            .where(KycSession.status == KycStatus.MANUAL_REVIEW)
            .order_by(KycSession.created_at.asc())
        )
    ).scalars().all()
    return list(rows)


@router.get("/queue/{session_id}/detail")
async def get_session_detail(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    reviewer: User = Depends(require_role("reviewer", "admin")),
) -> dict:
    """Full detail for a single session: status, risk breakdown, OCR fields,
    and the last risk decision record — everything a reviewer needs to decide."""
    from app.models.kyc import Document, FaceMatchResult, LivenessAttempt, AadhaarVerification

    session = (
        await db.execute(select(KycSession).where(KycSession.id == session_id))
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    latest_doc = (
        await db.execute(
            select(Document)
            .where(Document.session_id == session_id)
            .order_by(Document.created_at.desc())
        )
    ).scalars().first()

    risk = (
        await db.execute(
            select(RiskDecision).where(RiskDecision.session_id == session_id)
        )
    ).scalar_one_or_none()

    face_match = (
        await db.execute(
            select(FaceMatchResult)
            .where(FaceMatchResult.session_id == session_id)
            .order_by(FaceMatchResult.created_at.desc())
        )
    ).scalars().first()

    liveness = (
        await db.execute(
            select(LivenessAttempt)
            .where(LivenessAttempt.session_id == session_id)
            .order_by(LivenessAttempt.attempted_at.desc())
        )
    ).scalars().first()

    aadhaar = (
        await db.execute(
            select(AadhaarVerification)
            .where(AadhaarVerification.session_id == session_id)
        )
    ).scalars().first()

    return {
        "session": {
            "id": str(session.id),
            "status": session.status,
            "doc_type": session.doc_type,
            "region": session.region,
            "created_at": session.created_at.isoformat(),
        },
        "document": {
            "doc_type": latest_doc.doc_type if latest_doc else None,
            "ocr_fields": latest_doc.ocr_fields if latest_doc else None,
            "ocr_confidence": float(latest_doc.ocr_confidence or 0) if latest_doc else None,
            "forgery_score": float(latest_doc.forgery_score or 0) if latest_doc else None,
        },
        "face_match": {
            "similarity_score": float(face_match.similarity_score) if face_match else None,
            "matched": face_match.matched if face_match else None,
            "model_version": face_match.model_version if face_match else None,
        },
        "liveness": {
            "passed": liveness.passed if liveness else None,
            "passive_spoof_score": float(liveness.passive_spoof_score or 0) if liveness else None,
            "active_challenge_passed": liveness.active_challenge_passed if liveness else None,
        },
        "aadhaar": {
            "signature_valid": aadhaar.signature_valid if aadhaar else None,
            "demographic_match": aadhaar.demographic_match if aadhaar else None,
        },
        "risk": {
            "composite_score": float(risk.composite_score) if risk else None,
            "decision": risk.decision if risk else None,
            "breakdown": risk.signal_breakdown if risk else None,
        },
    }


@router.post("/queue/{session_id}/decide", response_model=KycSessionOut)
async def reviewer_decide(
    session_id: uuid.UUID,
    payload: ReviewDecisionIn,
    db: AsyncSession = Depends(get_db),
    reviewer: User = Depends(require_role("reviewer", "admin")),
) -> KycSession:
    """Approve or reject a MANUAL_REVIEW session with optional notes."""
    session = (
        await db.execute(select(KycSession).where(KycSession.id == session_id))
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if KycStatus(session.status) != KycStatus.MANUAL_REVIEW:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Session is {session.status}, not MANUAL_REVIEW — cannot decide",
        )

    if payload.decision not in ("APPROVED", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="decision must be APPROVED or REJECTED",
        )

    # Update the existing risk_decisions row with reviewer override
    risk = (
        await db.execute(
            select(RiskDecision).where(RiskDecision.session_id == session_id)
        )
    ).scalar_one_or_none()
    if risk:
        risk.decision = payload.decision
        risk.decided_by = str(reviewer.id)
        risk.reviewer_notes = payload.notes

    target = KycStatus.APPROVED if payload.decision == "APPROVED" else KycStatus.REJECTED
    await session_state.transition(
        db, session, target,
        actor_id=reviewer.id,
        reason={"reviewer_decision": payload.decision, "notes": payload.notes},
    )
    await db.commit()
    return session
