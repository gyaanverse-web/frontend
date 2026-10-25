"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/marketing/ErrorScreen";

/**
 * Route-level error boundary. Replaces React's bare "Application error: a
 * client-side exception has occurred" with something branded and actionable.
 *
 * Note what is NOT rendered: `error.message`. In a production build Next
 * already redacts server-side messages down to a digest, and echoing whatever
 * survives would be a way for an internal string to reach a visitor. The
 * digest alone is shown — it is the value that correlates with the server log.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keeps the real error in the browser console for anyone debugging, while
    // the page above stays clean.
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      code="Error"
      title="Something went wrong"
      message="This page failed to load. Trying again usually works — if it keeps happening, the reference below will help us track it down."
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
          {/* A plain anchor, not `next/link`: the router is part of what may
              have just failed, so a full document load is the safer escape. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages --
              the hard navigation is the point; client-side routing is exactly
              what cannot be trusted here. */}
          <a href="/" className="gv-btn gv-btn--md gv-btn--secondary">
            Back to home
          </a>
        </>
      }
    />
  );
}
