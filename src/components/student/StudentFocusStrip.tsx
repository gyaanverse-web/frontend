"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui";

export type TimerTone = "normal" | "amber" | "red";

const TIMER_COLOR: Record<TimerTone, string> = {
  normal: "var(--text-heading)",
  amber: "var(--warning)",
  red: "var(--danger)",
};

/**
 * Full-screen focus-mode header used by the exam-taking flow (intro → player →
 * results). Distinct from the dashboard chrome — no sidebar, just a slim bar with
 * a back affordance, title/meta, an optional autosave indicator and countdown.
 */
export function StudentFocusStrip({
  title,
  meta = null,
  timer = null,
  timerTone = "normal",
  saved = null,
  backLabel = "My Exams",
  onBack,
}: {
  title: ReactNode;
  meta?: ReactNode;
  timer?: ReactNode;
  timerTone?: TimerTone;
  saved?: ReactNode;
  backLabel?: string;
  onBack?: () => void;
}) {
  return (
    <header
      style={{
        height: 60,
        background: "var(--surface-card)",
        borderBottom: "1px solid var(--border-default)",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 14,
        flex: "none",
      }}
    >
      <button className="gv-btn gv-btn--ghost gv-btn--sm" style={{ paddingLeft: 8, paddingRight: 10 }} onClick={onBack}>
        <Icon name="arrow-right" size={15} style={{ transform: "rotate(180deg)" }} />
        <span style={{ fontSize: 13 }}>{backLabel}</span>
      </button>
      <div style={{ width: 1, height: 20, background: "var(--border-default)" }} />
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
        <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 14.5, color: "var(--text-heading)" }}>{title}</span>
        {meta && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{meta}</span>}
      </div>
      <div style={{ flex: 1 }} />
      {saved && (
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--success)", fontWeight: 500 }}>
          <Icon name="check-circle" size={14} />
          {saved}
        </span>
      )}
      {timer && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: "-0.01em",
            color: TIMER_COLOR[timerTone],
          }}
        >
          <Icon name="clock" size={17} />
          {timer}
        </span>
      )}
    </header>
  );
}

/** Full-viewport focus-mode page frame (paper background, column layout). */
export function FocusPage({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", fontFamily: "var(--font-body)", display: "flex", flexDirection: "column" }}>
      {children}
    </div>
  );
}
