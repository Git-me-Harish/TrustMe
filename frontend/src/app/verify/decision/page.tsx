"use client";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kycApi, ApiError, type RiskDecision } from "../../../lib/api-client";
import { Button } from "../../../components/ui/Button";
import { Badge } from "../../../components/ui/Badge";
import { VerificationPipeline } from "../../../components/VerificationPipeline";
import type { KycStatus } from "../../../components/VerificationPipeline";

const DECISION_CONFIG: Record<string, { headline: string; sub: string; variant: "approve" | "review" | "reject" }> = {
  APPROVED:      { headline: "Identity verified",       sub: "All signals passed. Verification complete.",                   variant: "approve" },
  REJECTED:      { headline: "Verification failed",     sub: "One or more signals did not meet the required threshold.",    variant: "reject" },
  MANUAL_REVIEW: { headline: "Referred for review",     sub: "A reviewer will assess your session and confirm the result.", variant: "review" },
};

const SIGNAL_META: Record<string, string> = {
  face_match:         "Face match similarity",
  liveness:           "Liveness verdict",
  doc_forgery_inverse: "Document integrity",
  aadhaar_verify:     "Aadhaar verification",
};

function ScoreBar({ value, max = 1 }: { value: number | null; max?: number }) {
  if (value === null) return <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>n/a</span>;
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
      <div
        style={{
          flex: 1,
          height: 4,
          background: "var(--border-2)",
          borderRadius: "var(--r-full)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: pct >= 70 ? "var(--approve)" : pct >= 40 ? "var(--review)" : "var(--reject)",
            borderRadius: "var(--r-full)",
            transition: "width 0.8s var(--ease)",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          color: "var(--text-2)",
          minWidth: 36,
          textAlign: "right",
        }}
      >
        {value.toFixed(3)}
      </span>
    </div>
  );
}

