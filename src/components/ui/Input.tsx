import type { InputHTMLAttributes, ReactNode } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode;
  help?: ReactNode;
  /** Style applied to the wrapping <label>, not the input. */
  wrapperStyle?: React.CSSProperties;
}

/** Labeled text input with optional help text. */
export function Input({ label = null, help = null, wrapperStyle, className = "", ...rest }: InputProps) {
  return (
    <label style={{ display: "block", ...wrapperStyle }} className={className}>
      {label && <span className="gv-label">{label}</span>}
      <input className="gv-input" {...rest} />
      {help && <div className="gv-help">{help}</div>}
    </label>
  );
}
