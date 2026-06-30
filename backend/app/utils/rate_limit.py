"""
Sliding-window rate limiter. In-memory for single-process dev — explicitly
NOT safe across multiple uvicorn workers/instances; swap for a Redis-backed
token bucket (see TODO) before scaling out. Face-match is the one endpoint
where rate limiting is a real security control, not just an abuse guard:
unlimited attempts let an attacker brute-force the similarity threshold with
slightly different photos.
"""
import time
from collections import defaultdict

from fastapi import HTTPException, status

_WINDOWS: dict[str, list[float]] = defaultdict(list)

# TODO(v1.1): replace with Redis `INCR` + `EXPIRE` for multi-instance safety.


def enforce_rate_limit(*, key: str, limit: int, window_seconds: int) -> None:
    now = time.monotonic()
    timestamps = _WINDOWS[key]
    cutoff = now - window_seconds
    while timestamps and timestamps[0] < cutoff:
        timestamps.pop(0)

    if len(timestamps) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded: {limit} attempts per {window_seconds}s",
        )
    timestamps.append(now)
