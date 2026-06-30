"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kycApi, ApiError } from "../../../lib/api-client";

export default function FaceMatchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");
  const documentId = params.get("document");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      })
      .catch(() => setError("Camera access is required for face verification."));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!sessionId || !documentId) {
    return <Centered>No active session. Start verification from the home page first.</Centered>;
  }

  function captureFrame(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video) return reject(new Error("Camera not ready"));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas unavailable"));
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Capture failed"))), "image/jpeg", 0.92);
    });
  }

  async function handleCapture() {
    setLoading(true);
    setError(null);
    try {
      const selfie = await captureFrame();
      const result: any = await kycApi.faceMatch(sessionId!, documentId!, selfie);
      if (!result.matched) {
        // A failed match is still a valid outcome to surface, not an error —
        // the risk engine (next step) is what makes the final call, but the
        // user should know immediately rather than be surprised later.
        setError(
          `Face match did not pass (similarity ${result.similarity_score.toFixed(2)}, ` +
            `needed ${result.threshold_used.toFixed(2)}). You can retry with better lighting, ` +
            `or continue to see the full risk decision.`
        );
      }
      router.push(`/verify/decision?session=${sessionId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Face match failed. Ensure only your face is in frame.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "var(--fs-xl)", marginBottom: "var(--space-2)" }}>Face verification</h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-6)" }}>
        Position your face clearly in frame, then capture.
      </p>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: "100%", borderRadius: "var(--radius-lg)", background: "var(--color-surface)" }}
      />

      <button
        onClick={handleCapture}
        disabled={!cameraReady || loading}
        style={{
          marginTop: "var(--space-6)",
          width: "100%",
          background: !cameraReady || loading ? "var(--color-border)" : "var(--color-verify)",
          color: "#0b0d10",
          border: "none",
          borderRadius: "var(--radius-md)",
          padding: "var(--space-3)",
          fontSize: "var(--fs-base)",
          cursor: "pointer",
        }}
      >
        {loading ? "Matching…" : "Capture & match"}
      </button>

      {error && <p style={{ color: "var(--color-review)", marginTop: "var(--space-4)" }}>{error}</p>}
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
