import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "accent"
  | "app"
  | "secondary"
  | "ghost"
  | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  arrow?: boolean;
  icon?: ReactNode;
}

/** Pill button. variant: primary (near-black; blue on .theme-dark) | accent | app (dashboard blue) | secondary | ghost | danger */
export function Button({
  variant = "primary",
  size = "md",
  arrow = false,
  icon = null,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  return (
    <button className={`gv-btn gv-btn--${variant} gv-btn--${size} ${className}`} {...rest}>
      {icon}
      <span>{children}</span>
      {arrow && (
        <span aria-hidden="true" style={{ fontSize: "1.05em" }}>
          →
        </span>
      )}
    </button>
  );
}
