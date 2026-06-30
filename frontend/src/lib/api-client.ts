/**
 * Typed API client. Every backend call goes through here so auth-header
 * injection, error normalization, and base-URL config live in one place.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────

export interface KycSession {
  id: string;
  status: string;
  doc_type: string | null;
  region: string;
  created_at: string;
}

export interface LivenessChallenge {
  token: string;
  sequence: string[];
  expires_at: string;
}

export interface RiskDecision {
  composite_score: number;
  decision: "APPROVED" | "REJECTED" | "MANUAL_REVIEW";
  breakdown: Record<string, number | null>;
}

export interface AuditEvent {
  id: number;
  event_type: string;
  event_payload: Record<string, unknown>;
  row_hash: string;
  created_at: string;
  chain_integrity: boolean;
}

// ── API methods ────────────────────────────────────────────────────────────

export const kycApi = {
  // Session lifecycle
  createSession: () =>
    request<KycSession>("/api/v1/sessions", { method: "POST" }),

  listSessions: () =>
    request<KycSession[]>("/api/v1/sessions"),

  getSession: (id: string) =>
    request<KycSession>(`/api/v1/sessions/${id}`),

  getAuditTrail: (id: string) =>
    request<AuditEvent[]>(`/api/v1/sessions/${id}/audit`),

  // Consent — must be called before document upload
  recordConsent: (sessionId: string) =>
    request<{ consent_id: string; already_recorded: boolean }>(
      `/api/v1/sessions/${sessionId}/consent`,
      { method: "POST" }
    ),

  // Document
  uploadDocument: (sessionId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ document_id: string; doc_type: string; ocr_confidence: number; ocr_fields: Record<string, string | null> }>(
      `/api/v1/sessions/${sessionId}/document`,
      { method: "POST", body: form }
    );
  },

  // Liveness
  issueLivenessChallenge: (sessionId: string) =>
    request<LivenessChallenge>(
      `/api/v1/sessions/${sessionId}/liveness/challenge`,
      { method: "POST" }
    ),

  verifyLiveness: (
    sessionId: string,
    challengeToken: string,
    performedSequence: string[],
    frame: Blob
  ) => {
    const form = new FormData();
    form.append("challenge_token", challengeToken);
    form.append("performed_sequence", JSON.stringify(performedSequence));
    form.append("face_frame", frame, "frame.jpg");
    return request<{ passive_spoof_score: number; active_challenge_passed: boolean; passed: boolean }>(
      `/api/v1/sessions/${sessionId}/liveness/verify`,
      { method: "POST", body: form }
    );
  },

  // Face match
  faceMatch: (sessionId: string, documentId: string, selfie: Blob) => {
    const form = new FormData();
    form.append("document_id", documentId);
    form.append("selfie", selfie, "selfie.jpg");
    return request<{ similarity_score: number; matched: boolean; threshold_used: number; model_version: string }>(
      `/api/v1/sessions/${sessionId}/face-match`,
      { method: "POST", body: form }
    );
  },

  // Risk decision
  computeRiskDecision: (sessionId: string) =>
    request<RiskDecision>(
      `/api/v1/sessions/${sessionId}/risk-decision`,
      { method: "POST" }
    ),
};
