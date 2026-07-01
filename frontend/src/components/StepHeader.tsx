"use client";
import React from "react";
import { useRouter } from "next/navigation";

interface StepHeaderProps {
  step: number;
  totalSteps: number;
  title: string;
  description?: string;
}

export function StepHeader({ step, totalSteps, title, description }: StepHeaderProps) {
  const router = useRouter();

  return (
    <div style={{ marginBottom: "var(--s-8)" }}>
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--s-6)",
        }}
      >
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            color: "var(--text-2)",
            fontSize: "var(--text-sm)",
            transition: "color var(--t-fast)",
            padding: "6px 0",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-2)")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>

        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "var(--text-xs)",
            color: "var(--text-3)",
            letterSpacing: "0.06em",
          }}
        >
          {String(step).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
        </span>
      </div>

      {/* Progress bar */}
      <div
        style={{
          height: "2px",
          background: "var(--border)",
          borderRadius: "var(--r-full)",
          marginBottom: "var(--s-8)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(step / totalSteps) * 100}%`,
            background: "var(--accent)",
            borderRadius: "var(--r-full)",
            transition: "width var(--t-slow) var(--ease)",
          }}
        />
      </div>

      {/* Title area */}
      <h1
        style={{
          fontSize: "clamp(var(--text-2xl), 4vw, var(--text-3xl))",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
          color: "var(--text)",
          marginBottom: description ? "var(--s-3)" : 0,
        }}
      >
        {title}
      </h1>
      {description && (
        <p style={{ fontSize: "var(--text-base)", color: "var(--text-2)", lineHeight: 1.6 }}>
          {description}
        </p>
      )}
    </div>
  );
}