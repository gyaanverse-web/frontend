import type { InputHTMLAttributes, ReactNode } from "react";

export interface SwitchProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  wrapperStyle?: React.CSSProperties;
}

/** Pill toggle switch with optional right-side label. */
export function Switch({ label = null, wrapperStyle, className = "", ...rest }: SwitchProps) {
  const input = <input type="checkbox" className="gv-switch" {...rest} />;
  if (!label) return input;
  return (
    <label
      style={{ display: "inline-flex", alignItems: "center", gap: 10, cursor: "pointer", ...wrapperStyle }}
      className={className}
    >
      {input}
      <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-heading)" }}>
        {label}
      </span>
    </label>
  );
}
