"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Logo, Button } from "@/components/ui";

export interface NavBarProps {
  /** ← back link shown before the logo */
  back?: { href: string; label?: string };
  /** Logged-in user. null = not logged in, undefined = auth state unknown */
  user?: { name: string } | null;
  /** Sign Out handler — button only shown when both user and this are provided */
  onSignOut?: () => void;
  /** Suppress a nav link when already on that page */
  activePage?: "exams" | "dashboard" | "login" | "signup";
  /** Injected at the far right (e.g. exam timer + submit button) */
  right?: ReactNode;
}

/** Public-facing top bar for the marketplace + exam preview. Unlike the in-app
 *  shell this renders for signed-out visitors too, so it takes auth state as a
 *  prop instead of fetching a session. */
export function NavBar({ back, user, onSignOut, activePage, right }: NavBarProps) {
  return (
    <header className="gv-topbar" style={{ position: "sticky", top: 0, zIndex: 5 }}>
      {back && (
        <Link href={back.href} className="gv-btn gv-btn--ghost gv-btn--sm" style={{ gap: 6 }}>
          <span aria-hidden="true">←</span>
          <span>{back.label ?? "Back"}</span>
        </Link>
      )}

      <Link href="/" aria-label="Gyaanverse home" style={{ display: "inline-flex" }}>
        <Logo size={18} />
      </Link>

      <div style={{ flex: 1 }} />

      {activePage !== "exams" && (
        <Link href="/mocks" className="gv-btn gv-btn--ghost gv-btn--sm">
          Exams
        </Link>
      )}
      {user && activePage !== "dashboard" && (
        <Link href="/coaching/dashboard" className="gv-btn gv-btn--ghost gv-btn--sm">
          Dashboard
        </Link>
      )}
      {user === null && activePage !== "login" && activePage !== "signup" && (
        <Link href="/login" className="gv-btn gv-btn--app gv-btn--sm">
          Sign In
        </Link>
      )}
      {user && onSignOut && (
        <Button variant="ghost" size="sm" onClick={onSignOut}>
          Sign Out
        </Button>
      )}

      {right}
    </header>
  );
}
