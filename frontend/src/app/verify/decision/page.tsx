"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kycApi, ApiError, type RiskDecision } from "../../../lib/api-client";

const DECISION_COPY: Record<string, { headline: string; tone: string }> = {
  APPROVED: { headline: "Identity verified", tone: "var(--color-approve)" },
  REJECTED: { headline: "Verification unsuccessful", tone: "var(--color-reject)" },
  MANUAL_REVIEW: { headline: "Under manual review", tone: "var(--color-review)" },
};

const SIGNAL_LABELS: Record<string, string> = {
  face_match: "Face match",
  liveness: "Liveness",
  doc_forgery_inverse: "Document integrity",
  aadhaar_verify: "Aadhaar verification",
};

export default function DecisionPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");

  const [decision, setDecision] = useState<RiskDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }
    kycApi
      .computeRiskDecision(sessionId)
      .then(setDecision)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Could not compute a decision. Liveness and face-match must both complete first."
        )
      )
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (!sessionId) {
    return <Centered>No active session. Start verification from the home page first.</Centered>;
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "var(--fs-xl)", marginBottom: "var(--space-6)" }}>Verification result</h1>

      {loading && <p style={{ color: "var(--color-text-secondary)" }}>Computing decision…</p>}

      {error && (
        <div>
          <p style={{ color: "var(--color-reject)", marginBottom: "var(--space-4)" }}>{error}</p>
          <button onClick={() => router.push("/")} style={linkButtonStyle}>
            Back to start
          </button>
        </div>
      )}

      {decision && (
        <div>
          <div
            style={{
              padding: "var(--space-6)",
              borderRadius: "var(--radius-lg)",
              background: "var(--color-surface)",
              border: `1px solid ${DECISION_COPY[decision.decision]?.tone ?? "var(--color-border)"}`,
              marginBottom: "var(--space-6)",
            }}
          >
            <p style={{ fontSize: "var(--fs-lg)", color: DECISION_COPY[decision.decision]?.tone, marginBottom: "var(--space-2)" }}>
              {DECISION_COPY[decision.decision]?.headline ?? decision.decision}
            </p>
            <p className="mono" style={{ color: "var(--color-text-muted)", fontSize: "var(--fs-sm)" }}>
              composite score: {decision.composite_score.toFixed(4)}
            </p>
          </div>

          <h2 style={{ fontSize: "var(--fs-base)", color: "var(--color-text-secondary)", marginBottom: "var(--space-3)" }}>
            Signal breakdown
          </h2>
          {Object.entries(decision.breakdown).map(([key, value]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border)" }}>
              <span style={{ color: "var(--color-text-secondary)" }}>{SIGNAL_LABELS[key] ?? key}</span>
              <span className="mono">{value === null ? "n/a" : value.toFixed(3)}</span>
            </div>
          ))}

          {decision.decision === "MANUAL_REVIEW" && (
            <p style={{ marginTop: "var(--space-6)", color: "var(--color-text-secondary)", fontSize: "var(--fs-sm)" }}>
              Your verification needs a human reviewer to confirm. You'll be notified once it's complete.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <p style={{ color: "var(--color-reject)" }}>{children}</p>
    </main>
  );
}

const linkButtonStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-primary)",
  padding: "var(--space-2) var(--space-4)",
  cursor: "pointer",
};
