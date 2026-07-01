"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { kycApi, ApiError } from "../lib/api-client";
import { authApi } from "../lib/auth-client";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

/* ── Nav ─────────────────────────────────────────────────────── */
function Nav({ onLogout, isLoggedIn }: { onLogout: () => void; isLoggedIn: boolean }) {
  const router = useRouter();
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: "var(--nav-h)",
        borderBottom: "1px solid var(--border)",
        background: "rgba(7, 11, 16, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}
    >
      <div
        className="container"
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s-4)",
        }}
      >
        {/* Logo */}
        <div
          style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", cursor: "pointer" }}
          onClick={() => router.push("/")}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "var(--r-md)",
              background: "var(--accent-dim)",
              border: "1px solid rgba(0,201,167,0.3)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1" fill="var(--accent)" />
              <rect x="8" y="1" width="5" height="5" rx="1" fill="var(--accent)" opacity="0.5" />
              <rect x="1" y="8" width="5" height="5" rx="1" fill="var(--accent)" opacity="0.5" />
              <rect x="8" y="8" width="5" height="5" rx="1" fill="var(--accent)" />
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: "var(--text-base)", letterSpacing: "-0.02em" }}>
            KYC Platform
          </span>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
          {isLoggedIn ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.push("/sessions")}>
                Sessions
              </Button>
              <Button variant="secondary" size="sm" onClick={onLogout}>
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>
                Log in
              </Button>
              <Button variant="primary" size="sm" onClick={() => router.push("/login")}>
                Get started
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

/* ── Dot grid hero background ────────────────────────────────── */
function DotPattern() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(circle, rgba(26,37,53,0.8) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
        maskImage: "radial-gradient(ellipse 60% 80% at 70% 40%, black 20%, transparent 80%)",
        WebkitMaskImage: "radial-gradient(ellipse 60% 80% at 70% 40%, black 20%, transparent 80%)",
        pointerEvents: "none",
      }}
    />
  );
}

