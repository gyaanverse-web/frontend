import type { TenantRole } from "@/lib/useTenantSession";

/**
 * Human-readable role names.
 *
 * Lives in `lib/` rather than in the dashboard's `styles.ts` because the shared
 * `AppSidebar` renders the role in its account footer, and a component under
 * `components/` must not reach into a single route's folder for it.
 */

/** Any role that can be *displayed* — the three tenant roles plus the platform
 *  operator. Purely for labels and colours; never use it to gate behaviour. */
export type DisplayRole = TenantRole | "super_admin";

export const ROLE_LABEL: Record<DisplayRole, string> = {
  super_admin: "Super Admin",
  coaching_owner: "Coaching Owner",
  teacher: "Teacher",
  student: "Student",
};

/** Lookup that tolerates an unrecognised role string rather than rendering
 *  `undefined` — display-only, so falling back to the raw value is fine. */
export function roleLabel(role: string): string {
  return ROLE_LABEL[role as DisplayRole] ?? role;
}
