import Link from "next/link";
import { Logo } from "@/components/ui";
import styles from "./SiteFooter.module.css";

// Extracted out of the marketing homepage so every public surface — including
// the legal pages — carries the same footer, and so the Privacy / Terms /
// Refunds links exist in exactly one place. Razorpay's activation review and
// the DPDP notice requirement both expect these reachable from every page.

const PRODUCT_LINKS = [
  { href: "/#features", label: "Features" },
  { href: "/#ai", label: "AI Analysis" },
  { href: "/#pricing", label: "Pricing" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refunds", label: "Refunds" },
];

const ACCOUNT_LINKS = [
  { href: "/login", label: "Login" },
  { href: "/register", label: "Get Started" },
];

export function SiteFooter() {
  return (
    <footer className={`theme-dark ${styles.footer}`}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <Logo size={20} onDark />
          <span className={styles.copy}>
            © {new Date().getFullYear()} Gyaanverse. All rights reserved.
          </span>
        </div>

        <nav className={styles.links} aria-label="Footer">
          {PRODUCT_LINKS.map((l) => (
            <a key={l.href} href={l.href} className={styles.link}>
              {l.label}
            </a>
          ))}
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={styles.link}>
              {l.label}
            </Link>
          ))}
          {ACCOUNT_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={styles.link}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
