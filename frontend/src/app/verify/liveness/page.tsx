"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kycApi, ApiError } from "../../../lib/api-client";

/**
 * IMPORTANT, stated plainly rather than hidden in a comment no one reads:
 * automatic detection of "did the user actually blink/turn/smile" requires
 * a landmark-tracking model (MediaPipe FaceMesh) running against the live
 * video stream — that model is not wired into this scaffold yet (tracked in
 * README as pending work). Until it lands, this screen captures one frame
 * for passive anti-spoof scoring and asks the user to confirm which actions
 * they performed via checkboxes. That confirmation is NOT a security
 * control on its own — it's a placeholder UI so the pipeline is clickable
 * end-to-end. Do not treat this screen as "liveness is solved."
 */
export default function LivenessPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");
  const documentId = params.get("document");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [challenge, setChallenge] = useState<{ token: string; sequence: string[] } | null>(null);
  const [performed, setPerformed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    kycApi
      .issueLivenessChallenge(sessionId)
      .then((c) => setChallenge({ token: c.token, sequence: c.sequence }))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not start liveness check."));
  }, [sessionId]);

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
      .catch(() => setError("Camera access is required for liveness verification."));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!sessionId || !documentId) {
    return <Centered>No active session. Start verification from the home page first.</Centered>;
  }

  function toggleAction(action: string) {
    setPerformed((prev) => {
      const next = new Set(prev);
      next.has(action) ? next.delete(action) : next.add(action);
      return next;
    });
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

  async function handleSubmit() {
    if (!challenge) return;
    setLoading(true);
    setError(null);
    try {
      const frame = await captureFrame();
      // Order matters for the backend's exact-sequence check — performed
      // here in the same order the challenge was issued, since checkboxes
      // alone don't capture order. This UI limitation is exactly why manual
      // confirmation isn't a real security control yet (see note above).
      const orderedPerformed = challenge.sequence.filter((s) => performed.has(s));
      await kycApi.verifyLiveness(sessionId, challenge.token, orderedPerformed, frame);
      router.push(`/verify/face-match?session=${sessionId}&document=${documentId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Liveness check failed. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "0 auto", padding: "var(--space-8) var(--space-4)" }}>
      <h1 style={{ fontSize: "var(--fs-xl)", marginBottom: "var(--space-2)" }}>Liveness check</h1>
      <p style={{ color: "var(--color-text-secondary)", marginBottom: "var(--space-6)" }}>
        Look at the camera and perform each action below.
      </p>

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ width: "100%", borderRadius: "var(--radius-lg)", background: "var(--color-surface)" }}
      />

      {challenge && (
        <div style={{ marginTop: "var(--space-6)" }}>
          {challenge.sequence.map((action) => (
            <label key={action} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
              <input type="checkbox" checked={performed.has(action)} onChange={() => toggleAction(action)} />
              <span style={{ textTransform: "capitalize" }}>{action.replace("_", " ")}</span>
            </label>
          ))}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!cameraReady || !challenge || performed.size === 0 || loading}
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
        {loading ? "Verifying…" : "Submit"}
      </button>

      {error && <p style={{ color: "var(--color-reject)", marginTop: "var(--space-4)" }}>{error}</p>}
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
