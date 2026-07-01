"use client";
import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kycApi, ApiError } from "../../../lib/api-client";
import { Button } from "../../../components/ui/Button";
import { StepHeader } from "../../../components/StepHeader";
import { VerificationPipeline } from "../../../components/VerificationPipeline";

const DATA_COLLECTED = [
  { label: "ID document photo", detail: "Used for OCR field extraction and face reference" },
  { label: "Live video frames", detail: "Liveness challenge and passive anti-spoof scoring" },
  { label: "Biometric embeddings", detail: "512-d ArcFace vectors — not stored as raw images" },
  { label: "Geolocation timestamp", detail: "Session-level, not granular tracking" },
];

export default function ConsentPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");

  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sessionId) {
    return (
      <div className="container" style={{ paddingTop: "var(--s-16)", textAlign: "center" }}>
        <p style={{ color: "var(--reject)", fontSize: "var(--text-base)" }}>
          No active session. Start from the home page.
        </p>
        <Button variant="secondary" size="sm" style={{ marginTop: "var(--s-4)" }} onClick={() => router.push("/")}>
          Go home
        </Button>
      </div>
    );
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
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        className="container"
        style={{
          flex: 1,
          paddingTop: "var(--s-8)",
          paddingBottom: "var(--s-16)",
          maxWidth: 640,
        }}
      >
        <VerificationPipeline status="INITIATED" />
        <StepHeader
          step={1}
          totalSteps={5}
          title="Before we collect data."
          description="We need your explicit consent before capturing any biometric information. This is required by RBI KYC guidelines and applicable data protection law."
        />

        {/* What we collect */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-xl)",
            overflow: "hidden",
            marginBottom: "var(--s-6)",
          }}
        >
          <div
            style={{
              padding: "var(--s-4) var(--s-5)",
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
              Data collected in this session
            </p>
          </div>
          {DATA_COLLECTED.map((item, i) => (
            <div
              key={item.label}
              style={{
                padding: "var(--s-4) var(--s-5)",
                borderBottom: i < DATA_COLLECTED.length - 1 ? "1px solid var(--border)" : "none",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "var(--s-4)",
              }}
            >
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text)", fontWeight: 500 }}>
                {item.label}
              </span>
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  color: "var(--text-3)",
                  textAlign: "right",
                  maxWidth: 240,
                  lineHeight: 1.5,
                }}
              >
                {item.detail}
              </span>
            </div>
          ))}
        </div>

        {/* Consent text */}
        <div
          style={{
            background: "var(--accent-dim)",
            border: "1px solid rgba(0,201,167,0.15)",
            borderRadius: "var(--r-lg)",
            padding: "var(--s-5)",
            marginBottom: "var(--s-6)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-2)",
              lineHeight: 1.75,
            }}
          >
            I consent to the collection and processing of my biometric data (facial image,
            liveness video frames) and identity document data for the purpose of KYC
            verification. Data will be retained for the period required by applicable
            regulations (RBI Master Direction on KYC — 5 years from relationship end).
          </p>
        </div>

        {/* Checkbox */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--s-3)",
            marginBottom: "var(--s-8)",
            cursor: "pointer",
          }}
        >
          <div
            role="checkbox"
            aria-checked={agreed}
            tabIndex={0}
            onClick={() => setAgreed(!agreed)}
            onKeyDown={(e) => e.key === " " && setAgreed(!agreed)}
            style={{
              width: 18,
              height: 18,
              marginTop: 2,
              flexShrink: 0,
              borderRadius: "var(--r-sm)",
              border: `1.5px solid ${agreed ? "var(--accent)" : "var(--border-2)"}`,
              background: agreed ? "var(--accent)" : "transparent",
              transition: "all var(--t-fast) var(--ease)",
              display: "grid",
              placeItems: "center",
            }}
          >
            {agreed && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="var(--text-inv)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text)", lineHeight: 1.6 }}>
            I have read the above and agree to the processing of my personal and
            biometric data for KYC verification as described.
          </span>
        </label>

        {/* CTA */}
        <Button
          fullWidth
          size="lg"
          loading={loading}
          disabled={!agreed}
          onClick={handleConsent}
        >
          I agree — continue to document upload
        </Button>

        {error && (
          <p
            style={{
              marginTop: "var(--s-4)",
              fontSize: "var(--text-sm)",
              color: "var(--reject)",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <p
          style={{
            marginTop: "var(--s-6)",
            fontSize: "var(--text-xs)",
            color: "var(--text-3)",
            lineHeight: 1.7,
            textAlign: "center",
          }}
        >
          Consent is logged with a timestamp for compliance purposes.
          You may withdraw consent subject to regulatory retention requirements.
        </p>
      </div>
    </div>
  );
}