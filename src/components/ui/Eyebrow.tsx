import type { HTMLAttributes, ReactNode } from "react";

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  chip?: boolean;
  children?: ReactNode;
}

/** Uppercase letter-spaced electric-blue label; chip=true wraps it in the soft rounded chip. */
export function Eyebrow({ chip = false, children, className = "", ...rest }: EyebrowProps) {
  return (
    <span className={`gv-eyebrow ${chip ? "gv-eyebrow--chip" : ""} ${className}`} {...rest}>
      {children}
    </span>
  );
}
