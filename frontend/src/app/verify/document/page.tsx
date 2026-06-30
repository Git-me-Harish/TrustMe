"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kycApi, ApiError } from "../../../lib/api-client";

export default function DocumentUploadPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!sessionId) {
    return <ErrorScreen message="No active session. Start verification from the home page first." />;
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setError(null);
  }

  async function handleSubmit() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const result = await kycApi.uploadDocument(sessionId, file);
      // document_id is needed by the face-match step later — carry it
      // forward via query params rather than refetching it from the session,
      // since a session can in principle have more than one document record.
      router.push(`/verify/liveness?session=${sessionId}&document=${result.document_id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Try a clearer photo of the document.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "var(--fs-xl)", marginBottom: "var(--space-2)" }}>Upload your ID document</h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-6)" }}>
        Aadhaar, PAN, Passport, or Driving Licence. Make sure all text is sharp and the full document is visible.
      </p>

      <label
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 220,
          border: "1px dashed var(--color-border)",
          borderRadius: "var(--radius-lg)",
          cursor: "pointer",
          background: "var(--color-surface)",
          overflow: "hidden",
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Document preview" style={{ maxWidth: "100%", maxHeight: 300, objectFit: "contain" }} />
        ) : (
          <span style={{ color: "var(--color-text-muted)" }}>Click to choose a photo</span>
        )}
        <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: "none" }} />
      </label>

      <button
        onClick={handleSubmit}
        disabled={!file || loading}
        style={{
          marginTop: "var(--space-6)",
          width: "100%",
          background: !file || loading ? "var(--color-border)" : "var(--color-verify)",
          color: "#0b0d10",
          border: "none",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3)",
          fontSize: "var(--fs-base)",
          cursor: !file || loading ? "default" : "pointer",
        }}
      >
        {loading ? "Processing document…" : "Continue"}
      </button>

      {error && <p style={{ color: "var(--color-reject)", marginTop: "var(--space-4)" }}>{error}</p>}
    </main>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <p style={{ color: "var(--color-reject)" }}>{message}</p>
    </main>
  );
}
