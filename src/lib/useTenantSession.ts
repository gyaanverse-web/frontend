"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  getSession,
  getTenant,
  invalidateSession,
  subscribeToSession,
} from "@/lib/sessionStore";
import { resolveDisplayRole } from "@/components/dashboard/appNav";

/**
 * The role a user holds **within one coaching**. Read from the `memberships`
 * table server-side and returned by `GET /tenants/me` as `membershipRole`.
 *
 * This is the ONLY role that may gate tenant-scoped UI. It is not the same as
 * the account's global role on the auth session: a user can own one coaching
 * (global role `coaching_owner`) while being a `teacher` in another. The API
 * authorises every `/tenant/*` route with `requireTenantRole`, which reads this
 * membership — so a screen gated on the global role would show controls whose
 * every request 403s.
 */
export type TenantRole = "coaching_owner" | "teacher" | "student";

/**
 * The signed-in account — the canonical shape for the whole frontend.
 *
 * Deliberately carries **no role**: a role only exists relative to a coaching,
 * so there is no correct account-level answer to "what is this user?". Use
 * `role` from `useTenantSession` for anything inside a coaching, or the
 * narrowly-scoped `accountRole` for the two pre-tenant questions.
 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  tenantId: string | null;
  isProfileComplete: boolean;
}

/** Minimum tenant shape every caller gets. Pages needing more columns from
 *  `/tenants/me` pass their own richer type as the generic parameter. */
export interface TenantBase {
  id: string;
  slug: string;
  name: string;
}

export interface UseTenantSessionOptions {
  /**
   * Tenant roles permitted on this page. Anyone else is redirected to
   * `denyRedirect`. Omit to allow every member of the coaching.
   */
  allow?: readonly TenantRole[];
  /** Where a disallowed role is sent. Defaults to the dashboard. */
  denyRedirect?: string;
  /**
   * Whether the page needs a coaching. When true (the default) a user with no
   * membership is redirected; when false they land with `noTenant: true`, which
   * screens like the dashboard use to render a "join a coaching" state.
   */
  requireTenant?: boolean;
}

export interface TenantSession<T extends TenantBase> {
  /** True until both the session and the coaching have resolved. */
  loading: boolean;
  user: SessionUser | null;
  tenant: T | null;
  /** The caller's role in `tenant`. Null while loading or when there is none. */
  role: TenantRole | null;
  /**
   * The role the **chrome** (sidebar, badges) should render for — the single
   * answer to "which navigation does this person get?".
   *
   * It is `role` whenever there is a coaching, and falls back to `accountRole`
   * only for the genuinely tenant-free case (a student browsing public mocks
   * before joining anything), where `role` is legitimately null forever.
   * Crucially it stays **null while loading**, so a shell can render a skeleton
   * instead of guessing a role and leaking another role's menu for a frame.
   *
   * Never gate a permission on this — it is display-only. Use `role`/`isOwner`
   * for anything the server will authorise.
   */
  displayRole: string | null;
  /** Convenience for the most common gate. */
  isOwner: boolean;
  /** Signed in, but belongs to no coaching (only reachable with `requireTenant: false`). */
  noTenant: boolean;
  /**
   * The **account-level** role from the auth session.
   *
   * Valid for exactly two questions, both of which sit outside any coaching:
   * "is this the platform `super_admin`?" and "this user has no membership yet —
   * did they sign up to study or to run a coaching?". For anything inside a
   * coaching use `role`; the server authorises on the membership, so gating
   * tenant UI on this value produces screens whose requests 403.
   */
  accountRole: string | null;
  /**
   * What the user picked on the signup screen: `"student"` or
   * `"coaching_owner"`. Routing only — it grants nothing, and the server
   * ignores it for every authorisation decision.
   *
   * Its whole job is the window `accountRole` cannot cover: an owner is only
   * promoted to the `coaching_owner` account role by creating a coaching, so
   * between signing up and naming their institute they carry the default
   * 'student' role and are indistinguishable from a real student. Pass it to
   * `belongsToStudentArea` rather than reading it directly.
   */
  signupIntent: string | null;
  /**
   * Re-run the session + coaching fetch. Call after mutating the coaching
   * itself (rename, delete) so the shared state reflects the change instead of
   * each page patching its own copy.
   */
  refresh: () => void;
}

