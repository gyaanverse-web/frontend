import { Badge } from "@/components/ui";
import { examStatusLabel, examStatusTone, type ExamStatus } from "@/lib/examStatus";

export interface StatusBadgeProps {
  status: ExamStatus;
  /** Adds a soft pulsing dot for the `live` state. */
  pulse?: boolean;
  className?: string;
}

/**
 * DS status chip for the 11-status exam lifecycle. Thin wrapper over `Badge`
 * that pulls its label + tone from `EXAM_STATUS_META`, so every surface renders
 * a status identically.
 */
export function StatusBadge({ status, pulse = true, className }: StatusBadgeProps) {
  const isLive = status === "live";
  return (
    <Badge tone={examStatusTone(status)} className={className}>
      {pulse && isLive && (
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "currentColor",
            marginRight: 6,
            verticalAlign: "middle",
            animation: "gvLivePulse 1.4s ease-in-out infinite",
          }}
        />
      )}
      {examStatusLabel(status)}
      {pulse && isLive && (
        <style>{`@keyframes gvLivePulse{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      )}
    </Badge>
  );
}
