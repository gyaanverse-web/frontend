import { Eyebrow } from "@/components/ui";
import { HomeNav } from "./HomeNav";
import { SiteFooter } from "./SiteFooter";
import styles from "./LegalPage.module.css";

// Shared chrome + prose styling for /privacy, /terms and /refunds.
//
// NOTE FOR WHOEVER SHIPS THIS: every <Todo> below renders a loud yellow
// placeholder on the live page. That is deliberate — an unfilled legal fact
// should be impossible to miss in a click-through, not quietly plausible.
// Replace them all before these pages are announced anywhere.

export function Todo({ children }: { children: React.ReactNode }) {
  return (
    <mark className={styles.todo} data-legal-todo="">
      TODO: {children}
    </mark>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.block}>
      <h2 className={styles.h2}>{heading}</h2>
      {children}
    </section>
  );
}

export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.page}>
      <HomeNav />

      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.headerInner}>
            <Eyebrow chip>{eyebrow}</Eyebrow>
            <h1 className={styles.h1}>{title}</h1>
            <p className={styles.intro}>{intro}</p>
            <p className={styles.updated}>Last updated {updated}</p>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          <article className={styles.prose}>{children}</article>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
