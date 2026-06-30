"""
Document OCR + structured field extraction for Indian OVDs (Officially Valid
Documents): Aadhaar, PAN, Passport, Driving License.

Engine: PaddleOCR (self-hosted, free, no per-call cost). This module owns
classification (which doc type is this?) + regex/positional field parsing —
PaddleOCR gives raw text+boxes, everything semantic is ours.
"""
import re
from dataclasses import dataclass, field

import numpy as np

try:
    from paddleocr import PaddleOCR
except ImportError:  # pragma: no cover
    PaddleOCR = None

from functools import lru_cache

# PAN structure: AAAAA9999A (5 letters, 4 digits, 1 letter) — per Income Tax
# Dept spec. 4th character encodes holder type (P=individual, C=company, etc).
PAN_REGEX = re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b")

# Aadhaar: 12 digits, never starts with 0 or 1, conventionally space-grouped 4-4-4
AADHAAR_REGEX = re.compile(r"\b[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b")

DOB_REGEX = re.compile(r"\b(\d{2}[/-]\d{2}[/-]\d{4})\b")


@dataclass
class ExtractedFields:
    doc_type: str
    raw_text_blocks: list[str] = field(default_factory=list)
    name: str | None = None
    dob: str | None = None
    doc_number: str | None = None
    address: str | None = None
    confidence: float = 0.0


@lru_cache(maxsize=1)
def _get_ocr_engine() -> "PaddleOCR":
    if PaddleOCR is None:
        raise RuntimeError("paddleocr not installed. `pip install paddleocr paddlepaddle`.")
    return PaddleOCR(use_angle_cls=True, lang="en", show_log=False)


def run_ocr(image_bgr: np.ndarray) -> tuple[list[str], float]:
    """Returns extracted text lines + mean detection confidence."""
    engine = _get_ocr_engine()
    result = engine.ocr(image_bgr, cls=True)
    if not result or not result[0]:
        return [], 0.0

    lines, confidences = [], []
    for line in result[0]:
        text, conf = line[1][0], line[1][1]
        lines.append(text)
        confidences.append(conf)

    mean_conf = sum(confidences) / len(confidences) if confidences else 0.0
    return lines, mean_conf


def classify_document(text_lines: list[str]) -> str:
    """Keyword + structural heuristic classifier. A learned classifier
    (small CNN on doc layout) is the v1.1 upgrade once labeled samples exist;
    keyword heuristics are deliberately transparent and debuggable for v1."""
    joined = " ".join(text_lines).upper()

    if "GOVERNMENT OF INDIA" in joined and AADHAAR_REGEX.search(joined):
        return "aadhaar"
    if "INCOME TAX DEPARTMENT" in joined or PAN_REGEX.search(joined):
        return "pan"
    if "REPUBLIC OF INDIA" in joined and "PASSPORT" in joined:
        return "passport"
    if "DRIVING LICENCE" in joined or "DRIVING LICENSE" in joined:
        return "driving_license"
    return "unknown"


def extract_fields(image_bgr: np.ndarray) -> ExtractedFields:
    text_lines, confidence = run_ocr(image_bgr)
    doc_type = classify_document(text_lines)
    joined = " ".join(text_lines)

    doc_number = None
    if doc_type == "pan":
        m = PAN_REGEX.search(joined.upper())
        doc_number = m.group(0) if m else None
    elif doc_type == "aadhaar":
        m = AADHAAR_REGEX.search(joined)
        doc_number = m.group(0) if m else None

    dob_match = DOB_REGEX.search(joined)

    return ExtractedFields(
        doc_type=doc_type,
        raw_text_blocks=text_lines,
        dob=dob_match.group(0) if dob_match else None,
        doc_number=doc_number,
        confidence=confidence,
    )


def validate_pan_structure(pan: str) -> bool:
    """Structural + checksum-style validation only (no live NSDL API call —
    see ARCHITECTURE.md, out of scope for v1). 4th letter holder-type check
    catches a common forgery pattern: mismatched holder-type code."""
    if not PAN_REGEX.fullmatch(pan):
        return False
    valid_holder_types = set("ABCFGHLJPT")  # Assoc, Body, Co, Firm, Govt, HUF, Local, Juridical, Person, Trust
    return pan[3] in valid_holder_types
