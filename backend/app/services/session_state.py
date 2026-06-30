"""
Session state machine. This is the ONLY place that writes kyc_sessions.status.
Routers/other services call `transition()`; they never set `.status` directly
on the model — that's how ADR-001 stays enforced rather than aspirational.
"""
import uuid

from fastapi import HTTPException, status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.kyc import ALLOWED_TRANSITIONS, KycSession, KycStatus
from app.services import audit_service


class InvalidTransitionError(Exception):
    pass


async def transition(
    db: AsyncSession,
    session: KycSession,
    new_status: KycStatus,
    *,
    actor_id: uuid.UUID | None,
    reason: dict | None = None,
) -> KycSession:
    current = KycStatus(session.status)
    allowed = ALLOWED_TRANSITIONS.get(current, set())

    if new_status not in allowed:
        # Logged even on rejection — attempted invalid transitions are a
        # signal worth keeping (bug, or someone probing the API).
        await audit_service.record_event(
            db,
            session_id=session.id,
            actor_id=actor_id,
            event_type="INVALID_TRANSITION_ATTEMPTED",
            payload={"from": current.value, "to": new_status.value},
        )
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail=f"Cannot transition KYC session from {current.value} to {new_status.value}",
        )

    session.status = new_status
    await audit_service.record_event(
        db,
        session_id=session.id,
        actor_id=actor_id,
        event_type="STATUS_TRANSITION",
        payload={"from": current.value, "to": new_status.value, "reason": reason or {}},
    )
    await db.flush()
    return session
