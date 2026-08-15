import type { CSSProperties } from "react";
import type { DisplayRole } from "@/lib/roleLabel";

// `DisplayRole` and `ROLE_LABEL` moved to `@/lib/roleLabel` — the shared
// AppSidebar needs the labels for its account footer, and a component under
// `components/` must not import from one route's folder. Re-exported here so the
// dashboard's existing `from "./styles"` imports keep working.
export type { DisplayRole } from "@/lib/roleLabel";
export { ROLE_LABEL } from "@/lib/roleLabel";

// ── Role badge colors (DS role palette) ──────────────────────────────────────
export const ROLE_BADGE: Record<DisplayRole, CSSProperties> = {
  super_admin:    { background: "var(--role-superadmin)", color: "#fff", borderRadius: "var(--radius-pill)" },
  coaching_owner: { background: "var(--role-owner)",      color: "#fff", borderRadius: "var(--radius-pill)" },
  teacher:        { background: "var(--role-teacher)",    color: "#fff", borderRadius: "var(--radius-pill)" },
  student:        { background: "var(--role-student)",    color: "#fff", borderRadius: "var(--radius-pill)" },
};

export function memberRoleBadge(role: string): CSSProperties {
  const base: CSSProperties = { color: "#fff", borderRadius: "var(--radius-pill)" };
  if (role === "coaching_owner") return { ...base, background: "var(--role-owner)" };
  if (role === "teacher")        return { ...base, background: "var(--role-teacher)" };
  return { ...base, background: "var(--role-student)" };
}

// ── Shared inline styles, mapped onto the Gyaanverse design-system tokens ──────
// (kept as the legacy names the section components already import)

/** Card / section header bar. */
export const sh: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 16px",
  background: "var(--bg-section-alt)",
  borderBottom: "1px solid var(--border-default)",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: "var(--text-heading)",
};

/** Table data cell. */
export const cell: CSSProperties = {
  padding: "11px 16px",
  borderBottom: "1px solid var(--border-default)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--text-heading)",
  verticalAlign: "middle",
};

/** Label cell (left key column). */
export const lc: CSSProperties = {
  ...cell,
  fontWeight: 600,
  whiteSpace: "nowrap",
  width: 130,
  background: "var(--bg-section-alt)",
  color: "var(--text-body)",
};

/** Text input. */
export const inp: CSSProperties = {
  height: 40,
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  padding: "0 14px",
  background: "var(--surface-card)",
  color: "var(--text-heading)",
  fontFamily: "var(--font-body)",
  fontSize: 14,
  outline: "none",
};

/** Primary (dashboard blue) pill button. */
export const btnP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "var(--btn-app-primary-bg)",
  color: "#fff",
  border: "1px solid transparent",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/** Secondary / ghost-outline pill button. */
export const btnS: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "var(--surface-card)",
  color: "var(--text-heading)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-pill)",
  padding: "8px 16px",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/** Danger pill button. */
export const btnD: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "var(--danger)",
  color: "#fff",
  border: "1px solid transparent",
  borderRadius: "var(--radius-pill)",
  padding: "8px 18px",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

/** Shared card wrapper for dashboard sections (DS surface). */
export const sectionCard: CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--border-default)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-sm)",
  marginBottom: 16,
  overflow: "hidden",
};
