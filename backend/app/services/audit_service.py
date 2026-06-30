"""
Audit trail service. Every state-changing action in the platform MUST go
through `record_event` — never insert into audit_events anywhere else, or
the hash chain breaks.

Hash chain: row_hash = sha256(prev_hash || event_type || canonical_json(payload) || created_at_iso)
Tamper-evidence works because changing any historical row invalidates every
row_hash computed after it — a cheap, DB-only alternative to a full ledger
when you don't need multi-party consensus (you control the one DB).
"""
import hashlib
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.kyc import AuditEvent

GENESIS_HASH = "0" * 64


async def _get_last_hash(db: AsyncSession, session_id: uuid.UUID | None) -> str:
    stmt = (
        select(AuditEvent.row_hash)
        .where(AuditEvent.session_id == session_id)
        .order_by(AuditEvent.id.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    row = result.scalar_one_or_none()
    return row or GENESIS_HASH


def _compute_row_hash(prev_hash: str, event_type: str, payload: dict, created_at: datetime) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    blob = f"{prev_hash}|{event_type}|{canonical}|{created_at.isoformat()}"
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


async def record_event(
    db: AsyncSession,
    *,
    session_id: uuid.UUID | None,
    actor_id: uuid.UUID | None,
    event_type: str,
    payload: dict,
) -> AuditEvent:
    """Append a tamper-evident audit event. Caller is responsible for commit
    (kept in the same transaction as the state-changing operation it logs,
    so a rollback never leaves an orphaned audit entry)."""
    prev_hash = await _get_last_hash(db, session_id)
    created_at = datetime.now(timezone.utc)
    row_hash = _compute_row_hash(prev_hash, event_type, payload, created_at)

    event = AuditEvent(
        session_id=session_id,
        actor_id=actor_id,
        event_type=event_type,
        event_payload=payload,
        prev_hash=prev_hash,
        row_hash=row_hash,
        created_at=created_at,
    )
    db.add(event)
    await db.flush()
    return event


async def verify_chain_integrity(db: AsyncSession, session_id: uuid.UUID) -> bool:
    """Recompute the chain for a session and confirm no row has been altered.
    Use in compliance audits / before releasing evidence to a regulator."""
    stmt = (
        select(AuditEvent)
        .where(AuditEvent.session_id == session_id)
        .order_by(AuditEvent.id.asc())
    )
    rows = (await db.execute(stmt)).scalars().all()

    expected_prev = GENESIS_HASH
    for row in rows:
        if row.prev_hash != expected_prev:
            return False
        recomputed = _compute_row_hash(row.prev_hash, row.event_type, row.event_payload, row.created_at)
        if recomputed != row.row_hash:
            return False
        expected_prev = row.row_hash
    return True
