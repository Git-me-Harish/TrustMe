"use client";
import React from "react";
import styles from "./ScanRing.module.css";

interface ScanRingProps {
  children: React.ReactNode;
  active?: boolean;
  size?: number;
  shape?: "square" | "circle";
}

export function ScanRing({
  children,
  active = true,
  size,
  shape = "square",
}: ScanRingProps) {
  return (
    <div
      className={styles.wrapper}
      data-active={active.toString()}
      style={{
        width: size ? `${size}px` : undefined,
        height: size ? `${size}px` : undefined,
      }}
    >
      {/* Corner brackets — only for square shape */}
      {shape === "square" && (
        <div className={styles.brackets}>
          <span className={`${styles.bracket} ${styles["bracket-tl"]}`} />
          <span className={`${styles.bracket} ${styles["bracket-tr"]}`} />
          <span className={`${styles.bracket} ${styles["bracket-bl"]}`} />
          <span className={`${styles.bracket} ${styles["bracket-br"]}`} />
        </div>
      )}

      {shape === "circle" && active && (
        <>
          <div className={styles.ring} />
          <div className={styles["ring-expand"]} />
        </>
      )}

      {/* Scan sweep line */}
      {active && <div className={styles["scan-line"]} />}

      {/* Inner content */}
      <div
        className={styles.inner}
        style={{ borderRadius: shape === "circle" ? "50%" : undefined }}
      >
        {children}
      </div>
    </div>
  );
}