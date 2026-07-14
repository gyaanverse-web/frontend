import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  size?: "md" | "lg";
  dark?: boolean;
  padding?: number | string;
  children?: ReactNode;
}

/** Surface card: 1px border, 10–16px radius, quiet shadow. Set dark to render the navy card on any background. */
export function Card({
  size = "md",
  dark = false,
  padding = 24,
  children,
  className = "",
  style,
  ...rest
}: CardProps) {
  return (
    <div
      className={`gv-card ${size === "lg" ? "gv-card--lg" : ""} ${
        dark ? "theme-dark gv-card--dark" : ""
      } ${className}`}
      style={{ padding, ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
