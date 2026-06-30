"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kycApi, ApiError } from "../../../lib/api-client";

const CONSENT_TEXT =
  "I consent to the collection and processing of my biometric data " +
  "(facial image, liveness video frames) and identity document data " +
  "for the purpose of KYC verification. Data will be retained for " +
  "the period required by applicable regulations (RBI Master Direction on KYC).";

export default function ConsentPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");

  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sessionId) {
    return <Centered>No active session. Start verification from the home page first.</Centered>;
  }

  async function handleConsent() {
    if (!agreed) return;
    setLoading(true);
    setError(null);
    try {
      await kycApi.recordConsent(sessionId!);
      router.push(`/verify/document?session=${sessionId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record consent. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "var(--fs-xl)", marginBottom: "var(--space-2)" }}>
        Before we continue
      </h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-6)" }}>
        As required by RBI KYC guidelines and applicable data protection law, we need
        your explicit consent before collecting any biometric data.
      </p>

      <div
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-6)",
          marginBottom: "var(--space-6)",
          fontSize: "var(--fs-sm)",
          color: "var(--color-text-secondary)",
          lineHeight: 1.7,
        }}
      >
        {CONSENT_TEXT}
      </div>

      <div style={{ marginBottom: "var(--space-6)" }}>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--fs-sm)", marginBottom: "var(--space-4)" }}>
          We will collect and process:
        </p>
        {[
          "A photo of your government-issued ID document",
          "A live selfie or short video for liveness detection",
          "Biometric facial embeddings for identity matching",
          "OCR-extracted text fields from your document",
        ].map((item) => (
          <div key={item} style={{ display: "flex", gap: "var(--space-3)", marginBottom: "var(--space-2)", alignItems: "flex-start" }}>
            <span style={{ color: "var(--color-verify)", flexShrink: 0, marginTop: 2 }}>✓</span>
            <span style={{ color: "var(--color-text-secondary)", fontSize: "var(--fs-sm)" }}>{item}</span>
          </div>
        ))}
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "var(--space-3)",
          marginBottom: "var(--space-6)",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          style={{ marginTop: 3, flexShrink: 0 }}
        />
        <span style={{ fontSize: "var(--fs-sm)", color: "var(--color-text-primary)" }}>
          I have read and agree to the processing of my personal and biometric data
          for KYC verification as described above.
        </span>
      </label>

      <button
        onClick={handleConsent}
        disabled={!agreed || loading}
        style={{
          width: "100%",
          background: !agreed || loading ? "var(--color-border)" : "var(--color-verify)",
          color: !agreed || loading ? "var(--color-text-muted)" : "#0b0d10",
          border: "none",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3)",
          fontSize: "var(--fs-base)",
          cursor: !agreed || loading ? "default" : "pointer",
          transition: "background 0.2s",
        }}
      >
        {loading ? "Recording consent…" : "I agree — continue"}
      </button>

      {error && (
        <p style={{ color: "var(--color-reject)", marginTop: "var(--space-4)", fontSize: "var(--fs-sm)" }}>
          {error}
        </p>
      )}

      <p style={{ color: "var(--color-text-muted)", fontSize: "var(--fs-xs)", marginTop: "var(--space-6)", lineHeight: 1.6 }}>
        Your consent is logged with a timestamp for compliance purposes.
        You may withdraw consent at any time by contacting us, subject to
        regulatory retention requirements.
      </p>
    </main>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 520, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <p style={{ color: "var(--color-reject)" }}>{children}</p>
    </main>
  );
}
