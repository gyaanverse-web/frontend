import { Logo } from "@/components/ui";
import styles from "./ErrorScreen.module.css";

/**
 * The shared body of `not-found.tsx`, `error.tsx` and `global-error.tsx`.
 *
 * Presentational only, with no hooks and no `next/link`, so it can be rendered
 * from a server component (the 404) and from a client component (the error
 * boundaries) alike — and so `global-error`, which runs when the root layout
 * itself has failed, is not relying on the router being healthy.
 */
export function ErrorScreen({
  code,
  title,
  message,
  digest,
  actions,
}: {
  code: string;
  title: string;
  message: string;
  digest?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <Logo size={22} className={styles.logo} />
        <span className={styles.code}>{code}</span>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.message}>{message}</p>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
        {digest ? <p className={styles.digest}>Reference: {digest}</p> : null}
      </div>
    </div>
  );
}
