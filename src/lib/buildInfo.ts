/**
 * Which build am I looking at?
 *
 * Values are inlined by `next.config.ts` at build time. Nothing here is a
 * secret — a commit SHA is already public on the repo, and every deploy
 * platform ships the equivalent — but it is deliberately not put on screen for
 * ordinary visitors. See `BuildStamp` for the three places it surfaces.
 */

const raw = {
  sha: process.env.NEXT_PUBLIC_BUILD_SHA || "unknown",
  ref: process.env.NEXT_PUBLIC_BUILD_REF || "unknown",
  builtAt: process.env.NEXT_PUBLIC_BUILD_TIME || "unknown",
  env: process.env.NEXT_PUBLIC_BUILD_ENV || "development",
} as const;

/** First 7 characters, the length git itself abbreviates to. */
export function shortSha(sha: string): string {
  return sha === "unknown" ? sha : sha.slice(0, 7);
}

/**
 * A single line that fits in a console, a meta tag, or a footer:
 *   `main@a1b2c3d · production · 2026-08-16T04:12:09.881Z`
 */
export function buildLine(info: typeof raw = raw): string {
  return `${info.ref}@${shortSha(info.sha)} · ${info.env} · ${info.builtAt}`;
}

export const BUILD_INFO = {
  ...raw,
  shortSha: shortSha(raw.sha),
  line: buildLine(raw),
} as const;
