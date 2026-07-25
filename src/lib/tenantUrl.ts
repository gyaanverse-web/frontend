"use client";

import type { useRouter } from "next/navigation";
import { api, ApiError } from "./api";
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
      // User has no tenant yet — must land on the app host so they can create
      // or join a coaching. If they signed in on a tenant subdomain (e.g.
      // niazi.staging.gyaanverse.com) we hard-nav them to the app host
      // (staging.gyaanverse.com / app.gyaanverse.com / app.lvh.me).
      if (currentTenantSlug() !== null) {
        window.location.href = appHostUrl(path);
        return;
      }
      router.replace(path);
      return;
    }
    // Network / 5xx — best effort, still navigate locally
    router.replace(path);
  }
}
