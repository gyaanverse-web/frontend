import type { HTMLAttributes, ReactNode } from "react";

export interface FeedbackCalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  kind?: "mistake" | "alternative";
  title?: ReactNode;
  children?: ReactNode;
}

/** AI feedback callout. kind 'mistake' = crimson left edge "EXACT MISTAKE IDENTIFIED";
 *  kind 'alternative' = blue left edge "✦ ALTERNATIVE SOLUTION". */
export function FeedbackCallout({ kind = "mistake", title = null, children, style, ...rest }: FeedbackCalloutProps) {
  const isMistake = kind === "mistake";
  const color = isMistake ? "var(--danger)" : "var(--accent)";
  const heading = title ?? (isMistake ? "Exact Mistake Identified" : "Alternative Solution");
  return (
    <div
      style={{
        border: `1px solid ${isMistake ? "rgba(244,63,94,0.35)" : "rgba(43,80,245,0.45)"}`,
        borderLeftWidth: 3,
        borderLeftColor: color,
        background: isMistake ? "var(--danger-soft)" : "var(--accent-soft)",
        borderRadius: "var(--radius-md)",
        padding: "14px 18px",
        ...style,
      }}
      {...rest}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          fontFamily: "var(--font-body)",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color,
          marginBottom: 7,
        }}
      >
        {!isMistake && (
          <span aria-hidden="true" style={{ fontSize: 13 }}>
            ✦
          </span>
        )}
        {heading}
      </div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.6, color: "var(--text-heading)" }}>
        {children}
      </div>
    </div>
  );
}
