"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSession } from "@/lib/sessionStore";
import { Logo } from "@/components/ui";
import styles from "@/app/page.module.css";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#ai", label: "AI Analysis" },
  { href: "#pricing", label: "Pricing" },
  { href: "#customers", label: "Customers" },
];

const linkStyle: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-heading)",
  textDecoration: "none",
};

/** Sticky marketing nav. Adapts the right-hand CTA to session state:
 *  signed-out visitors get Login + Get Started; signed-in users get Dashboard. */
export function HomeNav() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    // Better Auth returns 200 { user: null } when unauthenticated, so a resolved
    // promise doesn't mean signed in — check the body.
    getSession()
      .then((res) => setLoggedIn(Boolean(res?.user)))
      .catch(() => setLoggedIn(false));
  }, []);

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 28,
        padding: "0 40px",
        height: 72,
        background: "#fff",
        borderBottom: "1px solid var(--border-light)",
        position: "sticky",
        top: 0,
        zIndex: 20,
      }}
    >
      <Link href="/" aria-label="Gyaanverse home" style={{ display: "inline-flex" }}>
        <Logo size={22} />
      </Link>

      <div style={{ flex: 1 }} />

      <div className={styles.navLinks}>
        {NAV_LINKS.map((l) => (
          <a key={l.href} href={l.href} style={linkStyle}>
            {l.label}
          </a>
        ))}
      </div>

      <div style={{ display: "flex", gap: 14, alignItems: "center", marginLeft: 12 }}>
        {loggedIn ? (
          <Link href="/coaching/dashboard" className="gv-btn gv-btn--primary gv-btn--md">
            <span>Dashboard</span>
          </Link>
        ) : (
          <>
            <Link href="/login" style={linkStyle}>
              Login
            </Link>
            <Link href="/register" className="gv-btn gv-btn--primary gv-btn--md">
              <span>Get Started</span>
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
