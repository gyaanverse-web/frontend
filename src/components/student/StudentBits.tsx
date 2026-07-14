"use client";

import type { CSSProperties } from "react";

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
