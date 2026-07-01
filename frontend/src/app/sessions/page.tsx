"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { kycApi, ApiError, type KycSession } from "../../lib/api-client";
import { authApi } from "../../lib/auth-client";
import { Button } from "../../components/ui/Button";
import { Badge } from "../../components/ui/Badge";

type BadgeVariant = "approve" | "review" | "reject" | "accent" | "default";

const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  INITIATED:       { label: "Started",          variant: "default" },
  DOC_UPLOADED:    { label: "Document uploaded", variant: "default" },
  DOC_VERIFIED:    { label: "Document verified", variant: "accent" },
  LIVENESS_PASSED: { label: "Liveness passed",   variant: "accent" },
  FACE_MATCHED:    { label: "Face matched",       variant: "accent" },
  RISK_SCORED:     { label: "Scoring complete",   variant: "accent" },
  APPROVED:        { label: "Verified",           variant: "approve" },
  REJECTED:        { label: "Rejected",           variant: "reject" },
  MANUAL_REVIEW:   { label: "Under review",       variant: "review" },
};

function resumeUrl(s: KycSession): string {
  switch (s.status) {
    case "INITIATED":       return `/verify/consent?session=${s.id}`;
    case "DOC_UPLOADED":
    case "DOC_VERIFIED":    return `/verify/liveness?session=${s.id}`;
    case "LIVENESS_PASSED": return `/verify/face-match?session=${s.id}`;
    case "FACE_MATCHED":
    case "RISK_SCORED":     return `/verify/decision?session=${s.id}`;
    default:                return `/verify/decision?session=${s.id}`;
  }
}

const TERMINAL = ["APPROVED", "REJECTED", "MANUAL_REVIEW"];

function SessionRow({ session }: { session: KycSession }) {
  const router = useRouter();
  const meta = STATUS_META[session.status] ?? { label: session.status, variant: "default" as BadgeVariant };
  const isDone = TERMINAL.includes(session.status);
  const date = new Date(session.created_at);
  const dateStr = date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "center",
        gap: "var(--s-4)",
        padding: "var(--s-4) var(--s-5)",
        borderBottom: "1px solid var(--border)",
        transition: "background var(--t-fast) var(--ease)",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.background = "var(--surface-2)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.background = "transparent")}
    >
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", marginBottom: "var(--s-1)" }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--text-3)",
            }}
          >
            {session.id.slice(0, 12)}…
          </span>
          <Badge variant={meta.variant}>{meta.label}</Badge>
        </div>
        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
          {session.doc_type ? session.doc_type.replace(/_/g, " ") : "No document"} · {dateStr}
        </p>
      </div>

      <Button
        variant={isDone ? "ghost" : "secondary"}
        size="sm"
        onClick={() => router.push(resumeUrl(session))}
        style={isDone ? { color: "var(--text-3)" } : undefined}
      >
        {isDone ? "View result" : "Resume"}
      </Button>
    </div>
  );
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
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load sessions."))
      .finally(() => setLoading(false));
  }, [router]);

  const active = sessions.filter((s) => !TERMINAL.includes(s.status));
  const complete = sessions.filter((s) => TERMINAL.includes(s.status));

  return (
    <div style={{ minHeight: "100dvh" }}>
      {/* Page header */}
      <div
        style={{
          borderBottom: "1px solid var(--border)",
          padding: "var(--s-8) 0 var(--s-6)",
          background: "var(--surface)",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--s-4)",
          }}
        >
          <div>
            <button
              onClick={() => router.push("/")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "var(--text-3)",
                fontSize: "var(--text-xs)",
                letterSpacing: "0.04em",
                marginBottom: "var(--s-3)",
                transition: "color var(--t-fast)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-2)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Home
            </button>
            <h1
              style={{
                fontSize: "clamp(var(--text-xl), 3vw, var(--text-3xl))",
                fontWeight: 800,
                letterSpacing: "-0.035em",
                color: "var(--text)",
              }}
            >
              Verification sessions
            </h1>
          </div>
          <Button onClick={() => router.push("/")}>Start new verification</Button>
        </div>
      </div>

      <div className="container" style={{ paddingTop: "var(--s-8)", paddingBottom: "var(--s-16)", maxWidth: 760 }}>
        {/* Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 68, borderRadius: "var(--r-lg)" }} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              padding: "var(--s-5)",
              background: "var(--reject-dim)",
              border: "1px solid rgba(244,63,94,0.2)",
              borderRadius: "var(--r-xl)",
              fontSize: "var(--text-sm)",
              color: "var(--reject)",
            }}
          >
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && sessions.length === 0 && (
          <div
            style={{
              textAlign: "center",
              paddingTop: "var(--s-20)",
              paddingBottom: "var(--s-20)",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "var(--r-xl)",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                display: "grid",
                placeItems: "center",
                margin: "0 auto var(--s-4)",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="var(--text-3)" strokeWidth="1.5" />
                <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="var(--text-3)" strokeWidth="1.5" />
                <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="var(--text-3)" strokeWidth="1.5" />
                <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="var(--text-3)" strokeWidth="1.5" />
              </svg>
            </div>
            <p style={{ fontSize: "var(--text-base)", color: "var(--text-2)", marginBottom: "var(--s-2)" }}>
              No verification sessions yet
            </p>
            <p style={{ fontSize: "var(--text-sm)", color: "var(--text-3)", marginBottom: "var(--s-6)" }}>
              Start your first verification to see it here.
            </p>
            <Button onClick={() => router.push("/")}>Start verification</Button>
          </div>
        )}

        {/* Active sessions */}
        {active.length > 0 && (
          <div style={{ marginBottom: "var(--s-8)" }}>
            <p
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-3)",
                marginBottom: "var(--s-3)",
              }}
            >
              In progress — {active.length}
            </p>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-xl)",
                overflow: "hidden",
              }}
            >
              {active.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          </div>
        )}

        {/* Completed sessions */}
        {complete.length > 0 && (
          <div>
            <p
              style={{
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-3)",
                marginBottom: "var(--s-3)",
              }}
            >
              Completed — {complete.length}
            </p>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-xl)",
                overflow: "hidden",
              }}
            >
              {complete.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}