import type { HTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { Badge } from "./Badge";
import { Button } from "./Button";

export interface PlanCardProps extends HTMLAttributes<HTMLDivElement> {
  name: ReactNode;
  price: string;
  period?: string;
  features?: ReactNode[];
  highlighted?: boolean;
  cta?: ReactNode;
  current?: boolean;
  /** When set, the CTA renders as a navigating link instead of an onClick button
   *  — required for server-rendered pages (e.g. the marketing homepage). */
  href?: string;
  onSelect?: () => void;
}

/** Pricing plan card. Exact Gyanverse plans: Free ₹0 / Starter ₹999 / Growth ₹2,499 / Pro ₹5,999. */
export function PlanCard({
  name,
  price,
  period = "/mo",
  features = [],
  highlighted = false,
  cta = "Start Free Trial",
  current = false,
  href,
  onSelect = () => {},
  style,
  ...rest
}: PlanCardProps) {
  const ctaVariant = highlighted ? "accent" : "secondary";
  return (
    <div
      className={`gv-card gv-card--lg ${highlighted ? "theme-dark gv-card--dark" : ""}`}
      style={{ padding: 28, display: "flex", flexDirection: "column", gap: 18, position: "relative", ...style }}
      {...rest}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h4 style={{ color: "var(--text-heading)" }}>{name}</h4>
        {highlighted && <Badge tone="accent">Popular</Badge>}
        {current && <Badge tone="success">Current Plan</Badge>}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "var(--text-heading)",
            lineHeight: 1,
          }}
        >
          {price}
        </span>
        {price !== "₹0" && (
          <span style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--text-body)" }}>
            {period}
          </span>
        )}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
        {features.map((f, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              gap: 9,
              alignItems: "baseline",
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--text-body)",
            }}
          >
            <span style={{ color: "var(--success)", fontWeight: 700 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      {href ? (
        <Link
          href={href}
          className={`gv-btn gv-btn--${ctaVariant} gv-btn--md`}
          style={{ width: "100%" }}
        >
          <span>{cta}</span>
        </Link>
      ) : (
        <Button variant={ctaVariant} onClick={onSelect} style={{ width: "100%" }}>
          {cta}
        </Button>
      )}
    </div>
  );
}
