import { examStatusLabel, examStatusTone, type ExamStatus } from "@/lib/examStatus";

// Mirrors the backend `exam_status_history` row (see exam.types.ts).
// `fromStatus` is null on the initial creation; `actorId` is null for
// system/worker-driven transitions (scheduled→live, live→under_evaluation).
export interface ExamStatusHistoryRow {
  id: string;
  examId: string;
  fromStatus: ExamStatus | null;
  toStatus: ExamStatus;
  actorId: string | null;
  remarks: string | null;
  createdAt: string;
}

const TONE_DOT: Record<string, string> = {
  success: "var(--success)",
  danger: "var(--danger)",
  warning: "var(--warning, #b45309)",
  accent: "var(--accent)",
  neutral: "var(--border-strong, var(--text-muted))",
};

export interface StatusTimelineProps {
  history: ExamStatusHistoryRow[];
  /** Map of actorId → display name, when available. */
  actorNames?: Record<string, string>;
  className?: string;
}

/**
 * Vertical approval/lifecycle timeline for the Test Overview (PRD). Renders one
 * node per status change, newest last, with the review remarks attached.
 */
export function StatusTimeline({ history, actorNames, className }: StatusTimelineProps) {
  if (!history || history.length === 0) {
    return (
      <div style={{ fontSize: 13, color: "var(--text-muted)", padding: "8px 0" }} className={className}>
        No status changes yet.
      </div>
    );
  }

  return (
    <ol
      className={className}
      style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}
    >
      {history.map((row, i) => {
        const dot = TONE_DOT[examStatusTone(row.toStatus)] ?? TONE_DOT.neutral;
        const isLast = i === history.length - 1;
        const who = row.actorId
          ? actorNames?.[row.actorId] ?? "Reviewer"
          : "System";
        return (
          <li key={row.id} style={{ display: "flex", gap: 12, position: "relative", paddingBottom: isLast ? 0 : 18 }}>
            {/* rail + node */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
              <span
                aria-hidden="true"
                style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: dot, marginTop: 3,
                  boxShadow: "0 0 0 3px var(--surface-card)",
                  border: "1px solid var(--border-default)",
                }}
              />
              {!isLast && (
                <span
                  aria-hidden="true"
                  style={{ flex: 1, width: 2, background: "var(--border-default)", marginTop: 2 }}
                />
              )}
            </div>
            {/* content */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
              <div style={{ fontSize: 13.5, color: "var(--text-heading)", fontWeight: 600, lineHeight: 1.35 }}>
                {row.fromStatus ? (
                  <>
                    {examStatusLabel(row.fromStatus)}
                    <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> → </span>
                    {examStatusLabel(row.toStatus)}
                  </>
                ) : (
                  <>Created as {examStatusLabel(row.toStatus)}</>
                )}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 2 }}>
                {who} · {new Date(row.createdAt).toLocaleString()}
              </div>
              {row.remarks && (
                <div
                  style={{
                    marginTop: 6, fontSize: 13, color: "var(--text-body)",
                    background: "var(--surface-inset, var(--bg-section-alt))",
                    border: "1px solid var(--border-light)", borderRadius: 8,
                    padding: "8px 10px", whiteSpace: "pre-wrap",
                  }}
                >
                  {row.remarks}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
