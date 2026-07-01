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
      if (mode === "register") await authApi.register(email, password, fullName || undefined);
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
      {/* ── Left — orange brand panel ─────────────────────── */}
      <div
        style={{
          position: "relative",
          overflow: "hidden",
          background: "var(--accent)",
          padding: "var(--s-12)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Abstract orange shapes */}
        <div aria-hidden="true">
          <div
            style={{
              position: "absolute",
              top: "-20%",
              right: "-20%",
              width: "70%",
              height: "70%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "-10%",
              left: "-10%",
              width: "50%",
              height: "50%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
            }}
          />
        </div>

        {/* Top: logo */}
        <div style={{ position: "relative" }}>
          <div
            onClick={() => router.push("/")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--s-3)",
              cursor: "pointer",
              marginBottom: "var(--s-12)",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "var(--r-md)",
                background: "rgba(255,255,255,0.2)",
                display: "grid",
                placeItems: "center",
              }}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M4 9c0-2.76 2.24-5 5-5s5 2.24 5 5-2.24 5-5 5-5-2.24-5-5z" stroke="#fff" strokeWidth="1.5" />
                <path d="M9 6.5v5M6.5 9h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: "var(--text-base)", color: "rgba(255,255,255,0.9)", letterSpacing: "-0.02em" }}>
              KYC Platform
            </span>
          </div>

          <h1
            style={{
              fontSize: "clamp(var(--text-2xl), 4vw, var(--text-4xl))",
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1.08,
              color: "#FFFFFF",
              marginBottom: "var(--s-5)",
              maxWidth: 340,
            }}
          >
            Identity verification infrastructure.
          </h1>
          <p style={{ fontSize: "var(--text-base)", color: "rgba(255,255,255,0.75)", lineHeight: 1.7, maxWidth: 320 }}>
            Document OCR, liveness detection, and biometric face matching —
            backed by an immutable audit trail. RBI-compliant, self-hosted,
            zero paid APIs.
          </p>
        </div>

        {/* Bottom stats */}
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: "var(--s-8)",
            paddingTop: "var(--s-8)",
            borderTop: "1px solid rgba(255,255,255,0.2)",
          }}
        >
          {[
            { value: "4", label: "Verification steps" },
            { value: "100%", label: "Self-hosted" },
            { value: "₹0", label: "Per-call cost" },
          ].map((s) => (
            <div key={s.label}>
              <p style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.03em", lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: "var(--text-xs)", color: "rgba(255,255,255,0.6)", marginTop: "var(--s-1)" }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right — form ──────────────────────────────────── */}
      <div
        style={{
          background: "var(--bg)",
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
              letterSpacing: "-0.035em",
              color: "var(--text)",
              marginBottom: "var(--s-2)",
            }}
          >
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p style={{ fontSize: "var(--text-sm)", color: "var(--text-2)", marginBottom: "var(--s-8)" }}>
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

      <style>{`
        @media (max-width: 768px) {
          div[style*="grid-template-columns: 1fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
          div[style*="background: var(--accent)"][style*="justify-content: space-between"] {
            min-height: 320px !important;
          }
        }
      `}</style>
    </div>
  );
}