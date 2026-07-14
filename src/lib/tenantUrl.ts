"use client";

import type { useRouter } from "next/navigation";
import { api, ApiError } from "./api";

// Subdomains that are NOT tenants — kept in sync with backend's
// RESERVED_SUBDOMAINS in src/middleware/tenant.middleware.ts.
const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "auth",
  "static",
  "cdn",
]);

/**
 * Build the URL for a specific tenant subdomain.
 *
 *   on app.lvh.me:3000 + slug=niazi  → http://niazi.lvh.me:3000/dashboard
 *   on lvh.me          + slug=niazi  → http://niazi.lvh.me/dashboard
 *   on gyanverse.com   + slug=niazi  → https://niazi.gyanverse.com/dashboard
 *   on x.gyanverse.com + slug=niazi  → https://niazi.gyanverse.com/dashboard
 *
 * The Better Auth cookie has Domain=lvh.me / Domain=gyanverse.com so the
 * session survives this cross-subdomain hop.
 */
export function buildTenantUrl(slug: string, path: string = "/dashboard"): string {
  if (typeof window === "undefined") return path;
  const { protocol, hostname, port } = window.location;
  const portSuffix = port ? `:${port}` : "";

  let root: string;
  if (hostname === "lvh.me" || hostname.endsWith(".lvh.me")) {
    root = "lvh.me";
  } else {
    // Strip leftmost label for `<sub>.<root>` hosts; keep bare apex as-is.
    const parts = hostname.split(".");
    root = parts.length > 2 ? parts.slice(1).join(".") : hostname;
  }

  return `${protocol}//${slug}.${root}${portSuffix}${path}`;
}

/** Returns the current hostname's tenant slug, or null if on the root / app subdomain. */
export function currentTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host === "lvh.me") return null;

  let prefix: string | null = null;
  if (host.endsWith(".lvh.me")) {
    prefix = host.slice(0, -".lvh.me".length).split(".")[0] || null;
  } else {
    const parts = host.split(".");
    if (parts.length >= 3) prefix = parts[0];
  }
  if (!prefix || RESERVED_SUBDOMAINS.has(prefix)) return null;
  return prefix;
}

type Router = ReturnType<typeof useRouter>;

/**
 * After a successful auth event (login, signup, OTP verify, invite accept,
 * join), put the user on the right host:
 *
 *   - has tenant + we're already on that tenant's subdomain → router.replace(path)
 *   - has tenant + we're NOT on it (app / root / other slug) → hard nav to <slug>.<root>
 *   - no tenant (404 from /tenants/me) + on tenant subdomain  → hard nav to app.<root>
 *   - no tenant (404 from /tenants/me) + already on app/root  → router.replace(path)
 *   - fetch fails for another reason                          → router.replace(path) (best effort)
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
  const path = explicitNext ?? opts.fallbackPath ?? "/dashboard";

  try {
    const data = await api.get<{ tenant: { slug: string } }>("/tenants/me");
    const slug = data.tenant.slug;

    if (currentTenantSlug() === slug) {
      router.replace(path);
      return;
    }
    window.location.href = buildTenantUrl(slug, path);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      // User has no tenant yet — must land on the app subdomain so they can
      // create or join a coaching. If they signed in on a tenant subdomain
      // (e.g. niazi.lvh.me) we hard-nav them to app.<root>.
      if (currentTenantSlug() !== null) {
        window.location.href = buildTenantUrl("app", path);
        return;
      }
      router.replace(path);
      return;
    }
    // Network / 5xx — best effort, still navigate locally
    router.replace(path);
  }
}
