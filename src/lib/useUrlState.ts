"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  buildUrl, patchQuery, resolveChoice, resolveFlag, resolvePage,
} from "@/lib/urlState";

/**
 * Screen state that lives in the URL query string instead of `useState`.
 *
 * Anything the user can *see they chose* — the active tab, a filter chip, a
 * search box, the page number — belongs in the URL. Held in component state it
 * silently resets on refresh, can't be linked to a colleague, and makes the
 * browser Back button lie. `?tab=in-progress` fixes all three at once.
 *
 * The rules these hooks encode, so every screen behaves the same way:
 *
 *  - **The URL is the source of truth.** There is no mirrored `useState` to
 *    drift out of sync, and no effect syncing one into the other.
 *  - **The default value is never written.** `/coaching/exams` and `/coaching/exams?filter=all`
 *    mean the same thing, so the clean URL is the one users see and share.
 *  - **An unknown value falls back silently.** `?tab=nonsense` renders the
 *    default rather than an empty screen — query strings get hand-edited and
 *    outlive the values they named.
 *  - **Writes `replace` by default, and never scroll.** Picking a filter is not
 *    a navigation: Back should leave the screen, not step back through the six
 *    tabs someone clicked, and the list must not jump to the top underneath them.
 *
 * Every page calling these must sit under a `<Suspense>` boundary — that is a
 * `useSearchParams` requirement, and the production build fails without it.
 */

export interface UrlStateOptions {
  /**
   * `"replace"` (default) rewrites the current history entry. Use `"push"` only
   * when the change really is a navigation the user would expect Back to undo —
   * a wizard step, say, rather than a filter.
   */
  history?: "replace" | "push";
}

/**
 * Low-level writer: patch several query params at once.
 *
 * Taking a patch rather than one key matters for the cases where two params
 * move together — changing a filter has to reset `page` to 1 in the *same*
 * navigation, or the intermediate URL fetches a page that no longer exists.
 * A `null` (or empty) value drops the key.
 */
export function useUrlWriter({ history = "replace" }: UrlStateOptions = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();

  return useCallback(
    (patch: Record<string, string | null>) => {
      const url = buildUrl(pathname, patchQuery(search, patch));
      if (history === "push") router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [router, pathname, search, history],
  );
}

/**
 * A tab / filter / bucket whose value is one of a known set.
 *
 * @example
 * const [tab, setTab] = useUrlState("tab", TAB_KEYS, "todo");
 */
export function useUrlState<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
  options?: UrlStateOptions,
): [T, (next: T) => void] {
  const raw = useSearchParams().get(key);
  const write = useUrlWriter(options);

  const value = resolveChoice(raw, allowed, fallback);

  const set = useCallback(
    (next: T) => write({ [key]: next === fallback ? null : next }),
    [write, key, fallback],
  );

  return [value, set];
}

/** A boolean toggle. Present-and-`"1"` is on; absent is off. */
export function useUrlFlag(
  key: string,
  options?: UrlStateOptions,
): [boolean, (next: boolean) => void] {
  const raw = useSearchParams().get(key);
  const write = useUrlWriter(options);

  const set = useCallback(
    (next: boolean) => write({ [key]: next ? "1" : null }),
    [write, key],
  );

  return [resolveFlag(raw), set];
}

/**
 * A 1-based page number. Page 1 stays out of the URL, and anything that isn't a
 * positive integer reads as page 1 — pagination params are the ones most likely
 * to arrive mangled from a copy-paste.
 */
export function useUrlPage(
  key = "page",
  options?: UrlStateOptions,
): [number, (next: number) => void] {
  const raw = useSearchParams().get(key);
  const write = useUrlWriter(options);

  const value = resolvePage(raw);

  const set = useCallback(
    (next: number) => write({ [key]: next > 1 ? String(next) : null }),
    [write, key],
  );

  return [value, set];
}

export interface UrlSearchOptions extends UrlStateOptions {
  /** How long to wait after the last keystroke before writing the URL. */
  delayMs?: number;
  /** Params to clear whenever the query changes — `["page"]`, typically. */
  reset?: readonly string[];
}

/**
 * Free text from a search box.
 *
 * Typing updates the returned value immediately so the input stays responsive,
 * while the URL catches up `delayMs` later. Writing per keystroke would be
 * correct but would put a router transition behind every character.
 *
 * A change that arrives from the URL side — Back/Forward, a "Clear filters"
 * button, a pasted link — wins over the un-flushed draft.
 */
export function useUrlSearch(
  key: string,
  { delayMs = 300, reset = [], ...options }: UrlSearchOptions = {},
): [string, (next: string) => void] {
  const committed = useSearchParams().get(key) ?? "";
  const write = useUrlWriter(options);
  const resetKey = reset.join(",");

  const [draft, setDraft] = useState(committed);
  const [seen, setSeen] = useState(committed);
  // What the last flush put in the URL. Every URL change arrives as `committed`
  // regardless of who caused it, so this is what tells our own echo apart from a
  // real external change. Without it, a keystroke landing in the gap between the
  // timer firing and the resulting render would be reset away by its own flush.
  const [flushed, setFlushed] = useState(committed);

  // Re-seed the draft when the URL moved on its own — Back/Forward, a "Clear
  // filters" button, a pasted link. Adjusting state during render is the
  // supported way to reset derived state on an input change; an effect would
  // render one frame of the stale text first.
  if (committed !== seen) {
    setSeen(committed);
    if (committed !== flushed) setDraft(committed);
  }

  useEffect(() => {
    if (draft === committed) return;
    const handle = setTimeout(() => {
      const patch: Record<string, string | null> = { [key]: draft || null };
      for (const k of resetKey ? resetKey.split(",") : []) patch[k] = null;
      setFlushed(draft);
      write(patch);
    }, delayMs);
    return () => clearTimeout(handle);
  }, [draft, committed, key, delayMs, resetKey, write]);

  return [draft, setDraft];
}
