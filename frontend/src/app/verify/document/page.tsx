"use client";
import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kycApi, ApiError } from "../../../lib/api-client";
import { Button } from "../../../components/ui/Button";
import { StepHeader } from "../../../components/StepHeader";
import { VerificationPipeline } from "../../../components/VerificationPipeline";
import { Badge } from "../../../components/ui/Badge";

export default function DocumentUploadPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [dragOver, setDragOver] = useState(false);

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

  function handleFile(selected: File) {
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError(null);
    setSubmitted(false);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f && f.type.startsWith("image/")) handleFile(f);
  }

  async function handleSubmit() {
    if (!file || loading || submitted) return;
    setLoading(true);
    setSubmitted(true);
    setError(null);
    try {
      const result = await kycApi.uploadDocument(sessionId!, file);
      router.push(`/verify/liveness?session=${sessionId}&document=${result.document_id}`);
    } catch (err) {
      setSubmitted(false);
      setError(
        err instanceof ApiError
          ? err.message
          : "Document could not be processed. Try a clearer photo."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div
        className="container"
        style={{ flex: 1, paddingTop: "var(--s-8)", paddingBottom: "var(--s-16)", maxWidth: 600 }}
      >
        <VerificationPipeline status="INITIATED" />
        <StepHeader
          step={2}
          totalSteps={5}
          title="Upload your ID document."
          description="Take a clear photo of the entire document. All four corners must be visible and text must be sharp."
        />

        {/* Supported docs hint */}
        <div
          style={{
            display: "flex",
            gap: "var(--s-2)",
            flexWrap: "wrap",
            marginBottom: "var(--s-6)",
          }}
        >
          {["Aadhaar", "PAN Card", "Passport", "Driving Licence"].map((d) => (
            <Badge key={d} variant="default">{d}</Badge>
          ))}
        </div>

        {/* Drop zone */}
        <label
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: preview ? "auto" : 240,
            border: `1.5px dashed ${dragOver ? "var(--accent)" : preview ? "var(--border-2)" : "var(--border)"}`,
            borderRadius: "var(--r-xl)",
            cursor: "pointer",
            background: dragOver ? "var(--accent-dim)" : "var(--surface)",
            transition: "all var(--t-base) var(--ease)",
            overflow: "hidden",
            marginBottom: "var(--s-4)",
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="Document preview"
              style={{
                width: "100%",
                maxHeight: 320,
                objectFit: "contain",
                display: "block",
                padding: "var(--s-4)",
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "var(--s-3)",
                padding: "var(--s-8)",
                textAlign: "center",
              }}
            >
              {/* Upload icon */}
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "var(--r-lg)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M10 3v10M6 7l4-4 4 4" stroke="var(--text-2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3 17h14" stroke="var(--text-2)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text)", fontWeight: 500 }}>
                Drop photo here or click to browse
              </p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
                JPEG or PNG — max 20MB
              </p>
            </div>
          )}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            style={{ display: "none" }}
          />
        </label>

        {/* Replace button when preview exists */}
        {preview && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setFile(null); setPreview(null); setSubmitted(false); }}
            style={{ marginBottom: "var(--s-4)", width: "100%" }}
          >
            Replace photo
          </Button>
        )}

        {error && (
          <div
            style={{
              padding: "var(--s-3) var(--s-4)",
              background: "var(--reject-dim)",
              border: "1px solid rgba(244,63,94,0.2)",
              borderRadius: "var(--r-md)",
              marginBottom: "var(--s-4)",
              fontSize: "var(--text-sm)",
              color: "var(--reject)",
            }}
          >
            {error}
          </div>
        )}

        <Button
          fullWidth
          size="lg"
          loading={loading}
          disabled={!file || submitted}
          onClick={handleSubmit}
        >
          {loading ? "Processing document…" : "Continue"}
        </Button>

        {/* Tips */}
        <div
          style={{
            marginTop: "var(--s-6)",
            padding: "var(--s-4) var(--s-5)",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-lg)",
          }}
        >
          <p
            style={{
              fontSize: "var(--text-xs)",
              fontWeight: 600,
              color: "var(--text-3)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "var(--s-3)",
            }}
          >
            Photo requirements
          </p>
          {[
            "All four corners of the document must be visible",
            "Text must be sharp — no blur or glare",
            "Do not photograph a screen — upload the original file if digital",
            "Background should contrast with the document",
          ].map((tip) => (
            <div
              key={tip}
              style={{
                display: "flex",
                gap: "var(--s-3)",
                alignItems: "flex-start",
                marginBottom: "var(--s-2)",
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  flexShrink: 0,
                  marginTop: 6,
                }}
              />
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-2)", lineHeight: 1.6 }}>
                {tip}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}