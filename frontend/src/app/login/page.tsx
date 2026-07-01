"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, AuthApiError } from "../../lib/auth-client";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        await authApi.register(email, password, fullName || undefined);
      }
      await authApi.login(email, password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Something went wrong. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
      }}
    >
      {/* ── Left panel — product pitch ──────────────────────── */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          background: "var(--surface)",
          borderRight: "1px solid var(--border)",
          padding: "var(--s-12)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Dot texture */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage: "radial-gradient(ellipse 80% 80% at 20% 60%, black 20%, transparent 80%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 20% 60%, black 20%, transparent 80%)",
            opacity: 0.6,
          }}
        />

        {/* Content */}
        <div style={{ position: "relative" }}>
          {/* Logo mark */}
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "var(--r-lg)",
              background: "var(--accent-dim)",
              border: "1px solid rgba(0,201,167,0.3)",
              display: "grid",
              placeItems: "center",
              marginBottom: "var(--s-12)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="1" y="1" width="6.5" height="6.5" rx="1.5" fill="var(--accent)" />
              <rect x="10.5" y="1" width="6.5" height="6.5" rx="1.5" fill="var(--accent)" opacity="0.5" />
              <rect x="1" y="10.5" width="6.5" height="6.5" rx="1.5" fill="var(--accent)" opacity="0.5" />
              <rect x="10.5" y="10.5" width="6.5" height="6.5" rx="1.5" fill="var(--accent)" />
            </svg>
          </div>

          <h1
            style={{
              fontSize: "clamp(var(--text-2xl), 4vw, var(--text-4xl))",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.08,
              color: "var(--text)",
              marginBottom: "var(--s-5)",
              maxWidth: 380,
            }}
          >
            Identity verification
            {" "}
            <span style={{ color: "var(--accent)" }}>infrastructure.</span>
          </h1>

          <p
            style={{
              fontSize: "var(--text-base)",
              color: "var(--text-2)",
              lineHeight: 1.7,
              maxWidth: 340,
            }}
          >
            Document OCR, liveness detection, and biometric face matching —
            backed by an immutable audit trail and compliant with RBI KYC
            guidelines.
          </p>
        </div>

        {/* Bottom stat row */}
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: "var(--s-8)",
            paddingTop: "var(--s-8)",
            borderTop: "1px solid var(--border)",
          }}
        >
          {[
            { value: "4", label: "Verification steps" },
            { value: "100%", label: "Self-hosted" },
            { value: "0", label: "Paid APIs" },
          ].map((stat) => (
            <div key={stat.label}>
              <p
                style={{
                  fontSize: "var(--text-xl)",
                  fontWeight: 800,
                  color: "var(--accent)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                  marginBottom: "var(--s-1)",
                }}
              >
                {stat.value}
              </p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--text-3)" }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right panel — form ───────────────────────────────── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--s-8)",
        }}
      >
        <div style={{ width: "100%", maxWidth: 360 }} className="animate-fade-up">
          <h2
            style={{
              fontSize: "var(--text-2xl)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              marginBottom: "var(--s-2)",
              color: "var(--text)",
            }}
          >
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p
            style={{
              fontSize: "var(--text-sm)",
              color: "var(--text-2)",
              marginBottom: "var(--s-8)",
            }}
          >
            {mode === "login"
              ? "Sign in to access your verification sessions."
              : "Set up your account to start verifying identities."}
          </p>

          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
          >
            {mode === "register" && (
              <Input
                label="Full name"
                placeholder="Your name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            )}

            <Input
              label="Email address"
              type="email"
              placeholder="you@company.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete={mode === "login" ? "email" : "new-email"}
            />

            <Input
              label="Password"
              type="password"
              placeholder={mode === "register" ? "Minimum 10 characters" : "Your password"}
              required
              minLength={mode === "register" ? 10 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              error={error ?? undefined}
            />

            <Button type="submit" fullWidth loading={loading} size="lg" style={{ marginTop: "var(--s-2)" }}>
              {mode === "login" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div
            style={{
              marginTop: "var(--s-6)",
              paddingTop: "var(--s-6)",
              borderTop: "1px solid var(--border)",
              textAlign: "center",
            }}
          >
            <button
              type="button"
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
              style={{
                fontSize: "var(--text-sm)",
                color: "var(--text-2)",
                transition: "color var(--t-fast)",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-text)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-2)")}
            >
              {mode === "login"
                ? "No account? Create one"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: stack vertically */}
      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="border-right: 1px solid var(--border)"] {
            border-right: none !important;
            border-bottom: 1px solid var(--border);
            padding: var(--s-8) !important;
            min-height: unset !important;
          }
        }
      `}</style>
    </div>
  );
}