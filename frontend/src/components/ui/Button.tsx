import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "var(--text-inv)",
    border: "1px solid transparent",
  },
  secondary: {
    background: "transparent",
    color: "var(--text)",
    border: "1px solid var(--border-2)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-2)",
    border: "1px solid transparent",
  },
  danger: {
    background: "var(--reject-dim)",
    color: "var(--reject)",
    border: "1px solid rgba(244,63,94,0.2)",
  },
};

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { fontSize: "var(--text-sm)", padding: "6px 14px", borderRadius: "var(--r-md)" },
  md: { fontSize: "var(--text-base)", padding: "10px 20px", borderRadius: "var(--r-md)" },
  lg: { fontSize: "var(--text-lg)", padding: "13px 28px", borderRadius: "var(--r-lg)" },
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  disabled,
  children,
  style,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        fontWeight: 500,
        letterSpacing: "-0.01em",
        transition: `all var(--t-base) var(--ease)`,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.45 : 1,
        width: fullWidth ? "100%" : undefined,
        whiteSpace: "nowrap",
        userSelect: "none",
        ...variantStyles[variant],
        ...sizeStyles[size],
        ...(variant === "primary" && !isDisabled
          ? { boxShadow: "0 0 0 0 var(--accent-glow)" }
          : {}),
        ...style,
      }}
      onMouseEnter={(e) => {
        if (isDisabled) return;
        const el = e.currentTarget;
        if (variant === "primary") {
          el.style.filter = "brightness(1.1)";
          el.style.boxShadow = "var(--shadow-accent)";
        } else if (variant === "secondary") {
          el.style.borderColor = "var(--accent)";
          el.style.color = "var(--accent-text)";
        } else if (variant === "ghost") {
          el.style.color = "var(--text)";
          el.style.background = "var(--surface-2)";
        }
      }}
      onMouseLeave={(e) => {
        if (isDisabled) return;
        const el = e.currentTarget;
        el.style.filter = "";
        el.style.boxShadow = "";
        el.style.borderColor = "";
        el.style.color = variantStyles[variant].color as string;
        el.style.background = variantStyles[variant].background as string;
      }}
      {...props}
    >
      {loading ? (
        <>
          <Spinner />
          {children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
      <path d="M7 1.5a5.5 5.5 0 0 1 5.5 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}