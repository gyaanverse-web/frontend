import type { HTMLAttributes, ReactNode } from "react";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { ScoreBadge } from "./ScoreBadge";
import { ScannedUpload, type ScannedStep } from "./ScannedUpload";
import { FeedbackCallout } from "./FeedbackCallout";

export type AIEvaluationStatus = "evaluated" | "evaluating" | "pending";

export interface AIEvaluationCardProps extends HTMLAttributes<HTMLDivElement> {
  student?: string;
  exam?: string;
  score?: number | string;
  outOf?: number;
  status?: AIEvaluationStatus;
  steps?: ScannedStep[];
  mistake?: ReactNode;
  alternative?: ReactNode;
  tip?: ReactNode;
  teacherOverride?: boolean;
  onOverride?: () => void;
}

/** The signature dark AI-evaluation card (live-site screens #24/#30). status: 'evaluated' | 'evaluating' | 'pending'. */
export function AIEvaluationCard({
  student = "Rahul S.",
  exam = "Calculus Mid-Term (Scanned)",
  score = 6,
  outOf = 10,
  status = "evaluated",
  steps = [],
  mistake = null,
  alternative = null,
  tip = null,
  teacherOverride = false,
  onOverride = () => {},
  style,
  ...rest
}: AIEvaluationCardProps) {
  const statusBadge = {
    evaluated: <Badge tone="success">Evaluated</Badge>,
    evaluating: <Badge tone="warning">Evaluating…</Badge>,
    pending: <Badge tone="neutral">Pending</Badge>,
  }[status];

  return (
    <div
      className="theme-dark gv-card gv-card--lg gv-card--dark"
      style={{ background: "var(--navy-800)", padding: 24, display: "flex", flexDirection: "column", gap: 16, ...style }}
      {...rest}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {status === "evaluated" ? (
          <ScoreBadge score={score} outOf={outOf} />
        ) : (
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: "50%",
              flex: "none",
              border: "1px dashed var(--border-default)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--text-muted)",
              fontFamily: "var(--font-sans)",
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            {status === "evaluating" ? "…" : "—"}
          </span>
        )}
        <div style={{ flex: 1, lineHeight: 1.35 }}>
          <div style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: 15, color: "var(--text-heading)" }}>
            Student: {student}
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)" }}>{exam}</div>
        </div>
        {statusBadge}
      </div>

      <div style={{ borderTop: "1px solid var(--border-default)" }} />

      {steps.length > 0 && <ScannedUpload steps={steps} />}

      {status === "evaluating" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "18px 20px",
            background: "var(--surface-inset)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: "50%",
              border: "2px solid var(--accent)",
              borderTopColor: "transparent",
              animation: "gv-spin 0.8s linear infinite",
              flex: "none",
            }}
          />
          <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-body)" }}>
            AI is breaking down the working step-by-step…
          </span>
          <style>{"@keyframes gv-spin{to{transform:rotate(360deg)}}"}</style>
        </div>
      )}

      {status === "evaluated" && mistake && <FeedbackCallout kind="mistake">{mistake}</FeedbackCallout>}

      {status === "evaluated" && alternative && (
        <FeedbackCallout kind="alternative">
          {alternative}
          {tip && <div style={{ marginTop: 6 }}>Tip: {tip}</div>}
        </FeedbackCallout>
      )}

      {teacherOverride && status === "evaluated" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 2 }}>
          <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)", flex: 1 }}>
            Disagree with the AI score?
          </span>
          <Button variant="secondary" size="sm" onClick={onOverride}>
            Override Score
          </Button>
        </div>
      )}
    </div>
  );
}
