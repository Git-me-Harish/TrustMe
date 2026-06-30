"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { kycApi, ApiError, type KycSession } from "../../lib/api-client";
import { authApi } from "../../lib/auth-client";

const STATUS_COLOR: Record<string, string> = {
  INITIATED:       "var(--color-text-muted)",
  DOC_UPLOADED:    "var(--color-text-secondary)",
  DOC_VERIFIED:    "var(--color-text-secondary)",
  LIVENESS_PASSED: "var(--color-text-secondary)",
  FACE_MATCHED:    "var(--color-text-secondary)",
  RISK_SCORED:     "var(--color-text-secondary)",
  APPROVED:        "var(--color-approve)",
  REJECTED:        "var(--color-reject)",
  MANUAL_REVIEW:   "var(--color-review)",
};

// Given a session status, return the next URL to resume the flow
function resumeUrl(session: KycSession): string | null {
  switch (session.status) {
    case "INITIATED":       return `/verify/consent?session=${session.id}`;
    case "DOC_UPLOADED":
    case "DOC_VERIFIED":    return `/verify/liveness?session=${session.id}`;
    case "LIVENESS_PASSED": return `/verify/face-match?session=${session.id}`;
    case "FACE_MATCHED":
    case "RISK_SCORED":     return `/verify/decision?session=${session.id}`;
    default:                return `/verify/decision?session=${session.id}`;
  }
}

function isTerminal(status: string): boolean {
  return ["APPROVED", "REJECTED", "MANUAL_REVIEW"].includes(status);
}

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<KycSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authApi.isLoggedIn()) {
      router.replace("/login");
      return;
    }
    kycApi
      .listSessions()
      .then(setSessions)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load sessions.")
      )
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "var(--fs-xl)" }}>Your verifications</h1>
        <button
          onClick={() => router.push("/")}
          style={{
            background: "var(--color-verify)",
            color: "#0b0d10",
            border: "none",
            borderRadius: "var(--radius-sm)",
            padding: "var(--space-2) var(--space-4)",
            fontSize: "var(--fs-sm)",
            cursor: "pointer",
          }}
        >
          Start new
        </button>
      </div>

      {loading && <p style={{ color: "var(--color-text-secondary)" }}>Loading…</p>}
      {error && <p style={{ color: "var(--color-reject)" }}>{error}</p>}

      {!loading && sessions.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: "var(--space-12) 0",
            color: "var(--color-text-muted)",
          }}
        >
          <p style={{ marginBottom: "var(--space-4)" }}>No verification sessions yet.</p>
          <button
            onClick={() => router.push("/")}
            style={{
              background: "var(--color-verify)",
              color: "#0b0d10",
              border: "none",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-6)",
              cursor: "pointer",
            }}
          >
            Start your first verification
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {sessions.map((s) => (
          <div
            key={s.id}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4) var(--space-6)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p
                className="mono"
                style={{ fontSize: "var(--fs-xs)", color: "var(--color-text-muted)", marginBottom: "var(--space-1)" }}
              >
                {s.id.slice(0, 8)}…
              </p>
              <p
                style={{
                  fontSize: "var(--fs-sm)",
                  color: STATUS_COLOR[s.status] ?? "var(--color-text-secondary)",
                  marginBottom: "var(--space-1)",
                  textTransform: "capitalize",
                }}
              >
                {s.status.replace(/_/g, " ").toLowerCase()}
              </p>
              <p style={{ fontSize: "var(--fs-xs)", color: "var(--color-text-muted)" }}>
                {s.doc_type ?? "No document uploaded"} ·{" "}
                {new Date(s.created_at).toLocaleDateString("en-IN", {
                  day: "numeric", month: "short", year: "numeric",
                })}
              </p>
            </div>

            <button
              onClick={() => router.push(resumeUrl(s) ?? "/")}
              style={{
                background: isTerminal(s.status) ? "transparent" : "var(--color-surface-raised)",
                border: `1px solid ${isTerminal(s.status) ? "var(--color-border)" : "var(--color-verify)"}`,
                color: isTerminal(s.status) ? "var(--color-text-secondary)" : "var(--color-verify)",
                borderRadius: "var(--radius-sm)",
                padding: "var(--space-2) var(--space-4)",
                fontSize: "var(--fs-sm)",
                cursor: "pointer",
              }}
            >
              {isTerminal(s.status) ? "View result" : "Resume"}
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
