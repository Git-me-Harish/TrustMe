"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { kycApi, ApiError } from "../lib/api-client";
import { authApi } from "../lib/auth-client";
import { Button } from "../components/ui/Button";

/* ── Icon components (line-art, matching Ascon style) ──────── */

function IconDocument() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" strokeWidth="1.5" stroke="var(--text-2)">
      <rect x="10" y="6" width="28" height="36" rx="2" />
      <path d="M16 16h16M16 22h16M16 28h10" strokeLinecap="round" />
      <path d="M32 6v8h6" />
      <circle cx="36" cy="36" r="6" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
      <path d="M33 36l2 2 4-3" stroke="var(--accent)" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconLiveness() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" strokeWidth="1.5" stroke="var(--text-2)">
      <circle cx="24" cy="24" r="14" />
      <circle cx="24" cy="24" r="7" stroke="var(--accent)" />
      <path d="M8 24h4M36 24h4M24 8v4M24 36v4" strokeLinecap="round" />
      <path d="M12.5 12.5l2.8 2.8M32.7 32.7l2.8 2.8M35.5 12.5l-2.8 2.8M15.3 32.7l-2.8 2.8" strokeLinecap="round" />
    </svg>
  );
}

function IconFaceMatch() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" strokeWidth="1.5" stroke="var(--text-2)">
      <circle cx="24" cy="20" r="9" />
      <path d="M21 20c0-1.7 1.3-3 3-3s3 1.3 3 3" stroke="var(--accent)" strokeLinecap="round" />
      <path d="M8 40c0-8.8 7.2-16 16-16s16 7.2 16 16" strokeLinecap="round" />
      <path d="M6 10h6M6 14h4" strokeLinecap="round" stroke="var(--accent)" />
      <path d="M42 10h-6M42 14h-4" strokeLinecap="round" stroke="var(--accent)" />
    </svg>
  );
}

function IconAadhaar() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" fill="none" strokeWidth="1.5" stroke="var(--text-2)">
      <rect x="8" y="8" width="14" height="14" rx="2" />
      <rect x="26" y="8" width="14" height="14" rx="2" />
      <rect x="8" y="26" width="14" height="14" rx="2" />
      <rect x="11" y="11" width="8" height="8" rx="1" stroke="var(--accent)" fill="var(--accent-dim)" />
      <rect x="29" y="11" width="8" height="8" rx="1" stroke="var(--accent)" fill="var(--accent-dim)" />
      <rect x="11" y="29" width="8" height="8" rx="1" stroke="var(--accent)" fill="var(--accent-dim)" />
      <path d="M26 29h4v4M34 26v4h-4M26 38h4M34 34h4M34 38h4" strokeLinecap="round" />
    </svg>
  );
}

/* ── Feature card (Ascon-style) ─────────────────────────────── */
function FeatureCard({
  icon,
  title,
  tagline,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  tagline: string;
  body: string;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--surface)",
        border: `1px solid ${hovered ? "var(--border-2)" : "var(--border)"}`,
        borderRadius: "var(--r-xl)",
        padding: "var(--s-8)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--s-4)",
        transition: `all var(--t-base) var(--ease)`,
        boxShadow: hovered ? "var(--shadow-md)" : "none",
        transform: hovered ? "translateY(-2px)" : "none",
      }}
    >
      {/* Icon area */}
      <div style={{ marginBottom: "var(--s-2)" }}>{icon}</div>

      {/* Title */}
      <h3
        style={{
          fontSize: "var(--text-xl)",
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "var(--text)",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>

      {/* Tagline — accent colored, like Ascon's red italic lines */}
      <p
        style={{
          fontSize: "var(--text-sm)",
          color: "var(--accent-text)",
          fontStyle: "italic",
          fontWeight: 600,
          letterSpacing: "-0.01em",
        }}
      >
        {tagline}
      </p>

      {/* Divider */}
      <div style={{ height: "1px", background: "var(--border)" }} />

      {/* Body */}
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)", lineHeight: 1.7 }}>
        {body}
      </p>
    </div>
  );
}

