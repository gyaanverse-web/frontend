"use client";

import { useEffect } from "react";
import { BUILD_INFO } from "@/lib/buildInfo";

/**
 * Prints the build stamp to the browser console once per page load.
 *
 * Deliberately console-only: opening devtools is the fastest check that does
 * not put a version string in front of a coaching's students, and it survives
 * every CDN cache question — if the console says the new SHA, the JS the
 * browser is running is the JS that was just built.
 */
export function BuildStamp() {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.info(
      `%cGyaanverse%c ${BUILD_INFO.line}`,
      "background:#1d4ed8;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600",
      "color:#64748b",
    );
  }, []);

  return null;
}
