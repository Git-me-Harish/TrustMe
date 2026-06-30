"""
Risk decision engine — combines every independent signal into one composite
score and a discrete decision. Weighted-sum is deliberately simple and
auditable for v1 (a regulator/reviewer can recompute it by hand from
signal_breakdown); a learned risk model is a v2 consideration once there's
labeled outcome data to train against, and even then the weighted baseline
stays as a fallback/sanity-check path.
"""
from dataclasses import dataclass

from app.core.config import Settings


@dataclass(frozen=True)
class RiskSignals:
    face_match_similarity: float       # 0..1 (clamp negative cosine to 0)
    liveness_passed: bool
    doc_forgery_score: float           # 0=clean, 1=forged
    aadhaar_signature_valid: bool | None  # None if Aadhaar step skipped


@dataclass(frozen=True)
class RiskDecisionResult:
    composite_score: float
    decision: str  # APPROVED | REJECTED | MANUAL_REVIEW
    breakdown: dict


def compute_risk(signals: RiskSignals, settings: Settings) -> RiskDecisionResult:
    liveness_component = 1.0 if signals.liveness_passed else 0.0
    forgery_component = 1.0 - signals.doc_forgery_score
    face_component = max(0.0, signals.face_match_similarity)

    # Aadhaar step is optional in v1 (not every doc_type requires it) — if
    # skipped, redistribute its weight proportionally rather than scoring it
    # as zero, which would unfairly penalize sessions that legitimately don't
    # use Aadhaar (e.g. passport-only onboarding).
    if signals.aadhaar_signature_valid is None:
        total_weight = (
            settings.RISK_WEIGHT_FACE_MATCH
            + settings.RISK_WEIGHT_LIVENESS
            + settings.RISK_WEIGHT_DOC_FORGERY
        )
        composite = (
            face_component * settings.RISK_WEIGHT_FACE_MATCH
            + liveness_component * settings.RISK_WEIGHT_LIVENESS
            + forgery_component * settings.RISK_WEIGHT_DOC_FORGERY
        ) / total_weight
        aadhaar_component = None
    else:
        aadhaar_component = 1.0 if signals.aadhaar_signature_valid else 0.0
        composite = (
            face_component * settings.RISK_WEIGHT_FACE_MATCH
            + liveness_component * settings.RISK_WEIGHT_LIVENESS
            + forgery_component * settings.RISK_WEIGHT_DOC_FORGERY
            + aadhaar_component * settings.RISK_WEIGHT_AADHAAR_VERIFY
        )

    if composite >= settings.RISK_AUTO_APPROVE_THRESHOLD:
        decision = "APPROVED"
    elif composite <= settings.RISK_AUTO_REJECT_THRESHOLD:
        decision = "REJECTED"
    else:
        decision = "MANUAL_REVIEW"

    return RiskDecisionResult(
        composite_score=round(composite, 4),
        decision=decision,
        breakdown={
            "face_match": round(face_component, 4),
            "liveness": liveness_component,
            "doc_forgery_inverse": round(forgery_component, 4),
            "aadhaar_verify": aadhaar_component,
        },
    )