/**
 * Resolve the signed-in user, their coaching, and their role in it — in one
 * place, so every screen gates on the same value.
 *
 * Unauthenticated callers are sent to `/login`. Callers whose role is not in
 * `allow` are sent to `denyRedirect`. Both cases leave `loading` true so the
 * page never flashes content it is about to navigate away from.
 *
 * @example
 * const { loading, user, tenant, role, isOwner } =
 *   useTenantSession({ allow: ["coaching_owner", "teacher"] });
 */
export function useTenantSession<T extends TenantBase = TenantBase>(
  options: UseTenantSessionOptions = {},
): TenantSession<T> {
  const { allow, denyRedirect = "/coaching/dashboard", requireTenant = true } = options;
  const router = useRouter();

  // `allow` is almost always a fresh array literal, which would re-run the
  // effect on every render. Collapse it to a stable string key.
  const allowKey = allow ? allow.join(",") : "";

  // Bumped by `refresh()` to re-run the fetch effect.
  const [nonce, setNonce] = useState(0);

  const [state, setState] = useState<Omit<TenantSession<T>, "isOwner" | "displayRole" | "refresh">>({
    loading: true,
    user: null,
    tenant: null,
    role: null,
    noTenant: false,
    accountRole: null,
    signupIntent: null,
  });

  // Re-read whenever the session is invalidated anywhere — a sign-out in the
  // shell, an accepted invite, another component's `refresh()`. Without this
  // each hook instance kept its own copy and only the caller that mutated
  // anything would see the change.
  useEffect(() => subscribeToSession(() => setNonce((n) => n + 1)), []);

  useEffect(() => {
    let cancelled = false;

    // Both reads are served from lib/sessionStore, so the ~20 screens using this
    // hook plus the standalone callers share one pair of requests per TTL
    // instead of firing two on every mount.
    Promise.allSettled([getSession(), getTenant<T>()]).then(([sessionResult, tenantResult]) => {
      if (cancelled) return;

      // Better Auth answers 200 `{ user: null }` when unauthenticated rather
      // than rejecting, so check the payload and not just the settle status.
      const sessionUser =
        sessionResult.status === "fulfilled" ? sessionResult.value?.user ?? null : null;
      if (!sessionUser) {
        router.push("/login");
        return;
      }

      // Strip the account role and signup intent off `user` so callers can't
      // reach for them by habit — both are surfaced separately, with the narrow
      // contract documented on those fields.
      const { role: accountRole = null, signupIntent = null, ...user } = sessionUser;

      if (tenantResult.status === "rejected") {
        if (requireTenant) {
          router.push("/coaching/dashboard");
          return;
        }
        setState({
          loading: false, user, tenant: null, role: null, noTenant: true, accountRole, signupIntent,
        });
        return;
      }

      const { tenant, membershipRole } = tenantResult.value;
      if (allowKey !== "" && !allowKey.split(",").includes(membershipRole)) {
        router.push(denyRedirect);
        return;
      }

      setState({
        loading: false, user, tenant, role: membershipRole, noTenant: false, accountRole, signupIntent,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [router, allowKey, denyRedirect, requireTenant, nonce]);

  // Must invalidate, not just re-run the effect: without dropping the cached
  // answers the refetch would be served the very copy the caller is trying to
  // get past. The invalidation notifies every other mounted hook too, so a
  // rename or a role change lands everywhere at once.
  const refresh = useCallback(() => invalidateSession(), []);

  return useMemo(
    () => ({
      ...state,
      isOwner: state.role === "coaching_owner",
      displayRole: resolveDisplayRole(
        state.role, state.noTenant, state.accountRole, state.signupIntent,
      ),
      refresh,
    }),
    [state, refresh],
  );
}
