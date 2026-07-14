import type { HTMLAttributes, ReactNode } from "react";

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  value: ReactNode;
  delta?: ReactNode;
  deltaTone?: "success" | "danger" | "neutral";
  sub?: ReactNode;
}

/** Dashboard KPI stat card: label, big value, optional delta + sub text. */
export function StatCard({
  label,
  value,
  delta = null,
  deltaTone = "success",
  sub = null,
  style,
  ...rest
}: StatCardProps) {
  const deltaColor = {
    success: "var(--success)",
    danger: "var(--danger)",
    neutral: "var(--text-muted)",
  }[deltaTone];
  return (
    <div
      className="gv-card"
      style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6, ...style }}
      {...rest}
    >
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.07em",
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}
      >
        {label}
      </span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            color: "var(--text-heading)",
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
        {delta && (
          <span style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: deltaColor }}>
            {delta}
          </span>
        )}
      </span>
      {sub && (
        <span style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-body)" }}>{sub}</span>
      )}
    </div>
  );
}
