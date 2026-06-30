# KYC Platform Phase 1 Monorepo

Production-track eKYC platform. See `docs/ARCHITECTURE.md` for the full
design, ADRs, and the **free-tier-only service ledger**.

## Layout

```
backend/     FastAPI app — auth, kyc session state machine, ML services, audit trail
frontend/    Next.js + TypeScript — custom design system, no template defaults
infra/       docker-compose for local dev (Postgres, MinIO, backend, frontend)
docs/        Architecture, ADRs, threat model (Phase 2)
```

## What's implemented in this scaffold

- ✅ Full DB schema (`backend/migrations/0001_init.sql`) + matching ORM models
- ✅ Strict KYC session state machine (ADR-001), enforced server-side
- ✅ Hash-chained, append-only audit trail (`audit_service.py`) with integrity
  verification function
- ✅ ArcFace face matching module (replaces old FaceNet approach — ADR-003)
- ✅ Liveness service: active challenge-response wired end-to-end; **passive
  anti-spoof model call is an explicit `NotImplementedError` stub** — wire
  MiniFASNet ONNX weights before enabling outside local dev (a silent fake
  pass-value here would be a real security hole, so it's loud instead)
- ✅ PaddleOCR-based Indian document classification + field extraction (PAN
  regex+checksum-style validation working; Aadhaar/passport extraction
  scaffolded)
- ✅ UIDAI Offline Aadhaar XML signature verification (ADR-002) — cryptographic
  verification logic complete; needs the current UIDAI public cert PEM
  fetched at deploy time
- ✅ Risk decision engine with auditable weighted scoring
- ✅ JWT auth (RS256) with RBAC (customer/reviewer/admin)
- ✅ Rate limiting on face-match (in-memory — flagged as needing Redis before
  multi-instance deploy)
- ✅ Object storage abstraction (MinIO/S3-compatible) — no raw biometric bytes
  ever touch the DB
- ✅ Unit tests for risk engine + PAN validation
- ✅ Custom frontend design tokens + a real state-machine-driven pipeline
  component + typed API client

## What's intentionally NOT done yet (tracked, not hidden)

- Passive anti-spoof model wiring (needs MiniFASNet ONNX weights)
- Document forgery/tamper CNN (v1.1 — needs labeled training data)
- Reviewer console UI (manual-review queue) — backend supports the state,
  frontend page not yet built
- OpenSanctions/PEP screening integration
- Redis-backed rate limiting + challenge cache for multi-instance deploy
- Alembic migration wiring (raw SQL DDL provided as the canonical reference;
  generate the initial Alembic revision from it)
- CI/CD pipeline (ruff/mypy/pytest gates, frontend typecheck/lint)
- Threat model document (STRIDE) — architecture doc has the security section,
  full STRIDE pass is the next deliverable

## Local dev

```bash
cd infra
docker compose up --build
# backend:  http://localhost:8000/api/docs
# frontend: http://localhost:3000
# minio console: http://localhost:9001
```

Run backend tests:
```bash
cd backend
pip install -r requirements.txt --break-system-packages
pytest app/tests -v
```
