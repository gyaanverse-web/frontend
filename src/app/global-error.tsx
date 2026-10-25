"use client";

// The root layout is what failed, so this file replaces it entirely — which
// means it has to supply its own <html>/<body> AND re-import the stylesheet,
// or the design-system tokens the error screen is built from would not exist
// and the page would render as unstyled black-on-white text.
import "./globals.css";
import { ErrorScreen } from "@/components/marketing/ErrorScreen";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, which
 * `error.tsx` sits inside of and therefore cannot catch.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorScreen
          code="Error"
          title="Gyaanverse is having a problem"
          message="Something failed before the page could load. Please try again in a moment."
          digest={error.digest}
          actions={
            <>
              <button
                type="button"
                onClick={reset}
                className="gv-btn gv-btn--md gv-btn--primary"
              >
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
                  the root layout has failed, so `next/link` has nothing intact
                  to route within. A full page load is the only reliable exit. */}
              <a href="/" className="gv-btn gv-btn--md gv-btn--secondary">
                Back to home
              </a>
            </>
          }
        />
      </body>
    </html>
  );
}
