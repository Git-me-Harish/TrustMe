"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { kycApi, ApiError } from "../lib/api-client";
import { authApi } from "../lib/auth-client";

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authApi.isLoggedIn()) {
      router.replace("/login");
    }
  }, [router]);

  async function handleStart() {
    setLoading(true);
    setError(null);
    try {
      const created = await kycApi.createSession();
      // Always go through consent first before any biometric capture
      router.push(`/verify/consent?session=${created.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        authApi.logout();
        router.replace("/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not reach the backend.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "var(--fs-2xl)", marginBottom: "var(--space-2)" }}>
        KYC Verification
      </h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-2)" }}>
        Secure, end-to-end identity verification — document OCR, liveness
        detection, and face matching against an auditable decision trail.
      </p>
      <p style={{ color: "var(--color-text-muted)", fontSize: "var(--fs-sm)", marginBottom: "var(--space-8)" }}>
        Supports Aadhaar, PAN, Passport, and Driving Licence.
      </p>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
        <button
          onClick={handleStart}
          disabled={loading}
          style={{
            background: "var(--color-verify)",
            color: "#0b0d10",
            border: "none",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-6)",
            fontSize: "var(--fs-base)",
            cursor: loading ? "default" : "pointer",
          }}
        >
          {loading ? "Starting…" : "Start verification"}
        </button>

        <button
          onClick={() => router.push("/sessions")}
          style={{
            background: "transparent",
            color: "var(--color-text-secondary)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-6)",
            fontSize: "var(--fs-base)",
            cursor: "pointer",
          }}
        >
          View past sessions
        </button>
      </div>

      {error && (
        <p style={{ color: "var(--color-reject)", marginTop: "var(--space-4)" }}>{error}</p>
      )}

      <div
        style={{
          marginTop: "var(--space-12)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "var(--space-4)",
        }}
      >
        {[
          { label: "Document OCR", desc: "Auto-classify and extract fields from ID docs" },
          { label: "Liveness check", desc: "Challenge-response + passive anti-spoof" },
          { label: "Face match", desc: "ArcFace embeddings vs document photo" },
          { label: "Audit trail", desc: "Hash-chained, tamper-evident event log" },
        ].map((f) => (
          <div
            key={f.label}
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4)",
            }}
          >
            <p style={{ fontSize: "var(--fs-sm)", marginBottom: "var(--space-1)" }}>{f.label}</p>
            <p style={{ fontSize: "var(--fs-xs)", color: "var(--color-text-muted)" }}>{f.desc}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
