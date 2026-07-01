"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kycApi, ApiError } from "../../../lib/api-client";
import { Button } from "../../../components/ui/Button";
import { StepHeader } from "../../../components/StepHeader";
import { VerificationPipeline } from "../../../components/VerificationPipeline";
import { ScanRing } from "../../../components/ScanRing";

export default function LivenessPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");
  const documentId = params.get("document");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [challenge, setChallenge] = useState<{ token: string; sequence: string[] } | null>(null);
  const [performed, setPerformed] = useState<Set<string>>(new Set());
  const [cameraReady, setCameraReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    kycApi.issueLivenessChallenge(sessionId)
      .then((c) => setChallenge({ token: c.token, sequence: c.sequence }))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not start liveness check."));
  }, [sessionId]);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; setCameraReady(true); }
      })
      .catch(() => setError("Camera access required. Allow camera permissions and reload."));
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  if (!sessionId || !documentId) {
    return (
      <div className="container" style={{ paddingTop: "var(--s-16)", textAlign: "center" }}>
        <p style={{ color: "var(--reject)" }}>No active session.</p>
        <Button variant="secondary" size="sm" style={{ marginTop: "var(--s-4)" }} onClick={() => router.push("/")}>Go home</Button>
      </div>
    );
  }

  function toggleAction(action: string) {
    setPerformed((prev) => { const n = new Set(prev); n.has(action) ? n.delete(action) : n.add(action); return n; });
  }

  function captureFrame(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const v = videoRef.current;
      if (!v) return reject(new Error("Camera not ready"));
      const c = document.createElement("canvas");
      c.width = v.videoWidth || 640; c.height = v.videoHeight || 480;
      c.getContext("2d")?.drawImage(v, 0, 0);
      c.toBlob((b) => b ? resolve(b) : reject(new Error("Capture failed")), "image/jpeg", 0.92);
    });
  }

  async function handleSubmit() {
    if (!challenge) return;
    setLoading(true);
    setError(null);
    try {
      const frame = await captureFrame();
      const ordered = challenge.sequence.filter((s) => performed.has(s));
      await kycApi.verifyLiveness(sessionId!, challenge.token, ordered, frame);
      router.push(`/verify/face-match?session=${sessionId}&document=${documentId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Liveness check failed. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  const allDone = challenge ? challenge.sequence.every((a) => performed.has(a)) : false;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <div className="container" style={{ paddingTop: "var(--s-8)", paddingBottom: "var(--s-16)", maxWidth: 560 }}>
        <VerificationPipeline status="DOC_VERIFIED" />
        <StepHeader step={3} totalSteps={5} title="Liveness check." description="Look directly at the camera and perform each action listed below." />

        {/* Camera with scan ring */}
        <div style={{ marginBottom: "var(--s-5)" }}>
          <ScanRing active={cameraReady} shape="square">
            <video
              ref={videoRef}
              autoPlay muted playsInline
              style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block", background: "var(--surface-2)", transform: "scaleX(-1)" }}
            />
          </ScanRing>
        </div>

        {/* Challenge checklist */}
        {challenge && (
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--r-xl)", overflow: "hidden", marginBottom: "var(--s-5)" }}>
            <div style={{ padding: "var(--s-3) var(--s-5)", borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
              <p style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-3)" }}>
                Complete all actions
              </p>
            </div>
            {challenge.sequence.map((action, i) => {
              const done = performed.has(action);
              return (
                <label
                  key={action}
                  style={{
                    display: "flex", alignItems: "center", gap: "var(--s-4)",
                    padding: "var(--s-4) var(--s-5)",
                    borderBottom: i < challenge.sequence.length - 1 ? "1px solid var(--border)" : "none",
                    cursor: "pointer",
                    background: done ? "rgba(232,84,42,0.04)" : "transparent",
                    transition: "background var(--t-fast) var(--ease)",
                  }}
                >
                  <div
                    style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      border: `1.5px solid ${done ? "var(--accent)" : "var(--border-2)"}`,
                      background: done ? "var(--accent)" : "var(--surface)",
                      display: "grid", placeItems: "center",
                      transition: "all var(--t-fast) var(--ease)",
                    }}
                  >
                    {done && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <input type="checkbox" checked={done} onChange={() => toggleAction(action)} style={{ display: "none" }} />
                  <span style={{ fontSize: "var(--text-base)", color: done ? "var(--text)" : "var(--text-2)", fontWeight: done ? 600 : 400, textTransform: "capitalize", transition: "all var(--t-fast)" }}>
                    {action.replace(/_/g, " ")}
                  </span>
                  {done && (
                    <span style={{ marginLeft: "auto", fontSize: "var(--text-xs)", color: "var(--accent-text)", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                      done
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        {error && (
          <div style={{ padding: "var(--s-3) var(--s-4)", background: "var(--reject-dim)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: "var(--r-md)", marginBottom: "var(--s-4)", fontSize: "var(--text-sm)", color: "var(--reject)" }}>
            {error}
          </div>
        )}

        <Button fullWidth size="lg" loading={loading} disabled={!cameraReady || !allDone || !challenge} onClick={handleSubmit}>
          {loading ? "Verifying…" : "Submit liveness check"}
        </Button>
      </div>
    </div>
  );
}