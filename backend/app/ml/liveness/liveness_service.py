"""
Liveness detection — two independent signals, both required to pass:

1. PASSIVE anti-spoof: texture/frequency-domain cues that distinguish a real
   face from a printed photo, screen replay, or mask (Silent-Face-Anti-Spoofing
   / MiniFASNet — self-hosted, CPU-capable, no API cost).
2. ACTIVE challenge-response: server issues a randomized action sequence
   (blink / turn_left / turn_right / smile), client must perform it within a
   time window — defeats pre-recorded video replay attacks that a passive
   model alone can miss.

Both checks are necessary, neither is sufficient alone: passive-only is
beatable with a good replay; active-only is beatable with a deepfake that
can "perform" the challenge.
"""
import random
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import numpy as np

CHALLENGE_POOL = ["blink", "turn_left", "turn_right", "smile", "open_mouth"]
CHALLENGE_LENGTH = 3
CHALLENGE_TTL_SECONDS = 30


@dataclass(frozen=True)
class LivenessChallenge:
    token: str
    sequence: list[str]
    expires_at: datetime


@dataclass(frozen=True)
class LivenessVerdict:
    passive_spoof_score: float   # 0 = live, 1 = spoof
    active_challenge_passed: bool
    passed: bool


def issue_challenge() -> LivenessChallenge:
    """Randomized per attempt — never reuse a sequence, or it becomes
    replayable from a previous session's recording."""
    sequence = random.sample(CHALLENGE_POOL, k=CHALLENGE_LENGTH)
    return LivenessChallenge(
        token=secrets.token_urlsafe(24),
        sequence=sequence,
        expires_at=datetime.now(timezone.utc) + timedelta(seconds=CHALLENGE_TTL_SECONDS),
    )


def is_challenge_expired(challenge: LivenessChallenge) -> bool:
    return datetime.now(timezone.utc) > challenge.expires_at


def score_passive_antispoof(face_crop_bgr: np.ndarray, *, allow_dev_stub: bool = False) -> float:
    """
    Returns spoof probability in [0, 1]. Production wiring: MiniFASNet ONNX
    model over the cropped face region.

    `allow_dev_stub` must be explicitly passed True by the caller (wired to
    settings.ENV != "production" — see router) to get a placeholder score.
    This is NOT anti-spoofing — it always reports "live" so the pipeline is
    clickable end-to-end during development. It must never be enabled
    outside local dev; the default is False specifically so this can't be
    silently left on by omission.
    """
    if not allow_dev_stub:
        raise NotImplementedError(
            "Wire MiniFASNet ONNX inference here before enabling liveness in any "
            "environment that isn't local dev with allow_dev_stub=True."
        )
    return 0.05  # well below default threshold -> reports as "live"


def evaluate_active_challenge(performed_sequence: list[str], expected_sequence: list[str]) -> bool:
    """Exact order match. Per-action detection (blink/turn/smile) is done by
    a landmark-tracking module upstream (MediaPipe FaceMesh) that converts
    raw frames into this discrete action list — kept separate so this
    function stays pure and trivially testable."""
    return performed_sequence == expected_sequence


def evaluate_liveness(
    *,
    passive_spoof_score: float,
    performed_sequence: list[str],
    expected_sequence: list[str],
    spoof_threshold: float,
) -> LivenessVerdict:
    active_passed = evaluate_active_challenge(performed_sequence, expected_sequence)
    passive_passed = passive_spoof_score < spoof_threshold
    return LivenessVerdict(
        passive_spoof_score=passive_spoof_score,
        active_challenge_passed=active_passed,
        passed=active_passed and passive_passed,
    )
