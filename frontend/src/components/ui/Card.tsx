import React from "react";

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}

export function Card({ children, style, hover, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-xl)",
        padding: "var(--s-6)",
        transition: hover ? "border-color var(--t-base) var(--ease), box-shadow var(--t-base) var(--ease)" : undefined,
        cursor: onClick ? "pointer" : undefined,
        ...style,
      }}
      onMouseEnter={hover ? (e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "var(--border-2)";
        el.style.boxShadow = "var(--shadow-md)";
      } : undefined}
      onMouseLeave={hover ? (e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.borderColor = "var(--border)";
        el.style.boxShadow = "none";
      } : undefined}
    >
      {children}
    </div>
  );
}