export default function DecisionPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");

  const [decision, setDecision] = useState<RiskDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }
    kycApi
      .computeRiskDecision(sessionId)
      .then(setDecision)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not compute decision.")
      )
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="container" style={{ paddingTop: "var(--s-16)", textAlign: "center" }}>
        <p style={{ color: "var(--reject)" }}>No active session.</p>
        <Button variant="secondary" size="sm" style={{ marginTop: "var(--s-4)" }} onClick={() => router.push("/")}>
          Go home
        </Button>
      </div>
    );
  }

  const config = decision ? DECISION_CONFIG[decision.decision] : null;
  const terminalStatus = decision?.decision as KycStatus | undefined;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div
        className="container"
        style={{ flex: 1, paddingTop: "var(--s-8)", paddingBottom: "var(--s-16)", maxWidth: 560 }}
      >
        <VerificationPipeline status={terminalStatus ?? "RISK_SCORED"} />

        {/* ── Loading state ─────────────────────────────────── */}
        {loading && (
          <div style={{ paddingTop: "var(--s-12)", textAlign: "center" }}>
            <div
              style={{
                width: 48,
                height: 48,
                border: "2px solid var(--border-2)",
                borderTop: "2px solid var(--accent)",
                borderRadius: "50%",
                animation: "spin 0.8s linear infinite",
                margin: "0 auto var(--s-4)",
              }}
            />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ color: "var(--text-2)", fontSize: "var(--text-base)" }}>
              Computing risk decision…
            </p>
            <p style={{ color: "var(--text-3)", fontSize: "var(--text-sm)", marginTop: "var(--s-2)" }}>
              Aggregating all verification signals
            </p>
          </div>
        )}

        {/* ── Error state ───────────────────────────────────── */}
        {error && (
          <div style={{ paddingTop: "var(--s-8)" }}>
            <div
              style={{
                padding: "var(--s-5)",
                background: "var(--reject-dim)",
                border: "1px solid rgba(244,63,94,0.2)",
                borderRadius: "var(--r-xl)",
                marginBottom: "var(--s-6)",
              }}
            >
              <p style={{ color: "var(--reject)", fontSize: "var(--text-base)", fontWeight: 500 }}>
                Could not compute decision
              </p>
              <p style={{ color: "var(--text-2)", fontSize: "var(--text-sm)", marginTop: "var(--s-2)" }}>
                {error}
              </p>
            </div>
            <Button variant="secondary" onClick={() => router.push("/")} fullWidth>
              Return home
            </Button>
          </div>
        )}

        {/* ── Decision result ───────────────────────────────── */}
        {decision && config && (
          <div className="animate-fade-up">
            {/* Result card */}
            <div
              style={{
                background: "var(--surface)",
                border: `1px solid ${
                  config.variant === "approve" ? "rgba(16,185,129,0.3)" :
                  config.variant === "review"  ? "rgba(245,158,11,0.3)" :
                  "rgba(244,63,94,0.3)"
                }`,
                borderRadius: "var(--r-xl)",
                padding: "var(--s-8)",
                marginBottom: "var(--s-5)",
                textAlign: "center",
              }}
            >
              {/* Large score ring */}
              <div
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: "50%",
                  border: `3px solid ${
                    config.variant === "approve" ? "var(--approve)" :
                    config.variant === "review"  ? "var(--review)" :
                    "var(--reject)"
                  }`,
                  display: "grid",
                  placeItems: "center",
                  margin: "0 auto var(--s-5)",
                  background: `${
                    config.variant === "approve" ? "var(--approve-dim)" :
                    config.variant === "review"  ? "var(--review-dim)" :
                    "var(--reject-dim)"
                  }`,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-lg)",
                    fontWeight: 700,
                    color:
                      config.variant === "approve" ? "var(--approve)" :
                      config.variant === "review"  ? "var(--review)" :
                      "var(--reject)",
                  }}
                >
                  {(decision.composite_score * 100).toFixed(0)}
                </span>
              </div>

              <Badge variant={config.variant} style={{ marginBottom: "var(--s-3)" }}>
                {decision.decision.replace("_", " ")}
              </Badge>

              <h1
                style={{
                  fontSize: "var(--text-2xl)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "var(--text)",
                  marginBottom: "var(--s-2)",
                }}
              >
                {config.headline}
              </h1>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>{config.sub}</p>
            </div>

            {/* Signal breakdown */}
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-xl)",
                overflow: "hidden",
                marginBottom: "var(--s-5)",
              }}
            >
              <div
                style={{
                  padding: "var(--s-3) var(--s-5)",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--surface-2)",
                }}
              >
                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--text-3)",
                  }}
                >
                  Signal breakdown
                </p>
              </div>
              {Object.entries(decision.breakdown).map(([key, value], i, arr) => (
                <div
                  key={key}
                  style={{
                    padding: "var(--s-4) var(--s-5)",
                    borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none",
                    display: "grid",
                    gridTemplateColumns: "1fr 1.5fr",
                    alignItems: "center",
                    gap: "var(--s-4)",
                  }}
                >
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>
                    {SIGNAL_META[key] ?? key.replace(/_/g, " ")}
                  </span>
                  <ScoreBar value={typeof value === "number" ? value : null} />
                </div>
              ))}
            </div>

            {/* Composite score row */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--s-4) var(--s-5)",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-lg)",
                marginBottom: "var(--s-8)",
              }}
            >
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-2)" }}>
                Composite score
              </span>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-sm)",
                  fontWeight: 600,
                  color: "var(--text)",
                  letterSpacing: "0.03em",
                }}
              >
                {decision.composite_score.toFixed(4)}
              </span>
            </div>

            {/* CTA */}
            <div style={{ display: "flex", gap: "var(--s-3)", flexDirection: "column" }}>
              {decision.decision === "APPROVED" && (
                <Button fullWidth size="lg" onClick={() => router.push("/sessions")}>
                  View all sessions
                </Button>
              )}
              {decision.decision === "REJECTED" && (
                <Button fullWidth size="lg" onClick={() => router.push("/")}>
                  Start a new verification
                </Button>
              )}
              {decision.decision === "MANUAL_REVIEW" && (
                <>
                  <div
                    style={{
                      padding: "var(--s-4)",
                      background: "var(--review-dim)",
                      border: "1px solid rgba(245,158,11,0.2)",
                      borderRadius: "var(--r-lg)",
                      fontSize: "var(--text-sm)",
                      color: "var(--review)",
                      textAlign: "center",
                    }}
                  >
                    A reviewer will assess your session. You will be notified once complete.
                  </div>
                  <Button
                    fullWidth
                    variant="secondary"
                    size="lg"
                    onClick={() => router.push("/sessions")}
                  >
                    Track session status
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}