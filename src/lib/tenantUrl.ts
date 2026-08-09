"use client";

import type { useRouter } from "next/navigation";
import { ApiError } from "./api";
import { getSession, getTenant } from "./sessionStore";
import { buildTenantUrl, currentTenantSlug, appHostUrl } from "./domain";

// Re-export so existing importers of "@/lib/tenantUrl" keep working.
export { buildTenantUrl, currentTenantSlug } from "./domain";

type Router = ReturnType<typeof useRouter>;

/**
 * After a successful auth event (login, signup, OTP verify, invite accept,
 * join), put the user on the right host:
 *
 *   - has tenant + we're already on that tenant's subdomain → router.replace(path)
 *   - has tenant + we're NOT on it (app / root / other slug) → hard nav to <slug>.<root>
 *   - no tenant (404 from /tenants/me) + on tenant subdomain  → hard nav to app host
 *   - no tenant (404 from /tenants/me) + already on app/root  → router.replace(path)
 *   - fetch fails for another reason                          → router.replace(path) (best effort)
 *
 * In the no-tenant case `path` is `/create-coaching` for someone who signed up
 * to run a coaching, and the usual `/coaching/dashboard` for everyone else — see
 * `pendingOwnerPath`.
 *
 * `nextParam` honors a `?next=/foo` from the URL — relative paths only, for
 * obvious phishing reasons.
 */
export async function postAuthRedirect(
  router: Router,
  opts: { fallbackPath?: string; nextParam?: string | null } = {},
): Promise<void> {
  const explicitNext = opts.nextParam && opts.nextParam.startsWith("/")
    ? opts.nextParam
    : null;
  const path = explicitNext ?? opts.fallbackPath ?? "/coaching/dashboard";

  try {
    const data = await getTenant();
    const slug = data.tenant.slug;

    if (currentTenantSlug() === slug) {
      router.replace(path);
      return;
    }
    window.location.href = buildTenantUrl(slug, path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // User has no tenant yet — must land on the app host so they can create
      // or join a coaching. If they signed in on a tenant subdomain (e.g.
      // niazi.staging.gyaanverse.com) we hard-nav them to the app host
      // (staging.gyaanverse.com / app.gyaanverse.com / app.lvh.me).
      //
      // Only the bare `/coaching/dashboard` default is overridden. A caller that named a
      // destination — a ?next= invite link, or an explicit fallbackPath like
      // /student/classes after a join — knows something more specific than
      // "you meant to run a coaching once", so it wins.
      const named = explicitNext !== null || opts.fallbackPath !== undefined;
      const noTenantPath = named ? path : (await pendingOwnerPath()) ?? path;
      if (currentTenantSlug() !== null) {
        window.location.href = appHostUrl(noTenantPath);
        return;
      }
      router.replace(noTenantPath);
      return;
    }
    // Network / 5xx — best effort, still navigate locally
    router.replace(path);
  }
}

/**
 * `/create-coaching` if the signed-in user signed up to run a coaching, else
 * null (let the caller use its own default).
 *
 * Only ever called on the no-tenant branch above, which is the one moment the
 * answer matters: a coaching owner earns the `coaching_owner` role by creating
 * the coaching, so until they do they look exactly like a student and every
 * default route files them into `/student`. The signup intent is what breaks
 * that tie.
 *
 * Deliberately NOT sticky-forever: `/create-coaching` cancels to `/coaching/dashboard`,
 * which renders the "No institute yet" create-or-join card for the same user.
 * So this is a starting point on each sign-in, not a trap.
 *
 * Any failure returns null — a session read that didn't resolve is not grounds
 * for overriding where the user was already going.
 */
async function pendingOwnerPath(): Promise<string | null> {
  try {
    const res = await getSession();
    return res?.user?.signupIntent === "coaching_owner" ? "/create-coaching" : null;
  } catch {
    return null;
  }
}
