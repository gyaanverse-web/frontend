import type { HTMLAttributes } from "react";

export interface LogoProps extends HTMLAttributes<HTMLSpanElement> {
  size?: number;
  onDark?: boolean;
}

/** GYAANVERSE wordmark — heavy grotesk + electric-blue period. onDark for navy surfaces. */
export function Logo({ size = 22, onDark = false, style, ...rest }: LogoProps) {
  return (
    <span
      style={{
        fontFamily: "var(--font-sans)",
        fontWeight: 700,
        fontSize: size,
        letterSpacing: "-0.02em",
        color: onDark ? "#fff" : "var(--ink-900)",
        whiteSpace: "nowrap",
        lineHeight: 1,
        ...style,
      }}
      {...rest}
    >
      GYAANVERSE
      <span style={{ color: "var(--blue-600)" }}>.</span>
    </span>
  );
}
