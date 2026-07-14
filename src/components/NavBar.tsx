"use client";

import type { ReactNode } from "react";
import {
  topBar as hdr,
  topBarDivider as aSep,
  topBarGhostAction as btnSignOut,
  topBarLink as aBack,
  topBarLink as aNav,
  topBarLogo as aLogo,
  topBarPrimaryAction as btnSignIn,
} from "@/lib/uiStyles";

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

export function NavBar({ back, user, onSignOut, activePage, right }: NavBarProps) {
  return (
    <header style={hdr}>
      {back && (
        <>
          <a href={back.href} style={aBack}>← {back.label ?? "Back"}</a>
          <span style={aSep}>|</span>
        </>
      )}

      <a href="/" style={aLogo}>GYANVERSE</a>

      <div style={{ flex: 1 }} />

      {activePage !== "exams" && (
        <a href="/exams/public" style={aNav}>Exams</a>
      )}
      {user && activePage !== "dashboard" && (
        <a href="/dashboard" style={aNav}>Dashboard</a>
      )}
      {user === null && activePage !== "login" && activePage !== "signup" && (
        <a href="/login" style={btnSignIn}>Sign In</a>
      )}
      {user && onSignOut && (
        <button onClick={onSignOut} style={btnSignOut}>Sign Out</button>
      )}

      {right}
    </header>
  );
}