/* ── Nav ─────────────────────────────────────────────────────── */
function Nav({ isLoggedIn, onLogout }: { isLoggedIn: boolean; onLogout: () => void }) {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: "var(--nav-h)",
        background: scrolled ? "rgba(247,244,240,0.95)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid var(--border)" : "none",
        transition: "all var(--t-base) var(--ease)",
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
          onClick={() => router.push("/")}
          style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", cursor: "pointer" }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: "var(--r-md)",
              background: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5-5-2.24-5-5z" stroke="#fff" strokeWidth="1.5" />
              <path d="M8 5.5v5M5.5 8h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span
            style={{
              fontWeight: 800,
              fontSize: "var(--text-base)",
              letterSpacing: "-0.03em",
              color: "var(--text)",
            }}
          >
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

/* ── Hero orange blob (CSS-only, no external images) ────────── */
function HeroBlob() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: "-20%",
        right: "-10%",
        width: "65%",
        height: "140%",
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
      }}
    >
      {/* Primary blob */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          left: "5%",
          width: "80%",
          height: "80%",
          borderRadius: "44% 56% 66% 34% / 40% 44% 56% 60%",
          background: "radial-gradient(ellipse at 40% 40%, #E8542A 0%, #F07848 40%, #F5A882 70%, transparent 100%)",
          opacity: 0.92,
          animation: "float 8s ease-in-out infinite",
        }}
      />
      {/* Secondary highlight */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "30%",
          width: "50%",
          height: "50%",
          borderRadius: "50%",
          background: "radial-gradient(ellipse, rgba(255,200,160,0.8) 0%, transparent 70%)",
          animation: "float 10s ease-in-out infinite",
          animationDelay: "-3s",
        }}
      />
      {/* Subtle ring */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "15%",
          width: "60%",
          height: "60%",
          borderRadius: "50%",
          border: "60px solid rgba(232, 84, 42, 0.12)",
          animation: "float 12s ease-in-out infinite",
          animationDelay: "-6s",
        }}
      />
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
    if (!loggedIn) { router.push("/login"); return; }
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
      setError(err instanceof ApiError ? err.message : "Server unreachable.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Nav isLoggedIn={loggedIn} onLogout={handleLogout} />

      <main>
        {/* ── HERO ───────────────────────────────────────────── */}
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            paddingTop: "clamp(80px, 12vw, 160px)",
            paddingBottom: "clamp(80px, 12vw, 160px)",
            background: "var(--bg)",
          }}
        >
          <HeroBlob />
          <div className="container" style={{ position: "relative", zIndex: 1 }}>
            <div style={{ maxWidth: 640 }}>
              {/* Section label */}
              <div
                className="animate-fade-up"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-3)",
                  marginBottom: "var(--s-6)",
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 3,
                    background: "var(--accent)",
                    borderRadius: "var(--r-full)",
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--text-xs)",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--accent-text)",
                  }}
                >
                  India-compliant eKYC
                </span>
              </div>

              {/* Headline */}
              <h1
                className="animate-fade-up"
                style={{
                  fontSize: "clamp(2.75rem, 7vw, 5.5rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.045em",
                  lineHeight: 1.02,
                  color: "var(--text)",
                  marginBottom: "var(--s-6)",
                  animationDelay: "40ms",
                }}
              >
                The only limit
                <br />
                is your{" "}
                <span style={{ color: "var(--accent)" }}>imagination.</span>
              </h1>

              <p
                className="animate-fade-up"
                style={{
                  fontSize: "var(--text-lg)",
                  color: "var(--text-2)",
                  lineHeight: 1.65,
                  maxWidth: 500,
                  marginBottom: "var(--s-8)",
                  animationDelay: "80ms",
                }}
              >
                With KYC Platform, you can verify any identity — documents,
                liveness, biometrics — without the need for paid APIs or
                external services.
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
                <p style={{ marginTop: "var(--s-4)", fontSize: "var(--text-sm)", color: "var(--reject)" }}>
                  {error}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── WHY KYC PLATFORM — Ascon-exact layout ───────────── */}
        <section
          style={{
            background: "var(--surface-2)",
            padding: "clamp(var(--s-16), 10vw, var(--s-24)) 0",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="container">
            {/* Section label row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-3)",
                marginBottom: "var(--s-10)",
              }}
            >
              <div style={{ width: 10, height: 3, background: "var(--accent)", borderRadius: "var(--r-full)" }} />
              <span
                style={{
                  fontSize: "var(--text-xs)",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--accent-text)",
                }}
              >
                Why KYC Platform?
              </span>
            </div>

            {/* Ascon layout: left text + right headline */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 2fr",
                gap: "clamp(var(--s-8), 6vw, var(--s-24))",
                alignItems: "start",
                marginBottom: "clamp(var(--s-10), 6vw, var(--s-16))",
              }}
            >
              {/* Left: description */}
              <div>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)", lineHeight: 1.8, marginBottom: "var(--s-6)" }}>
                  Are you ready for compliant, production-grade identity verification?
                </p>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)", lineHeight: 1.8, marginBottom: "var(--s-6)" }}>
                  With our platform you can run full eKYC — document OCR,
                  liveness detection, and biometric face matching — entirely
                  self-hosted, with no per-call API costs and no vendor lock-in.
                  This increases regulatory confidence, eliminates third-party
                  data exposure, and gives you complete auditability.
                </p>
                <p
                  style={{
                    fontSize: "var(--text-sm)",
                    fontWeight: 700,
                    fontStyle: "italic",
                    color: "var(--text)",
                    lineHeight: 1.6,
                  }}
                >
                  It&apos;s not magic, it&apos;s just rigorous, production-grade engineering.
                </p>
              </div>

              {/* Right: big headline */}
              <div>
                <h2
                  style={{
                    fontSize: "clamp(var(--text-2xl), 4vw, var(--text-4xl))",
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    lineHeight: 1.1,
                    color: "var(--text)",
                  }}
                >
                  Precise, compliant, efficient: we verify identities that hold up to scrutiny.
                </h2>
              </div>
            </div>

            {/* 2×2 feature grid — Ascon exact */}
            <div
              className="stagger"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "var(--s-4)",
              }}
            >
              <FeatureCard
                icon={<IconDocument />}
                title="Document OCR"
                tagline="Reading is no longer the hard part."
                body="PaddleOCR classifies Aadhaar, PAN, Passport, and Driving Licences automatically. It extracts structured fields — name, DOB, document number — with confidence scoring. Entirely self-hosted, no per-call cost."
              />
              <FeatureCard
                icon={<IconLiveness />}
                title="Liveness Detection"
                tagline="Be in the room, not just in the photo."
                body="A randomized challenge sequence (blink, turn, smile) combined with passive anti-spoof texture scoring defeats print attacks, replay video, and digital spoofing. Both signals must pass — neither is sufficient alone."
              />
              <FeatureCard
                icon={<IconFaceMatch />}
                title="Biometric Face Match"
                tagline="One face. No mistaking it."
                body="ArcFace embeddings (InsightFace buffalo_l, ONNX runtime) compare the document photo against a live selfie frame with cosine similarity. ArcFace's angular margin loss materially outperforms legacy FaceNet/VGGFace2 approaches."
              />
              <FeatureCard
                icon={<IconAadhaar />}
                title="Offline Aadhaar Verify"
                tagline="Verified without a single API call."
                body="UIDAI Offline e-KYC XML/QR — cryptographic signature verification using the published public certificate. No AUA/KUA license required. The same trust root as live e-KYC, without the regulatory burden."
              />
            </div>
          </div>
        </section>

        {/* ── THE PROCESS ─────────────────────────────────────── */}
        <section
          style={{
            background: "var(--surface)",
            padding: "clamp(var(--s-16), 10vw, var(--s-24)) 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="container">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "clamp(var(--s-8), 6vw, var(--s-24))",
                alignItems: "start",
              }}
            >
              {/* Left: sticky label + headline */}
              <div style={{ position: "sticky", top: "calc(var(--nav-h) + var(--s-6))" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", marginBottom: "var(--s-5)" }}>
                  <div style={{ width: 10, height: 3, background: "var(--accent)", borderRadius: "var(--r-full)" }} />
                  <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--accent-text)" }}>
                    The process
                  </span>
                </div>
                <h2
                  style={{
                    fontSize: "clamp(var(--text-2xl), 3.5vw, var(--text-4xl))",
                    fontWeight: 800,
                    letterSpacing: "-0.04em",
                    lineHeight: 1.1,
                    color: "var(--text)",
                    marginBottom: "var(--s-5)",
                  }}
                >
                  Four steps from document to decision.
                </h2>
                <p style={{ fontSize: "var(--text-base)", color: "var(--text-2)", lineHeight: 1.7 }}>
                  Every step writes to a hash-chained audit log. The risk engine
                  produces a composite score with full signal breakdown — auditable
                  and regulator-ready.
                </p>
              </div>

              {/* Right: numbered steps */}
              <div>
                {[
                  {
                    n: "01",
                    title: "Document capture",
                    body: "Upload any OVD — Aadhaar, PAN, Passport, or Driving Licence. PaddleOCR classifies the document type and extracts structured fields automatically.",
                  },
                  {
                    n: "02",
                    title: "Liveness verification",
                    body: "A randomized challenge sequence combined with passive anti-spoof scoring defeats pre-recorded video and print-photo attacks.",
                  },
                  {
                    n: "03",
                    title: "Biometric face match",
                    body: "ArcFace embeddings compare the document photo against a live selfie frame. Cosine similarity thresholded at 0.62 — calibrated on a validation set.",
                  },
                  {
                    n: "04",
                    title: "Risk decision",
                    body: "A weighted scoring engine combines all signals into a composite score → APPROVED / REJECTED / MANUAL REVIEW. Every decision is logged, explainable, and verifiable.",
                  },
                ].map((step, i) => (
                  <div
                    key={step.n}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "52px 1fr",
                      gap: "var(--s-4)",
                      padding: "var(--s-5) 0",
                      borderBottom: "1px solid var(--border)",
                      alignItems: "start",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "var(--text-xs)",
                        color: "var(--accent-text)",
                        fontWeight: 600,
                        paddingTop: "3px",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {step.n}
                    </span>
                    <div>
                      <p style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text)", marginBottom: "var(--s-2)", letterSpacing: "-0.02em" }}>
                        {step.title}
                      </p>
                      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)", lineHeight: 1.7 }}>
                        {step.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── COMPLIANCE STRIP ─────────────────────────────────── */}
        <section
          style={{
            background: "var(--bg)",
            padding: "var(--s-12) 0",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="container">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "var(--s-4)",
              }}
            >
              <p style={{ fontSize: "var(--text-sm)", color: "var(--text-3)", fontWeight: 500 }}>
                Built to standard:
              </p>
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
                    color: "var(--text-2)",
                    padding: "4px 14px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-full)",
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────── */}
        <section
          style={{
            background: "var(--accent)",
            padding: "clamp(var(--s-16), 8vw, var(--s-20)) 0",
          }}
        >
          <div className="container" style={{ textAlign: "center" }}>
            <h2
              style={{
                fontSize: "clamp(var(--text-2xl), 4vw, var(--text-4xl))",
                fontWeight: 800,
                letterSpacing: "-0.04em",
                lineHeight: 1.1,
                color: "#FFFFFF",
                marginBottom: "var(--s-4)",
              }}
            >
              Ready to verify?
            </h2>
            <p
              style={{
                fontSize: "var(--text-lg)",
                color: "rgba(255,255,255,0.8)",
                marginBottom: "var(--s-8)",
                maxWidth: 440,
                marginInline: "auto",
                lineHeight: 1.6,
              }}
            >
              Start your first KYC session in under a minute.
            </p>
            <Button
              size="lg"
              style={{
                background: "var(--text-inv)",
                color: "var(--accent)",
                border: "none",
              }}
              loading={loading}
              onClick={handleStart}
            >
              Start verification
            </Button>
          </div>
        </section>
      </main>

      {/* ── FOOTER ───────────────────────────────────────────── */}
      <footer
        style={{
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          padding: "var(--s-8) 0",
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
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
            KYC Platform v1.0 — identity verification infrastructure
          </span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-3)" }}>
            100% self-hosted · zero paid APIs
          </span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}