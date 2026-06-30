"""
Face embedding + matching via InsightFace's ArcFace (buffalo_l pack).
ADR-003: replaces the repo's original FaceNet/InceptionResnetV1 + raw L2
distance. Pure-function module — no DB access, fully unit-testable, and
swappable behind this interface if a better open model appears later.

Free / self-hosted: model weights download once (InsightFace model zoo),
inference runs on CPU (ONNXRuntime) — no per-call API cost.
"""
from dataclasses import dataclass
from functools import lru_cache

import numpy as np

try:
    import insightface
    from insightface.app import FaceAnalysis
except ImportError:  # pragma: no cover - allows import in environments mid-setup
    insightface = None
    FaceAnalysis = None


MODEL_VERSION = "arcface-buffalo_l-v1"


@dataclass(frozen=True)
class FaceDetection:
    embedding: np.ndarray          # 512-d ArcFace embedding, L2-normalized
    bbox: tuple[float, float, float, float]
    detection_score: float


@dataclass(frozen=True)
class FaceMatchOutcome:
    similarity: float
    matched: bool
    threshold: float
    model_version: str = MODEL_VERSION


class NoFaceDetectedError(Exception):
    pass


class MultipleFacesDetectedError(Exception):
    """Selfie/document frame contains >1 face — reject rather than guess
    which one is the subject. A real fraud vector (photo-of-a-photo with a
    second person, or a held-up second ID) — never silently pick [0]."""


@lru_cache(maxsize=1)
def _get_face_app() -> "FaceAnalysis":
    if FaceAnalysis is None:
        raise RuntimeError(
            "insightface is not installed. `pip install insightface onnxruntime`."
        )
    app = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(640, 640))
    return app


def extract_single_face(image_bgr: np.ndarray) -> FaceDetection:
    """Detect+embed the single dominant face in an image. Raises if zero or
    multiple faces are found — callers must handle both as user-facing errors,
    not edge cases to swallow."""
    app = _get_face_app()
    faces = app.get(image_bgr)

    if len(faces) == 0:
        raise NoFaceDetectedError("No face detected in frame.")
    if len(faces) > 1:
        raise MultipleFacesDetectedError(f"{len(faces)} faces detected; expected exactly 1.")

    face = faces[0]
    embedding = face.normed_embedding.astype(np.float32)
    return FaceDetection(
        embedding=embedding,
        bbox=tuple(face.bbox.tolist()),
        detection_score=float(face.det_score),
    )


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    # Embeddings are already L2-normalized by InsightFace, but normalize
    # defensively — silent drift here is the kind of bug that only shows up
    # as a slowly rising false-accept rate in prod, weeks later.
    a_n = a / (np.linalg.norm(a) + 1e-9)
    b_n = b / (np.linalg.norm(b) + 1e-9)
    return float(np.dot(a_n, b_n))


def match_faces(
    document_face: np.ndarray,
    live_face: np.ndarray,
    threshold: float,
) -> FaceMatchOutcome:
    similarity = cosine_similarity(document_face, live_face)
    return FaceMatchOutcome(similarity=similarity, matched=similarity >= threshold, threshold=threshold)
