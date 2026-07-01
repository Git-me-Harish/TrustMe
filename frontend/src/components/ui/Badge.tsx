import React from "react";

type BadgeVariant = "default" | "accent" | "approve" | "review" | "reject" | "mono";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  style?: React.CSSProperties;
}

const variantMap: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)" },
  accent:  { background: "var(--accent-dim)", color: "var(--accent-text)", border: "1px solid rgba(232,84,42,0.2)" },
  approve: { background: "var(--approve-dim)", color: "var(--approve)", border: "1px solid rgba(22,163,74,0.2)" },
  review:  { background: "var(--review-dim)", color: "var(--review)", border: "1px solid rgba(217,119,6,0.2)" },
  reject:  { background: "var(--reject-dim)", color: "var(--reject)", border: "1px solid rgba(220,38,38,0.2)" },
  mono:    { background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)", fontFamily: "var(--font-mono)" },
};

export function Badge({ children, variant = "default", style }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "3px 9px",
        borderRadius: "var(--r-full)",
        lineHeight: 1.4,
        ...variantMap[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}