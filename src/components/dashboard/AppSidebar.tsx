"use client";

import Link from "next/link";
import { Logo, Badge, Icon } from "@/components/ui";
import type { BadgeRole } from "@/components/ui";
import { buildAppNav, type AppNavKey } from "./appNav";

/**
 * The single source of truth for the app's left navigation.
 *
 * Every owner/teacher screen — the Dashboard section-switcher AND every standalone
 * route (Exams, Question Bank, Test Engine, Subjects, …) — renders THIS component
 * with the SAME nav list, so the sidebar never adds or drops items as you move
 * around. The role-gating logic itself lives in the framework-free `./appNav`
 * module so it can be unit-tested; this component only renders it.
 */

export type { AppNavKey } from "./appNav";
export { buildAppNav } from "./appNav";

const ROLE_TO_BADGE: Record<string, BadgeRole> = {
  super_admin: "superadmin",
  coaching_owner: "owner",
  teacher: "teacher",
  student: "student",
};

export interface AppSidebarProps {
  /**
   * The role whose navigation to render — `displayRole` from `useTenantSession`.
   *
   * `null` means "not resolved yet" and renders a skeleton. There is deliberately
   * NO default: a shell that guessed a role here would render another role's menu
   * — which is exactly how every student ended up looking at the teacher sidebar.
   */
  role: string | null;
  /** Which nav item is highlighted. */
  activeKey: AppNavKey;
  onLogout: () => void;
}

export function AppSidebar({ role, activeKey, onLogout }: AppSidebarProps) {
  // Until the role resolves we cannot know which menu is correct, so show none.
  // Guessing costs a visible flash of items the user may not be allowed to open.
  if (role === null) return <AppSidebarSkeleton />;

  const nav = buildAppNav(role);
  const badgeRole = ROLE_TO_BADGE[role] ?? "student";

  return (
    <nav className="gv-sidebar" style={{ position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
      <div style={{ padding: "8px 12px 14px", display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
        <Link href="/"><Logo size={18} /></Link>
        <Badge role={badgeRole} />
      </div>
      {nav.map((it, i) =>
        "section" in it ? (
          <div key={i} className="gv-sidebar-section">{it.section}</div>
        ) : (
          <Link
            key={i}
            href={it.href}
            className="gv-sidebar-item"
            aria-current={activeKey === it.key ? "page" : undefined}
          >
            <Icon name={it.icon} size={17} />
            {it.label}
          </Link>
        )
      )}
      <div style={{ flex: 1 }} />
      <button className="gv-sidebar-item" onClick={onLogout}>
        <Icon name="log-out" size={17} />
        Log out
      </button>
    </nav>
  );
}

/** Sidebar chrome with the item list withheld, for the moment before the role is known. */
function AppSidebarSkeleton() {
  return (
    <nav className="gv-sidebar" style={{ position: "sticky", top: 0, height: "100vh", flexShrink: 0 }} aria-busy="true">
      <div style={{ padding: "8px 12px 14px" }}>
        <Link href="/"><Logo size={18} /></Link>
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            height: 15,
            margin: "9px 14px",
            borderRadius: 4,
            background: "var(--border-light)",
            opacity: 0.7 - i * 0.08,
          }}
        />
      ))}
    </nav>
  );
}
