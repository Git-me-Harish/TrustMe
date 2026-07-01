"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { kycApi, ApiError } from "../../../lib/api-client";
import { Button } from "../../../components/ui/Button";
import { StepHeader } from "../../../components/StepHeader";
import { VerificationPipeline } from "../../../components/VerificationPipeline";
import { ScanRing } from "../../../components/ScanRing";

export default function FaceMatchPage() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");
  const documentId = params.get("document");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captured, setCaptured] = useState(false);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } } })
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

  function captureFrame(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const video = videoRef.current;
      if (!video) return reject(new Error("Camera not ready"));
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 640;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Capture failed"))),
        "image/jpeg",
        0.95
      );
    });
  }

  async function handleCapture() {
    setLoading(true);
    setError(null);
    setCaptured(true);
    try {
      const selfie = await captureFrame();
      streamRef.current?.getTracks().forEach((t) => t.stop()); // stop cam after capture
      await kycApi.faceMatch(sessionId!, documentId!, selfie);
      router.push(`/verify/decision?session=${sessionId}`);
    } catch (err) {
      setCaptured(false);
      if (err instanceof ApiError && err.status === 404) {
        setError("Document not found for this session. Start a new verification.");
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : "Face match failed. Ensure only your face is visible in frame."
        );
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column" }}>
      <div
        className="container"
        style={{ flex: 1, paddingTop: "var(--s-8)", paddingBottom: "var(--s-16)", maxWidth: 520 }}
      >
        <VerificationPipeline status="LIVENESS_PASSED" />
        <StepHeader
          step={4}
          totalSteps={5}
          title="Biometric face match."
          description="Position your face clearly in the frame. Your face will be matched against the photo extracted from your ID document."
        />

        {/* Camera with scan ring */}
        <div style={{ marginBottom: "var(--s-6)", position: "relative" }}>
          <ScanRing active={cameraReady && !captured} shape="circle" size={320}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{
                width: 320,
                height: 320,
                objectFit: "cover",
                display: "block",
                borderRadius: "50%",
                transform: "scaleX(-1)",
                background: "var(--surface-2)",
              }}
            />
          </ScanRing>

          {/* Alignment guides */}
          {cameraReady && !captured && (
            <p
              style={{
                textAlign: "center",
                marginTop: "var(--s-4)",
                fontSize: "var(--text-sm)",
                color: "var(--text-3)",
              }}
            >
              Align your face within the circle
            </p>
          )}
        </div>

        {/* Tips panel */}
        {!captured && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--s-3)",
              marginBottom: "var(--s-6)",
            }}
          >
            {[
              { label: "Good lighting", detail: "Face a window or light source" },
              { label: "Face forward", detail: "Look directly at the camera" },
              { label: "Remove glasses", detail: "For best matching accuracy" },
              { label: "Neutral expression", detail: "Matches document photo better" },
            ].map((tip) => (
              <div
                key={tip.label}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-lg)",
                  padding: "var(--s-3) var(--s-4)",
                }}
              >
                <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text)", marginBottom: "2px" }}>
                  {tip.label}
                </p>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)", lineHeight: 1.5 }}>
                  {tip.detail}
                </p>
              </div>
            ))}
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
          disabled={!cameraReady || captured}
          onClick={handleCapture}
        >
          {loading ? "Matching biometrics…" : "Capture and match"}
        </Button>

        <p
          style={{
            marginTop: "var(--s-4)",
            fontSize: "var(--text-xs)",
            color: "var(--text-3)",
            textAlign: "center",
            lineHeight: 1.6,
          }}
        >
          ArcFace (InsightFace buffalo_l) — cosine similarity against document photo.
          Raw frames are not retained after comparison.
        </p>
      </div>
    </div>
  );
}