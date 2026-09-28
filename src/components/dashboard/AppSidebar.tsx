"use client";

import Link from "next/link";
import { Logo, Icon, Avatar } from "@/components/ui";
import { roleLabel } from "@/lib/roleLabel";
import { buildAppNav, ACCOUNT_ENTRY, type AppNavKey } from "./appNav";

/**
 * The single source of truth for the app's left navigation.
 *
 * Every owner/teacher screen — the Dashboard section-switcher AND every standalone
 * route (Exams, Question Bank, Test Engine, Subjects, …) — renders THIS component
 * with the SAME nav list, so the sidebar never adds or drops items as you move
 * around. The role-gating logic itself lives in the framework-free `./appNav`
 * module so it can be unit-tested; this component only renders it.
 *
 * ── Layout ──────────────────────────────────────────────────────────────────
 *
 * Two zones separated by a spacer, which is the standard SaaS shell:
 *
 *  - **Top**: the institute. Where you are, what you can open.
 *  - **Pinned bottom**: the person. Who you are, your account, the way out.
 *
 * The identity block lives HERE and nowhere else. The top bar deliberately shows
 * no avatar and no name: it answers "which coaching am I in?" while the sidebar
 * answers "who am I?". There is likewise no role badge at the top of the sidebar
 * any more — the role reads under the name in the footer, once.
 */

export type { AppNavKey } from "./appNav";
export { buildAppNav } from "./appNav";

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
  /** Signed-in user for the pinned footer. Null while the session loads. */
  user?: { name: string } | null;
  onLogout: () => void;
}

export function AppSidebar({ role, activeKey, user, onLogout }: AppSidebarProps) {
  // Until the role resolves we cannot know which menu is correct, so show none.
  // Guessing costs a visible flash of items the user may not be allowed to open.
  if (role === null) return <AppSidebarSkeleton />;

  const nav = buildAppNav(role);

  return (
    <nav className="gv-sidebar" style={{ position: "sticky", top: 0, height: "100vh", flexShrink: 0 }}>
      <div style={{ padding: "8px 12px 14px", display: "flex", alignItems: "center" }}>
        <Link href="/"><Logo size={18} /></Link>
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

      {/* ── Pinned account footer ──────────────────────────────────────────── */}
      {/* `gap: 2px` mirrors `.gv-sidebar`'s own gap — the footer is one flex
          child of it, so without this its rows would sit flush while every row
          above them is spaced. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, borderTop: "1px solid var(--border-light)", paddingTop: 6, marginTop: 8 }}>
        <Link
          href={ACCOUNT_ENTRY.href}
          className="gv-sidebar-item"
          aria-current={activeKey === "account" ? "page" : undefined}
        >
          <Icon name={ACCOUNT_ENTRY.icon} size={17} />
          {ACCOUNT_ENTRY.label}
        </Link>

        {user && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "8px 14px 6px",
              minWidth: 0,
            }}
          >
            <Avatar name={user.name} size={26} />
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25, minWidth: 0 }}>
              <span
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text-heading)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.name}
              </span>
              <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-muted)" }}>
                {roleLabel(role)}
              </span>
            </div>
          </div>
        )}

        <button className="gv-sidebar-item" onClick={onLogout}>
          <Icon name="log-out" size={17} />
          Log out
        </button>
      </div>
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
