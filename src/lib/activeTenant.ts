"use client";

/**
 * The slug of the coaching the **session** resolved to, as opposed to the one
 * the hostname names.
 *
 * These are normally the same and the hostname is authoritative. They come
 * apart whenever a member is on a host with no slug — `app.gyaanverse.com`, the
 * apex, or `localhost:3000` in dev — because `GET /tenants/me` deliberately
 * runs without `tenantMiddleware` and answers with the user's oldest membership
 * instead of 400ing. The page then renders a coaching it cannot fetch anything
 * for: every `/tenant/*` route *does* run `tenantMiddleware`, and with no
 * `X-Tenant-Slug` header it fails with "Could not resolve tenant from request".
 *
 * Owner and teacher screens never hit that, only because they pass
 * `{ tenant: tenant.slug }` by hand on every call. The student screens don't,
 * so this closes the gap for all of them at once.
 *
 * Written by `lib/sessionStore` when `/tenants/me` answers; read by
 * `resolveTenantSlug` in `lib/api`. It lives in its own module so neither of
 * those has to import the other — sessionStore fetches *through* api, so the
 * reverse import would be a real runtime cycle (same reason the 401 handler is
 * registered rather than imported).
 *
 * Not a security boundary: the server re-checks membership for whatever slug
 * arrives (`requireTenantRole`), so a slug we were just handed by `/tenants/me`
 * grants nothing a forged one wouldn't.
 */
let activeSlug: string | null = null;

/** Record the slug `/tenants/me` resolved to. Pass `null` to forget it. */
export function setActiveTenantSlug(slug: string | null): void {
  activeSlug = slug;
}

/** The last slug `/tenants/me` resolved to, or null before it has answered. */
export function getActiveTenantSlug(): string | null {
  return activeSlug;
}
