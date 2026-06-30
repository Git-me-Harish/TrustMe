"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, AuthApiError } from "../../lib/auth-client";

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
        await authApi.register(email, password, fullName);
        // Registration succeeded — log in immediately so the user doesn't
        // have to re-type credentials on a second screen.
      }
      await authApi.login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "0 auto", padding: "var(--space-12) var(--space-4)" }}>
      <h1 style={{ fontSize: "var(--fs-xl)", marginBottom: "var(--space-6)" }}>
        {mode === "login" ? "Sign in" : "Create account"}
      </h1>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {mode === "register" && (
          <input
            placeholder="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={inputStyle}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password (min 10 characters)"
          required
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />

        <button type="submit" disabled={loading} style={buttonStyle}>
          {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>

      {error && <p style={{ color: "var(--color-reject)", marginTop: "var(--space-4)" }}>{error}</p>}

      <button
        onClick={() => setMode(mode === "login" ? "register" : "login")}
        style={{ background: "none", border: "none", color: "var(--color-text-secondary)", marginTop: "var(--space-6)", cursor: "pointer" }}
      >
        {mode === "login" ? "Need an account? Register" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "var(--space-3)",
  color: "var(--color-text-primary)",
  fontSize: "var(--fs-base)",
};

const buttonStyle: React.CSSProperties = {
  background: "var(--color-verify)",
  color: "#0b0d10",
  border: "none",
  borderRadius: "var(--radius-md)",
  padding: "var(--space-3) var(--space-6)",
  fontSize: "var(--fs-base)",
  cursor: "pointer",
};
