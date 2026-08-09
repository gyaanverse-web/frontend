"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { Card, Icon } from "@/components/ui";

/**
 * Shown on the screens that genuinely need a coaching (My Exams, My Classes)
 * when the student hasn't joined one. Deliberately not a blocker: it explains
 * what a join code is and points at the marketplace, which works standalone.
 */
export function NoCoachingPanel({
  title = "You haven't joined a coaching yet",
  body = "Exams and batches are assigned by your coaching institute. Ask yours for their 8-character join code — you can enter it any time.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "56px 40px" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Icon name="graduation-cap" size={28} style={{ color: "var(--accent)" }} />
        </div>
        <h3 style={{ margin: 0, fontSize: 19, color: "var(--text-heading)" }}>{title}</h3>
        <p style={{ margin: 0, maxWidth: 440, fontSize: 14, lineHeight: 1.6, color: "var(--text-body)" }}>{body}</p>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          <Link href="/join" className="gv-btn gv-btn--app gv-btn--md">
            <span>Enter a join code</span>
          </Link>
          <Link href="/student/marketplace" className="gv-btn gv-btn--secondary gv-btn--md">
            <span>Browse public mocks</span>
          </Link>
        </div>
      </div>
    </Card>
  );
}

/** Compact inline version of the same prompt, for the Home dashboard. */
export function JoinCoachingCard() {
  return (
    <Card padding={22} style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 28, borderColor: "var(--accent)" }}>
      <div style={{ width: 42, height: 42, borderRadius: 11, background: "var(--accent-soft)", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
        <Icon name="graduation-cap" size={21} style={{ color: "var(--accent)" }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 16, color: "var(--text-heading)" }}>
          Got a join code from your coaching?
        </div>
        <p style={{ fontSize: 13.5, margin: "2px 0 0", color: "var(--text-body)" }}>
          Enter it to get your batches, assigned exams and results in one place.
        </p>
      </div>
      <Link href="/join" className="gv-btn gv-btn--app gv-btn--md">
        <span>Join a coaching</span>
      </Link>
    </Card>
  );
}

/** Circular progress ring — conic-gradient arc with a centred label. */
export function ProgressRing({ pct = 46, size = 56, label }: { pct?: number; size?: number; label?: React.ReactNode }) {
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `conic-gradient(var(--accent) ${pct * 3.6}deg, var(--border-default) 0deg)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: size - 10,
            height: size - 10,
            borderRadius: "50%",
            background: "var(--surface-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-sans)",
            fontWeight: 700,
            fontSize: 12.5,
            color: "var(--text-heading)",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

/** Sparkline-style area chart of recent attempt scores. */
export function ScoreTrendChart({ pts = [58, 61, 55, 64, 68, 66, 72, 76], style }: { pts?: number[]; style?: CSSProperties }) {
  const w = 560;
  const h = 120;
  const pad = 8;
  const max = 100;
  const min = 40;
  const coords = pts.map((v, i) => {
    const x = pad + (i * (w - pad * 2)) / (pts.length - 1);
    const y = h - pad - ((v - min) / (max - min)) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map((c, i) => (i === 0 ? "M" : "L") + c[0] + "," + c[1]).join(" ");
  const last = coords[coords.length - 1];
  const area = `${line} L${last[0]},${h - pad} L${coords[0][0]},${h - pad} Z`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block", ...style }}>
      <defs>
        <linearGradient id="gvTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#gvTrendFill)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c[0]}
          cy={c[1]}
          r={i === coords.length - 1 ? 4 : 3}
          fill={i === coords.length - 1 ? "var(--accent)" : "var(--surface-card)"}
          stroke="var(--accent)"
          strokeWidth="2"
        />
      ))}
    </svg>
  );
}
