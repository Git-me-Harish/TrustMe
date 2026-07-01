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
    kycApi
      .issueLivenessChallenge(sessionId)
      .then((c) => setChallenge({ token: c.token, sequence: c.sequence }))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not start liveness check.")
      );
  }, [sessionId]);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setCameraReady(true);
        }
      })
      .catch(() => setError("Camera access required. Allow camera permissions and reload."));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!sessionId || !documentId) {
    return (
      <div className="container" style={{ paddingTop: "var(--s-16)", textAlign: "center" }}>
        <p style={{ color: "var(--reject)" }}>No active session.</p>
        <Button variant="secondary" size="sm" style={{ marginTop: "var(--s-4)" }} onClick={() => router.push("/")}>
          Go home
        </Button>
      </div>
    );
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
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Capture failed"))),
        "image/jpeg",
        0.92
      );
    });
  }

  async function handleSubmit() {
    if (!challenge) return;
    setLoading(true);
    setError(null);
    try {
      const frame = await captureFrame();
      const orderedPerformed = challenge.sequence.filter((s) => performed.has(s));
      await kycApi.verifyLiveness(sessionId!, challenge.token, orderedPerformed, frame);
      router.push(`/verify/face-match?session=${sessionId}&document=${documentId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Liveness check failed. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  const allDone = challenge ? challenge.sequence.every((a) => performed.has(a)) : false;

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div
        className="container"
        style={{ flex: 1, paddingTop: "var(--s-8)", paddingBottom: "var(--s-16)", maxWidth: 560 }}
      >
        <VerificationPipeline status="DOC_VERIFIED" />
        <StepHeader
          step={3}
          totalSteps={5}
          title="Liveness check."
          description="Look directly at the camera and perform each action in the list below."
        />

        {/* Camera feed with scan ring */}
        <div style={{ marginBottom: "var(--s-6)" }}>
          <ScanRing active={cameraReady} shape="square">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                aspectRatio: "4/3",
                objectFit: "cover",
                display: "block",
                background: "var(--surface-2)",
                transform: "scaleX(-1)", // mirror
              }}
            />
          </ScanRing>

          {!cameraReady && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "var(--surface-2)",
              }}
            >
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-3)" }}>
                Starting camera…
              </p>
            </div>
          )}
        </div>

        {/* Challenge list */}
        {challenge && (
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
                padding: "var(--s-3) var(--s-5)",
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
                Complete all actions
              </p>
            </div>
            {challenge.sequence.map((action, i) => {
              const done = performed.has(action);
              return (
                <label
                  key={action}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--s-4)",
                    padding: "var(--s-4) var(--s-5)",
                    borderBottom:
                      i < challenge.sequence.length - 1 ? "1px solid var(--border)" : "none",
                    cursor: "pointer",
                    transition: "background var(--t-fast) var(--ease)",
                    background: done ? "var(--accent-dim)" : "transparent",
                  }}
                >
                  {/* Custom checkbox */}
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      border: `1.5px solid ${done ? "var(--accent)" : "var(--border-2)"}`,
                      background: done ? "var(--accent)" : "transparent",
                      flexShrink: 0,
                      display: "grid",
                      placeItems: "center",
                      transition: "all var(--t-fast) var(--ease)",
                    }}
                  >
                    {done && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5l2 2 4-4" stroke="var(--text-inv)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleAction(action)}
                    style={{ display: "none" }}
                  />
                  <span
                    style={{
                      fontSize: "var(--text-base)",
                      color: done ? "var(--text)" : "var(--text-2)",
                      fontWeight: done ? 500 : 400,
                      textTransform: "capitalize",
                      transition: "color var(--t-fast) var(--ease)",
                    }}
                  >
                    {action.replace(/_/g, " ")}
                  </span>
                  {done && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: "var(--text-xs)",
                        color: "var(--accent)",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.04em",
                      }}
                    >
                      done
                    </span>
                  )}
                </label>
              );
            })}
          </div>
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
          disabled={!cameraReady || !allDone || !challenge}
          onClick={handleSubmit}
        >
          {loading ? "Verifying…" : "Submit liveness check"}
        </Button>
      </div>
    </div>
  );
}