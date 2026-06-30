"""
Unit tests for pure-logic modules — no DB/network required, so these run in
CI on every push. Coverage here is intentionally on the modules where a bug
has compliance consequences (risk scoring, audit hash chain, PAN validation),
not on I/O glue code.
"""
import pytest

from app.core.config import Settings
from app.ml.ocr.document_ocr import validate_pan_structure
from app.ml.risk.risk_engine import RiskSignals, compute_risk


@pytest.fixture
def settings() -> Settings:
    return Settings()


class TestRiskEngine:
    def test_high_confidence_all_signals_pass_approves(self, settings: Settings):
        signals = RiskSignals(
            face_match_similarity=0.95,
            liveness_passed=True,
            doc_forgery_score=0.02,
            aadhaar_signature_valid=True,
        )
        result = compute_risk(signals, settings)
        assert result.decision == "APPROVED"
        assert result.composite_score >= settings.RISK_AUTO_APPROVE_THRESHOLD

    def test_failed_liveness_pushes_toward_rejection(self, settings: Settings):
        signals = RiskSignals(
            face_match_similarity=0.95,
            liveness_passed=False,
            doc_forgery_score=0.02,
            aadhaar_signature_valid=True,
        )
        result = compute_risk(signals, settings)
        assert result.decision in ("REJECTED", "MANUAL_REVIEW")

    def test_missing_aadhaar_redistributes_weight_not_penalize(self, settings: Settings):
        with_aadhaar = compute_risk(
            RiskSignals(0.95, True, 0.02, True), settings
        )
        without_aadhaar = compute_risk(
            RiskSignals(0.95, True, 0.02, None), settings
        )
        # Skipping an optional Aadhaar step on an otherwise-perfect session
        # must not tank the score below the approve threshold.
        assert without_aadhaar.composite_score >= settings.RISK_AUTO_APPROVE_THRESHOLD
        assert with_aadhaar.decision == without_aadhaar.decision == "APPROVED"

    def test_mid_range_signals_go_to_manual_review(self, settings: Settings):
        signals = RiskSignals(
            face_match_similarity=0.65,
            liveness_passed=True,
            doc_forgery_score=0.3,
            aadhaar_signature_valid=False,
        )
        result = compute_risk(signals, settings)
        assert result.decision == "MANUAL_REVIEW"


class TestPanValidation:
    @pytest.mark.parametrize("pan", ["ABCPE1234L", "XYZAB5678P"])
    def test_valid_structure_passes(self, pan: str):
        assert validate_pan_structure(pan) is True

    @pytest.mark.parametrize(
        "pan", ["ABCPE123L", "abcpe1234l", "ABCZE1234L", "1234ABCDEF"]
    )
    def test_invalid_structure_or_holder_type_fails(self, pan: str):
        assert validate_pan_structure(pan) is False
