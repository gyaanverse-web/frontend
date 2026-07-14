import type { HTMLAttributes, ReactNode } from "react";

export type BadgeTone = "success" | "danger" | "warning" | "accent" | "neutral";
export type BadgeRole = "superadmin" | "owner" | "teacher" | "student";

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, "role"> {
  tone?: BadgeTone;
  role?: BadgeRole | null;
  children?: ReactNode;
}

const ROLE_LABELS: Record<BadgeRole, string> = {
  superadmin: "Super Admin",
  owner: "Coaching Owner",
  teacher: "Teacher",
  student: "Student",
};

/** Status / role chip. tone: success | danger | warning | accent | neutral, or a solid role chip via role=. */
export function Badge({
  tone = "neutral",
  role = null,
  children,
  className = "",
  ...rest
}: BadgeProps) {
  const cls = role ? `gv-badge gv-badge--solid-${role}` : `gv-badge gv-badge--${tone}`;
  const label = role && !children ? ROLE_LABELS[role] : children;
  return (
    <span
      className={`${cls} ${className}`}
      style={role ? { textTransform: "none", letterSpacing: "0.04em" } : undefined}
      {...rest}
    >
      {label}
    </span>
  );
}
