"use client";
import React, { useState } from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export function Input({ label, hint, error, id, style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: "var(--text-sm)",
            fontWeight: 500,
            color: "var(--text-2)",
            letterSpacing: "-0.01em",
          }}
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%",
          background: "var(--surface-2)",
          border: `1px solid ${error ? "var(--reject)" : focused ? "var(--accent)" : "var(--border-2)"}`,
          borderRadius: "var(--r-md)",
          padding: "10px 14px",
          color: "var(--text)",
          fontSize: "var(--text-base)",
          outline: "none",
          transition: "border-color var(--t-fast) var(--ease)",
          ...style,
        }}
        {...props}
      />
      {(hint || error) && (
        <p
          style={{
            fontSize: "var(--text-xs)",
            color: error ? "var(--reject)" : "var(--text-3)",
            lineHeight: 1.5,
          }}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}