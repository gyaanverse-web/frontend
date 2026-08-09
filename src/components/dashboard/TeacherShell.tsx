"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { invalidateSession } from "@/lib/sessionStore";
import { TENANT_ROOT_DOMAIN } from "@/lib/domain";
import { Avatar } from "@/components/ui";
import { NotificationBell } from "@/components/NotificationBell";
import { AppSidebar, type AppNavKey } from "./AppSidebar";
import type { TenantRole } from "@/lib/useTenantSession";

/** Nav keys identify the active route so the sidebar highlights correctly. */
export type TeacherNavKey = AppNavKey;

export interface TeacherShellProps {
  /** Institute name shown in the top bar; falls back to a placeholder while loading. */
  tenant?: { name: string; slug: string } | null;
  /** Signed-in user for the top-bar identity + avatar. */
  user?: { name: string } | null;
  /**
   * The role whose sidebar to render — pass `displayRole` from `useTenantSession`
   * (or a literal for a screen that only one role can ever reach).
   *
   * REQUIRED, and `null` renders a skeleton rather than a menu. It used to be
   * optional with a `?? "teacher"` fallback, which meant every screen that
   * forgot it — all five student screens — showed students the teacher's
   * navigation. Keeping it required makes that a compile error instead.
   */
  role: TenantRole | string | null;
  /** Which sidebar item is highlighted. */
  active: AppNavKey;
  /** Page heading (omit together with `headerless` for full-bleed screens). */
  title?: ReactNode;
  /** Small uppercase eyebrow above the title. */
  eyebrow?: ReactNode;
  /** Right-aligned header action(s), e.g. a Button. */
  action?: ReactNode;
  /** Skip the padded page header + scroll container — the screen owns its full layout. */
  headerless?: boolean;
  /**
   * Student who has not joined any coaching. Distinguishes "no institute" from
   * "institute still loading", which both arrive as `tenant == null`, and swaps
   * the top-bar identity for a join call-to-action.
   */
  noCoaching?: boolean;
  children: ReactNode;
}

/** Shared chrome for the teacher-facing routes: the single app sidebar + top bar over a
 *  paper background. The sidebar is identical to the Dashboard's, so it never changes
 *  as you navigate. Pages own their own data. */
export function TeacherShell({
  tenant,
  user,
  role,
  active,
  title,
  eyebrow,
  action,
  headerless = false,
  noCoaching = false,
  children,
}: TeacherShellProps) {
  const router = useRouter();

  async function handleLogout() {
    try {
      await api.post("/api/auth/sign-out", {});
    } catch {
      /* ignore — navigate away regardless */
    }
    // router.push is a client-side nav, so the module cache survives it — the
    // signed-out user would otherwise keep a cached session for a full minute.
    invalidateSession();
    router.push("/login");
  }

  const userName = user?.name ?? "";

  return (
    <div style={{ display: "flex", width: "100%", minHeight: "100vh", background: "var(--bg-page)" }}>
      {/* ── Sidebar (shared, identical everywhere) ───────────────────────── */}
      <AppSidebar role={role} activeKey={active} onLogout={handleLogout} />

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="gv-topbar" style={{ position: "sticky", top: 0, zIndex: 5 }}>
          <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span style={{ fontFamily: "var(--font-sans)", fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em", color: "var(--text-heading)" }}>
              {noCoaching ? "Gyanverse" : tenant?.name ?? "Loading…"}
            </span>
            {noCoaching ? (
              <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)" }}>
                Not in a coaching yet
              </span>
            ) : tenant?.slug ? (
              <span style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)" }}>
                {tenant.slug}.{TENANT_ROOT_DOMAIN}
              </span>
            ) : null}
          </div>
          <div style={{ flex: 1 }} />
          {noCoaching && (
            <Link href="/join" className="gv-btn gv-btn--secondary gv-btn--sm">
              <span>Join a coaching</span>
            </Link>
          )}
          <NotificationBell />
          {userName && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
              <Avatar name={userName} size={28} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>{userName}</span>
            </div>
          )}
        </header>

        {headerless ? (
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>{children}</div>
        ) : (
          <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px" }}>
            {(title || action) && (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 24 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {eyebrow && (
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-muted)" }}>
                      {eyebrow}
                    </div>
                  )}
                  {title && <h2 style={{ margin: 0, fontSize: 24, letterSpacing: "-0.02em", color: "var(--text-heading)" }}>{title}</h2>}
                </div>
                <div style={{ flex: 1 }} />
                {action}
              </div>
            )}
            {children}
          </main>
        )}
      </div>
    </div>
  );
}