/* ── Process step ────────────────────────────────────────────── */
function ProcessStep({
  num,
  title,
  description,
  delay = 0,
}: {
  num: string;
  title: string;
  description: string;
  delay?: number;
}) {
  return (
    <div
      className="animate-fade-up"
      style={{
        display: "grid",
        gridTemplateColumns: "48px 1fr",
        gap: "var(--s-4)",
        alignItems: "start",
        animationDelay: `${delay}ms`,
        padding: "var(--s-5) 0",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          color: "var(--text-3)",
          letterSpacing: "0.06em",
          paddingTop: "2px",
        }}
      >
        {num}
      </span>
      <div>
        <p
          style={{
            fontSize: "var(--text-base)",
            fontWeight: 600,
            color: "var(--text)",
            marginBottom: "var(--s-1)",
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </p>
        <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)", lineHeight: 1.6 }}>
          {description}
        </p>
      </div>
    </div>
  );
}

/* ── Capability card ─────────────────────────────────────────── */
function CapCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)",
        padding: "var(--s-6)",
        transition: "border-color var(--t-base) var(--ease)",
      }}
      onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border-2)")}
      onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--border)")}
    >
      <p
        style={{
          fontSize: "var(--text-sm)",
          fontWeight: 600,
          color: "var(--text)",
          marginBottom: "var(--s-2)",
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </p>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)", lineHeight: 1.6 }}>
        {body}
      </p>
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────── */
export default function HomePage() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoggedIn(authApi.isLoggedIn());
  }, []);

  function handleLogout() {
    authApi.logout();
    setLoggedIn(false);
  }

  async function handleStart() {
    if (!loggedIn) {
      router.push("/login");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await kycApi.createSession();
      router.push(`/verify/consent?session=${session.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        authApi.logout();
        router.push("/login");
        return;
      }
      setError(err instanceof ApiError ? err.message : "Could not connect to the server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Nav isLoggedIn={loggedIn} onLogout={handleLogout} />

      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            paddingTop: "clamp(var(--s-16), 10vw, var(--s-24))",
            paddingBottom: "clamp(var(--s-16), 10vw, var(--s-24))",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <DotPattern />
          <div className="container" style={{ position: "relative", zIndex: 1 }}>
            <div style={{ maxWidth: 680 }}>
              <Badge variant="accent" style={{ marginBottom: "var(--s-6)" }}>
                India-compliant eKYC
              </Badge>

              <h1
                className="animate-fade-up"
                style={{
                  fontSize: "clamp(2.5rem, 6vw, 4.5rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.04em",
                  lineHeight: 1.06,
                  color: "var(--text)",
                  marginBottom: "var(--s-6)",
                }}
              >
                Identity verification
                <br />
                <span style={{ color: "var(--accent)" }}>that holds up.</span>
              </h1>

              <p
                className="animate-fade-up"
                style={{
                  fontSize: "var(--text-lg)",
                  color: "var(--text-2)",
                  lineHeight: 1.65,
                  maxWidth: 520,
                  marginBottom: "var(--s-8)",
                  animationDelay: "60ms",
                }}
              >
                Document OCR, liveness detection, and ArcFace biometric matching
                across an immutable, hash-chained audit trail. Built on UIDAI
                Offline Aadhaar and RBI Master Direction.
              </p>

              <div
                className="animate-fade-up"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-3)",
                  flexWrap: "wrap",
                  animationDelay: "120ms",
                }}
              >
                <Button size="lg" loading={loading} onClick={handleStart}>
                  Start verification
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Button>
                {loggedIn && (
                  <Button variant="secondary" size="lg" onClick={() => router.push("/sessions")}>
                    View sessions
                  </Button>
                )}
              </div>

              {error && (
                <p
                  style={{
                    marginTop: "var(--s-4)",
                    fontSize: "var(--text-sm)",
                    color: "var(--reject)",
                  }}
                >
                  {error}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Supported documents strip ─────────────────────────── */}
        <section
          style={{
            borderBottom: "1px solid var(--border)",
            padding: "var(--s-5) 0",
            background: "var(--surface)",
          }}
        >
          <div
            className="container"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--s-6)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: "var(--text-xs)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--text-3)",
                fontWeight: 500,
                flexShrink: 0,
              }}
            >
              Accepted documents
            </span>
            {["Aadhaar", "PAN Card", "Passport", "Driving Licence"].map((doc) => (
              <span
                key={doc}
                style={{
                  fontSize: "var(--text-sm)",
                  color: "var(--text-2)",
                  padding: "4px 12px",
                  background: "var(--surface-2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-full)",
                }}
              >
                {doc}
              </span>
            ))}
          </div>
        </section>

        {/* ── Process ──────────────────────────────────────────── */}
        <section style={{ padding: "clamp(var(--s-16), 10vw, var(--s-24)) 0", borderBottom: "1px solid var(--border)" }}>
          <div className="container">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
                gap: "clamp(var(--s-8), 6vw, var(--s-24))",
                alignItems: "start",
              }}
            >
              {/* Left: heading */}
              <div style={{ position: "sticky", top: "calc(var(--nav-h) + var(--s-8))" }}>
                <p
                  style={{
                    fontSize: "var(--text-xs)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--text-3)",
                    marginBottom: "var(--s-4)",
                    fontWeight: 500,
                  }}
                >
                  The process
                </p>
                <h2
                  style={{
                    fontSize: "clamp(var(--text-2xl), 3.5vw, var(--text-4xl))",
                    fontWeight: 800,
                    letterSpacing: "-0.035em",
                    lineHeight: 1.1,
                    color: "var(--text)",
                    marginBottom: "var(--s-5)",
                  }}
                >
                  Four steps from document to decision.
                </h2>
                <p style={{ fontSize: "var(--text-base)", color: "var(--text-2)", lineHeight: 1.7, maxWidth: 380 }}>
                  Every step writes to a hash-chained audit log. The risk engine
                  combines all signals into a single composite score with a full
                  breakdown — auditable, explainable, and regulator-ready.
                </p>
              </div>

              {/* Right: steps */}
              <div>
                {[
                  { num: "01", title: "Document capture", description: "Upload any OVD — Aadhaar, PAN, Passport, or Driving Licence. PaddleOCR classifies the document type and extracts structured fields automatically." },
                  { num: "02", title: "Liveness verification", description: "A randomized challenge sequence (blink, turn, smile) combined with passive anti-spoof scoring defeats pre-recorded video and print attacks." },
                  { num: "03", title: "Biometric face match", description: "ArcFace embeddings (InsightFace buffalo_l) compare the document photo against a live selfie frame. Cosine similarity thresholded at 0.62." },
                  { num: "04", title: "Risk decision", description: "A weighted scoring engine combines face match similarity, liveness verdict, document integrity, and Aadhaar signature validity into a composite score." },
                ].map((step, i) => (
                  <ProcessStep key={step.num} {...step} delay={i * 60} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Capabilities ─────────────────────────────────────── */}
        <section style={{ padding: "clamp(var(--s-16), 10vw, var(--s-24)) 0", borderBottom: "1px solid var(--border)" }}>
          <div className="container">
            <p
              style={{
                fontSize: "var(--text-xs)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--text-3)",
                marginBottom: "var(--s-4)",
                fontWeight: 500,
              }}
            >
              Built-in
            </p>
            <h2
              style={{
                fontSize: "clamp(var(--text-xl), 3vw, var(--text-3xl))",
                fontWeight: 800,
                letterSpacing: "-0.035em",
                color: "var(--text)",
                marginBottom: "var(--s-10)",
              }}
            >
              No external paid APIs. Everything self-hosted.
            </h2>
            <div
              className="stagger"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "var(--s-4)",
              }}
            >
              {[
                { title: "ArcFace biometrics", body: "InsightFace buffalo_l — ONNX runtime, CPU-capable, zero per-call cost. Replaces legacy FaceNet/VGGFace2." },
                { title: "Offline Aadhaar verify", body: "UIDAI XML/QR cryptographic signature verification using the published public certificate. No AUA/KUA license required." },
                { title: "PaddleOCR extraction", body: "Self-hosted OCR for all Indian OVDs. Classifies document type and extracts name, DOB, and document number." },
                { title: "Immutable audit trail", body: "SHA-256 hash-chained event log. Retroactive tampering is structurally detectable — every state change is recorded." },
                { title: "Strict state machine", body: "Sessions can only advance through allowed transitions. Invalid sequences are rejected at the API layer, not just the UI." },
                { title: "Consent management", body: "Explicit, per-session biometric consent logged with timestamp — required by RBI Master Direction and PDPB-aligned principles." },
              ].map((cap) => (
                <CapCard key={cap.title} {...cap} />
              ))}
            </div>
          </div>
        </section>

        {/* ── Compliance strip ──────────────────────────────────── */}
        <section style={{ padding: "var(--s-12) 0" }}>
          <div className="container">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "clamp(var(--s-6), 4vw, var(--s-16))",
                flexWrap: "wrap",
              }}
            >
              {[
                "RBI Master Direction on KYC",
                "UIDAI Offline e-KYC",
                "GDPR-aligned data handling",
                "FATF AML/CFT principles",
              ].map((item) => (
                <span
                  key={item}
                  style={{
                    fontSize: "var(--text-sm)",
                    color: "var(--text-3)",
                    letterSpacing: "-0.01em",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "var(--s-8) 0",
          background: "var(--surface)",
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--s-4)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "var(--text-xs)",
              color: "var(--text-3)",
            }}
          >
            KYC Platform v1.0
          </span>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
            Built for regulated financial onboarding
          </span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          section > .container > div[style*="grid-template-columns: minmax"] {
            grid-template-columns: 1fr !important;
          }
          section > .container > div[style*="position: sticky"] {
            position: static !important;
          }
        }
      `}</style>
    </>
  );
}