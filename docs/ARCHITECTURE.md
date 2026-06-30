# KYC Platform — Architecture (v1)

## 1. Scope (Phase 1)

A production-realistic eKYC platform covering, end-to-end:
1. Document capture, classification, OCR field extraction
2. Document forensics (basic tamper/screenshot heuristics — v1.1)
3. Liveness detection (active challenge-response + passive anti-spoof)
4. Face match (document photo vs live selfie) using ArcFace embeddings
5. Aadhaar **Offline e-KYC** XML/QR signature verification (legally accessible
   without AUA/KUA licensing — see ADR-002)
6. PAN structural + checksum validation (no paid NSDL API in v1)
7. Risk scoring → decision engine (auto-approve / auto-reject / manual review)
8. Immutable audit trail for every verification event
9. Reviewer console for manual-review queue (v1.1, stub routes in v1)

Out of scope for v1 (flagged, not silently dropped): live UIDAI OTP-based
Aadhaar API (requires AUA/KUA license — not obtainable by an individual/SMB
without RBI/UIDAI registration), paid PAN NSDL API, full sanctions screening
(OpenSanctions integration stubbed for v1.1).

## 2. Style: Modular Monolith

Per system-design defaults: a regulated, security-sensitive domain like KYC
with a small team should NOT start as microservices. Reasons:
- Single source of truth for the audit trail (cross-service distributed
  transactions for compliance records is a liability, not a feature)
- ML inference is the only component that benefits from independent scaling
  → isolate it behind an internal service boundary (`app/ml/*`) so it CAN be
  extracted into its own deployable later without a rewrite.

Module boundaries (each owns its data, communicates via service layer, not
direct cross-module ORM queries):

- `auth` — users, sessions, JWT, RBAC (customer / reviewer / admin)
- `kyc` — verification sessions, document records, decisions
- `ml` — face match, liveness, OCR, Aadhaar verify (pure functions / classes,
  no DB access — testable in isolation)
- `audit` — append-only event log, hash-chained for tamper-evidence
- `risk` — scoring engine, configurable rule weights

## 3. Data flow (happy path)

```
Client (Next.js)
  │ 1. POST /sessions                       → create KycSession (status=INITIATED)
  │ 2. POST /sessions/{id}/document          → upload ID doc image
  │      → OCR + classify + extract fields   → DocumentRecord
  │ 3. POST /sessions/{id}/liveness/challenge → server issues random challenge seq
  │ 4. POST /sessions/{id}/liveness/verify   → client streams frames/video
  │      → passive anti-spoof + active challenge validation → LivenessResult
  │ 5. POST /sessions/{id}/face-match        → live frame vs doc photo
  │      → ArcFace embedding cosine similarity → FaceMatchResult
  │ 6. POST /sessions/{id}/aadhaar-verify (optional)
  │      → verify offline XML/QR signature against UIDAI public cert → AadhaarVerifyResult
  │ 7. Risk engine combines all signals → composite score → Decision
  │ 8. Every step writes an AuditEvent (hash-chained)        → immutable record
  └ 9. GET /sessions/{id}/status            → final decision + evidence refs
```

## 4. Data model (see migrations/0001_init.sql for full DDL)

Core entities: `users`, `kyc_sessions`, `documents`, `liveness_attempts`,
`face_match_results`, `aadhaar_verifications`, `audit_events`, `risk_decisions`.

Key design choices:
- `kyc_sessions.status` is a strict state machine (see ADR-001)
- All biometric artifacts (selfie frames, doc images) are stored as encrypted
  blobs in object storage; DB stores only references + hashes, never raw
  images inline — minimizes blast radius of a DB-only breach
- `audit_events` is append-only (`INSERT`-only, enforced via DB role
  permissions, not just app logic) with a `prev_hash` column forming a hash
  chain — any retroactive edit becomes detectable

## 5. Security & compliance (non-negotiable from day 1)

- Consent capture is a first-class entity (`consent_records`) — GDPR/RBI
  Master Direction both require explicit, logged consent before biometric
  processing
- Data retention: KYC evidence retained per RBI's prescribed period (currently
  5 years from relationship end) — implemented as a retention policy column +
  scheduled purge job, not a manual process
- PII encryption at rest (DB column-level for sensitive fields, object-store
  server-side encryption for media)
- Rate limiting on all verification endpoints (anti-bruteforce on face match
  attempts — a real fraud vector)
- STRIDE summary: see `docs/THREAT_MODEL.md` (Phase 2 deliverable)

## 6. ADRs

### ADR-001: Strict session state machine
**Decision**: `kyc_sessions.status` transitions are enforced server-side via
an explicit allowed-transition map, not free-form string writes.
States: `INITIATED → DOC_UPLOADED → DOC_VERIFIED → LIVENESS_PASSED →
FACE_MATCHED → RISK_SCORED → APPROVED|REJECTED|MANUAL_REVIEW`.
**Why**: KYC is exactly the kind of regulated flow where "how did this get
approved without a face match" must be structurally impossible, not just
"shouldn't happen."

### ADR-002: Offline Aadhaar over live UIDAI API
**Context**: Live Aadhaar OTP/biometric e-KYC APIs require becoming a
licensed KUA (KYC User Agency) via a Sub-KUA agreement with an existing AUA —
a regulatory process, not an API signup.
**Decision**: Use UIDAI's publicly downloadable Offline e-KYC (XML or
Secure QR), which any resident can generate from the UIDAI portal, and which
is independently verifiable by anyone using UIDAI's published verification
certificate — no licensing required, and it's the same cryptographic trust
root as the online flow.
**Consequence**: Marked clearly in the product as "Offline Aadhaar
Verification" — accurate labeling, not a workaround presented as something
it isn't.

### ADR-003: ArcFace over FaceNet/InceptionResnetV1
**Context**: Existing repo uses VGGFace2-trained InceptionResnetV1 + raw L2
distance.
**Decision**: Use ArcFace (InsightFace, buffalo_l model pack) embeddings +
cosine similarity with a calibrated threshold.
**Why**: ArcFace's angular margin loss produces materially tighter
intra-class clustering and wider inter-class margins than softmax/triplet
FaceNet-style training — directly reduces false-accept rate, which is the
metric that matters for a security control. Free, open weights, ONNX
runtime — no inference cost.

## 7. Free-tier-only constraint — explicit ledger

| Capability | Service | Cost |
|---|---|---|
| Face detect/embed | InsightFace (self-hosted, open weights) | $0 |
| Liveness | Silent-Face-Anti-Spoofing (self-hosted) | $0 |
| OCR | PaddleOCR (self-hosted) | $0 |
| Aadhaar verify | UIDAI public cert, offline XML/QR | $0 |
| Sanctions check | OpenSanctions free tier | $0 (rate-limited) |
| Object storage | MinIO (self-hosted, S3-compatible) for dev; swap for
  free-tier S3/GCS bucket in deploy | $0 in dev |

No paid SaaS API is required anywhere in the v1 pipeline.
