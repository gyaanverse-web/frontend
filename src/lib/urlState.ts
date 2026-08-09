/**
 * Pure, framework-free core of the URL-state layer.
 *
 * Kept out of `useUrlState.ts` (a "use client" React module) so the rules that
 * actually decide what a URL means can be unit-tested in a plain Node
 * environment — no DOM, no React, no router. Same split, and same reason, as
 * `appNav.ts` vs `AppSidebar.tsx`.
 *
 * The hooks in `useUrlState.ts` are thin wrappers over these functions; if you
 * are changing how a param is read or written, change it here.
 */

/**
 * Apply a patch to a query string. A `null` or empty value drops the key, which
 * is what keeps default values (`?filter=all`, `?page=1`) out of the URL —
 * `/coaching/exams` and `/coaching/exams?filter=all` should be the same link.
 *
 * Patching many keys at once is deliberate: a filter change has to clear `page`
 * in the *same* navigation, or one render lands on a page the new result set
 * doesn't have.
 */
export function patchQuery(search: string, patch: Record<string, string | null>): string {
  const next = new URLSearchParams(search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
  }
  return next.toString();
}

/** Join a path and a query string into the URL to navigate to. */
export function buildUrl(pathname: string, query: string): string {
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Read an enum-ish param. Anything not in `allowed` — a hand-edited query, a
 * bookmark that outlived the value it named, another role's bucket key — reads
 * as the fallback rather than rendering an empty screen.
 */
export function resolveChoice<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

/** Read a boolean param. Only the literal `"1"` is on. */
export function resolveFlag(raw: string | null): boolean {
  return raw === "1";
}

/**
 * Read a 1-based page number. Anything that isn't an integer above 1 — `"0"`,
 * `"abc"`, `"2.5"`, a negative — reads as page 1; pagination params are the ones
 * most likely to arrive mangled from a copy-paste.
 */
export function resolvePage(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1;
}
