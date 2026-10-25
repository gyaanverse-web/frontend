import type { Metadata } from "next";
import Link from "next/link";
import { ErrorScreen } from "@/components/marketing/ErrorScreen";

export const metadata: Metadata = {
  title: "Page not found · Gyaanverse",
  // A 404 that gets indexed is worse than no 404 at all.
  robots: { index: false, follow: false },
};

/**
 * The branded 404. Reached by a mistyped URL, a stale link, or any
 * `notFound()` call — on the marketing site and on every tenant subdomain,
 * so the copy stays deliberately neutral about which one you are on.
 */
export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="We can't find that page"
      message="The link may be out of date, or the page may have moved. If you followed a link from inside Gyaanverse, signing in again usually puts you back where you were."
      actions={
        <>
          <Link href="/" className="gv-btn gv-btn--md gv-btn--primary">
            Back to home
          </Link>
          <Link href="/login" className="gv-btn gv-btn--md gv-btn--secondary">
            Sign in
          </Link>
        </>
      }
    />
  );
}
