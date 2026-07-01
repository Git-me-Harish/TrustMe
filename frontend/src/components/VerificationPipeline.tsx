"use client";
import React from "react";
import styles from "./VerificationPipeline.module.css";

export type KycStatus =
  | "INITIATED"
  | "DOC_UPLOADED"
  | "DOC_VERIFIED"
  | "LIVENESS_PASSED"
  | "FACE_MATCHED"
  | "RISK_SCORED"
  | "APPROVED"
  | "REJECTED"
  | "MANUAL_REVIEW";

const STEPS: { key: KycStatus; label: string }[] = [
  { key: "INITIATED",       label: "Start" },
  { key: "DOC_VERIFIED",    label: "Document" },
  { key: "LIVENESS_PASSED", label: "Liveness" },
  { key: "FACE_MATCHED",    label: "Face match" },
  { key: "RISK_SCORED",     label: "Assessment" },
];

const TERMINAL_LABELS: Partial<Record<KycStatus, string>> = {
  APPROVED:      "Verified",
  REJECTED:      "Not verified",
  MANUAL_REVIEW: "Under review",
};

function stepIndex(status: KycStatus): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  if (idx !== -1) return idx;
  if (status === "DOC_UPLOADED") return 1;
  return STEPS.length; // terminal
}

export function VerificationPipeline({ status }: { status: KycStatus }) {
  const currentIdx = stepIndex(status);
  const isTerminal = status in TERMINAL_LABELS;

  return (
    <div className={styles.container} role="list" aria-label="Verification progress">
      <div className={styles.rail}>
        {STEPS.map((step, i) => {
          const state =
            i < currentIdx ? "done" : i === currentIdx ? "active" : "pending";
          return (
            <div
              key={step.key}
              className={styles.step}
              data-state={state}
              role="listitem"
            >
              <div className={styles.dot} aria-hidden="true" />
              <span className={styles.label}>{step.label}</span>
            </div>
          );
        })}

        {isTerminal && (
          <div className={styles.terminal}>
            <div
              className={styles["terminal-dot"]}
              data-decision={status}
              aria-hidden="true"
            />
            <span className={styles["terminal-label"]} data-decision={status}>
              {TERMINAL_LABELS[status]}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}