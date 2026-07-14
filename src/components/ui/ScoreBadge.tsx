import type { HTMLAttributes } from "react";

export interface ScoreBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  score: number | string;
  outOf?: number;
  size?: number;
}

/** Circular score badge, e.g. "6/10" — used in AI evaluation card headers. */
export function ScoreBadge({ score, outOf = 10, size = 52, ...rest }: ScoreBadgeProps) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flex: "none",
        background: "var(--surface-inset)",
        border: "1px solid var(--border-default)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: size * 0.28,
        letterSpacing: "-0.02em",
        color: "var(--text-heading)",
      }}
      {...rest}
    >
      {score}/{outOf}
    </span>
  );
}
