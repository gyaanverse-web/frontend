"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSession } from "@/lib/sessionStore";
import { Logo, Avatar, Eyebrow } from "@/components/ui";
import { NotificationBell } from "@/components/NotificationBell";

// Only the display name is used here — the shell renders no role-gated chrome.
type SessionUser = { name: string };

export interface PageShellProps {
  /** Page heading. */
  title: React.ReactNode;
  /** Small electric-blue eyebrow above the title. */
  eyebrow?: React.ReactNode;
  /** Right-aligned action(s) in the page header (e.g. a Button). */
  action?: React.ReactNode;
  /** Content max-width. */
  maxWidth?: number;
  showBell?: boolean;
  children: React.ReactNode;
}

/** Shared chrome for standalone dashboard pages — a DS top bar (logo, back-to-dashboard,
 *  notifications, user) over a paper background, with a consistent page header. */
export function PageShell({ title, eyebrow, action, maxWidth = 880, showBell = true, children }: PageShellProps) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    getSession()
      .then((r) => setUser(r?.user ?? null))
      .catch(() => {});
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-page)" }}>
      <header className="gv-topbar" style={{ position: "sticky", top: 0, zIndex: 5 }}>
        <Link href="/" aria-label="Gyaanverse home">
          <Logo size={18} />
        </Link>
        <Link href="/coaching/dashboard" className="gv-btn gv-btn--ghost gv-btn--sm" style={{ gap: 6 }}>
          <span aria-hidden="true">←</span>
          <span>Dashboard</span>
        </Link>
        <div style={{ flex: 1 }} />
        {showBell && <NotificationBell />}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 4 }}>
            <Avatar name={user.name} size={28} />
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)" }}>{user.name}</span>
          </div>
        )}
      </header>

      <main style={{ flex: 1, padding: 28 }}>
        <div style={{ maxWidth, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16, marginBottom: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
              <h2 style={{ fontSize: 26, margin: 0 }}>{title}</h2>
            </div>
            <div style={{ flex: 1 }} />
            {action}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
