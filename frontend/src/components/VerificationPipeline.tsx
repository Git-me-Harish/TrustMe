"use client";

/**
 * VerificationPipeline — renders the actual server-side state machine
 * (ADR-001) as a visual progress rail. Deliberately shows real state names
 * derived from the same enum the backend uses, not a decorative fake
 * progress bar — what the user sees must match what the audit log records.
 */
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
  { key: "INITIATED", label: "Start" },
  { key: "DOC_UPLOADED", label: "Document" },
  { key: "DOC_VERIFIED", label: "Document verified" },
  { key: "LIVENESS_PASSED", label: "Liveness" },
  { key: "FACE_MATCHED", label: "Face match" },
  { key: "RISK_SCORED", label: "Risk assessment" },
];

const TERMINAL_LABEL: Record<string, string> = {
  APPROVED: "Verified",
  REJECTED: "Not verified",
  MANUAL_REVIEW: "Under review",
};

function stepIndex(status: KycStatus): number {
  const idx = STEPS.findIndex((s) => s.key === status);
  if (idx !== -1) return idx;
  // Terminal states sit past the last linear step.
  return STEPS.length;
}

export function VerificationPipeline({ status }: { status: KycStatus }) {
  const currentIndex = stepIndex(status);
  const isTerminal = status in TERMINAL_LABEL;

  return (
    <div className={styles.rail} role="list" aria-label="Verification progress">
      {STEPS.map((step, i) => {
        const state = i < currentIndex ? "done" : i === currentIndex ? "active" : "pending";
        return (
          <div key={step.key} className={styles.step} role="listitem" data-state={state}>
            <span className={styles.marker} aria-hidden="true" />
            <span className={styles.label}>{step.label}</span>
          </div>
        );
      })}
      {isTerminal && (
        <div className={styles.terminal} data-decision={status}>
          {TERMINAL_LABEL[status]}
        </div>
      )}
    </div>
  );
}
