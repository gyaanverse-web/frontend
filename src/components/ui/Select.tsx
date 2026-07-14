import type { SelectHTMLAttributes, ReactNode } from "react";

export type SelectOption = string | { value: string; label: string };

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  options?: SelectOption[];
  wrapperStyle?: React.CSSProperties;
}

/** Labeled native select. options: array of strings or {value,label}. */
export function Select({ label = null, options = [], wrapperStyle, className = "", ...rest }: SelectProps) {
  return (
    <label style={{ display: "block", ...wrapperStyle }} className={className}>
      {label && <span className="gv-label">{label}</span>}
      <select className="gv-select" {...rest}>
        {options.map((o) => {
          const v = typeof o === "string" ? { value: o, label: o } : o;
          return (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
