"use client";

import { api, ApiError, setUnauthorizedHandler } from "./api";
// Types only — erased at compile time, so this is not a runtime import cycle
// even though useTenantSession imports the functions below.
import type { SessionUser, TenantBase, TenantRole } from "./useTenantSession";

/**
 * One shared answer to "who is signed in, and to which coaching?".
 *
 * Every screen asks that on mount. Without a cache each mount was two fresh
 * HTTP calls — `/api/auth/get-session` plus `/tenants/me` — so a single
 * post-login redirect chain (login → postAuthRedirect → pendingOwnerPath →
 * the landing page's own hook) spent four round-trips answering the same
 * question, and any burst of client-side navigation multiplied it from there.
 *
 * Deliberately a module-level store rather than a React context. Half the
 * callers are not components: `postAuthRedirect` and `pendingOwnerPath` in
 * tenantUrl.ts are plain async functions on the post-login path, and a provider
 * cannot reach them. A module cache serves both, and needs nothing added to the
 * component tree.
 *
 * The in-flight map in api.ts already collapses *concurrent* GETs to the same
 * URL. It clears the moment a request settles, so it does nothing across
 * navigations — which is where nearly all the duplication came from. This holds
 * results for a TTL instead.
 */

const SESSION_KEY = "session";
const TENANT_KEY = "tenant";

/**
 * How long each answer is trusted.
 *
 * The two differ on purpose. A stale display name for a minute is cosmetic; a
 * stale *role* is not — a teacher who has just been demoted would keep owner
 * navigation, and every control on it 403s. So membership is re-checked twice
 * as often as identity.
 */
const SESSION_TTL_MS = 60_000;
const TENANT_TTL_MS = 30_000;

/** The raw `/api/auth/get-session` body. Better Auth answers 200 `{ user: null }`
 *  when signed out rather than rejecting, so `user` is nullable on success. */
export interface SessionPayload {
  user: (SessionUser & { role?: string; signupIntent?: string }) | null;
}

export interface TenantPayload<T extends TenantBase = TenantBase> {
  tenant: T;
  membershipRole: TenantRole;
}

type Settled = { ok: true; value: unknown } | { ok: false; error: unknown };

const cache = new Map<string, { result: Settled; at: number }>();
const inflight = new Map<string, Promise<unknown>>();
const subscribers = new Set<() => void>();

/**
 * A module-level cache on the server would be shared by every user the process
 * serves — one visitor's session handed to the next. These are all client
 * components whose fetches run in effects, so this should never trigger, but
 * the failure mode is severe enough to close off structurally rather than by
 * argument.
 */
const isBrowser = typeof window !== "undefined";

/**
 * Cache a failure only when it is a durable answer about *this user*, not a
 * transient fault.
 *
 * 404 from `/tenants/me` is the ordinary "signed in, no coaching yet" state —
 * a student browsing public mocks hits it on every screen, and re-asking each
 * time is exactly the traffic this store exists to remove. A 500 or a dropped
 * connection says nothing about the user and must not be remembered.
 */
function isDurableFailure(error: unknown): boolean {
  return error instanceof ApiError && [401, 403, 404].includes(error.status);
}

function cachedGet<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  if (!isBrowser) return fetcher();

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.result.ok
      ? Promise.resolve(hit.result.value as T)
      : Promise.reject(hit.result.error);
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fetcher()
    .then(
      (value) => {
        cache.set(key, { result: { ok: true, value }, at: Date.now() });
        return value;
      },
      (error: unknown) => {
        if (isDurableFailure(error)) {
          cache.set(key, { result: { ok: false, error }, at: Date.now() });
        }
        throw error;
      },
    )
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** The signed-in account. Resolves to `{ user: null }` when signed out. */
export function getSession(): Promise<SessionPayload> {
  return cachedGet(SESSION_KEY, SESSION_TTL_MS, () =>
    api.get<SessionPayload>("/api/auth/get-session"),
  );
}

/** The caller's coaching and their role in it. **Rejects with a 404 ApiError**
 *  when they belong to none — callers branch on that, so it is not an error. */
export function getTenant<T extends TenantBase = TenantBase>(): Promise<TenantPayload<T>> {
  return cachedGet(TENANT_KEY, TENANT_TTL_MS, () =>
    api.get<TenantPayload<T>>("/tenants/me"),
  );
}

/**
 * Drop both cached answers and tell every mounted consumer to re-read.
 *
 * Call after anything that changes who the user is or what they belong to:
 * sign-in, sign-out, accepting an invite, joining or creating a coaching.
 * Skipping it on a membership change is the subtle one — a student who joined
 * a coaching seconds after a cached 404 from `/tenants/me` would be redirected
 * as though they still had none.
 */
export function invalidateSession(): void {
  cache.clear();
  inflight.clear();
  subscribers.forEach((fn) => fn());
}

/**
 * Re-run on invalidation. Notifications fire only from `invalidateSession`,
 * never on an ordinary cache fill — a subscriber that re-read on every write
 * would wake each mounted hook every time any one of them fetched.
 */
export function subscribeToSession(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

// A 401 from any endpoint means the session died server-side — expired, revoked,
// or signed out in another tab. Without this the shell keeps rendering
// signed-in chrome from cache over a page whose every request is failing.
if (isBrowser) setUnauthorizedHandler(invalidateSession);
