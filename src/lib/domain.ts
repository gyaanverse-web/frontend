/**
 * Environment-aware multi-tenant domain resolution.
 *
 * The tenant model has three moving parts, and they differ per environment:
 *
 *   ┌────────────┬──────────────────────┬───────────────────────────┬──────────────────────────────┐
 *   │ env        │ APP_HOST (landing)   │ APP_ROOT_DOMAIN (tenants) │ example tenant URL           │
 *   ├────────────┼──────────────────────┼───────────────────────────┼──────────────────────────────┤
 *   │ dev        │ app.lvh.me           │ lvh.me                    │ niazi.lvh.me                  │
 *   │ staging    │ staging.gyaanverse…  │ staging.gyaanverse.com    │ niazi.staging.gyaanverse.com  │
 *   │ production │ app.gyaanverse.com   │ gyaanverse.com            │ niazi.gyaanverse.com          │
 *   └────────────┴──────────────────────┴───────────────────────────┴──────────────────────────────┘
 *
 * - APP_HOST is where users with no tenant land (marketing / auth / "create coaching").
 * - APP_ROOT_DOMAIN is the suffix under which each tenant gets `<slug>.<root>`.
 *
 * These come from build-time `NEXT_PUBLIC_*` env vars. When they are unset we
 * fall back to the old dev behaviour (derive from `*.lvh.me`), so local dev
 * needs no env vars. Production/staging MUST set both — otherwise the string
 * stripping below would treat `staging` as if it were a tenant slug.
 */

/** Tenant suffix root, e.g. "gyaanverse.com" or "staging.gyaanverse.com". Empty in dev. */
export const APP_ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? "";

/** Landing host for users with no tenant, e.g. "app.gyaanverse.com" or "staging.gyaanverse.com". Empty in dev. */
export const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST ?? "";

/**
 * Root domain used for display strings ("your-slug.<root>"). Falls back to the
 * legacy brand domain when unconfigured so copy still renders during SSR/dev.
 */
export const TENANT_ROOT_DOMAIN = APP_ROOT_DOMAIN || "gyanverse.com";

// Subdomains that are NOT tenants. Mirrors the backend's RESERVED_SUBDOMAINS in
// src/middleware/tenant.middleware.ts.
export const RESERVED_SUBDOMAINS = new Set([
  "www",
  "api",
  "app",
  "admin",
  "auth",
  "static",
  "cdn",
  "staging",
]);

/**
 * Core resolver: given a hostname, return the tenant slug it represents, or
 * `null` when the host is the app/landing/apex host (no tenant context).
 */
export function slugFromHost(host: string): string | null {
  if (!host) return null;

  // Configured environments (staging / production): resolve relative to the
  // known root instead of guessing by stripping the leftmost label.
  if (APP_ROOT_DOMAIN) {
    if (host === APP_ROOT_DOMAIN) return null; // apex == app host (e.g. staging.gyaanverse.com)
    if (APP_HOST && host === APP_HOST) return null; // e.g. app.gyaanverse.com
    if (host.endsWith(`.${APP_ROOT_DOMAIN}`)) {
      const label = host.slice(0, -(APP_ROOT_DOMAIN.length + 1)).split(".")[0];
      if (!label || RESERVED_SUBDOMAINS.has(label)) return null;
      return label;
    }
    return null; // unknown host — treat as app root, no tenant
  }

  // Dev fallback (no configured root): `<slug>.lvh.me`.
  if (host === "lvh.me" || host === "localhost") return null;
  const parts = host.split(".");
  if (parts.length < 2) return null;
  const label = parts[0];
  if (RESERVED_SUBDOMAINS.has(label)) return null;
  return label;
}

/** Current hostname's tenant slug, or null on the app / root / landing host. SSR-safe. */
export function currentTenantSlug(): string | null {
  if (typeof window === "undefined") return null;
  return slugFromHost(window.location.hostname);
}

/** True when the current page is on a tenant subdomain. Always false during SSR. */
export function hasTenantContext(): boolean {
  return currentTenantSlug() !== null;
}

/**
 * Build the absolute URL for a specific tenant subdomain.
 *
 *   staging → https://niazi.staging.gyaanverse.com/coaching/dashboard
 *   prod    → https://niazi.gyaanverse.com/coaching/dashboard
 *   dev     → http://niazi.lvh.me:3000/coaching/dashboard
 *
 * The auth cookie's Domain is the registrable root, so the session survives the hop.
 */
export function buildTenantUrl(slug: string, path: string = "/coaching/dashboard"): string {
  if (typeof window === "undefined") return path;
  const { protocol, hostname, port } = window.location;
  const portSuffix = port ? `:${port}` : "";

  let root: string;
  if (APP_ROOT_DOMAIN) {
    root = APP_ROOT_DOMAIN;
  } else if (hostname === "lvh.me" || hostname.endsWith(".lvh.me")) {
    root = "lvh.me";
  } else {
    // Strip leftmost label for `<sub>.<root>` hosts; keep bare apex as-is.
    const parts = hostname.split(".");
    root = parts.length > 2 ? parts.slice(1).join(".") : hostname;
  }

  return `${protocol}//${slug}.${root}${portSuffix}${path}`;
}

/**
 * Build the absolute URL for the app / landing host (where no-tenant users go
 * to create or join a coaching). In staging this is `staging.gyaanverse.com`,
 * in prod `app.gyaanverse.com`, in dev `app.lvh.me`.
 */
export function appHostUrl(path: string = "/coaching/dashboard"): string {
  if (typeof window === "undefined") return path;
  const { protocol, port } = window.location;
  const portSuffix = port ? `:${port}` : "";
  if (APP_HOST) return `${protocol}//${APP_HOST}${portSuffix}${path}`;
  // Dev fallback: app.<root> (e.g. app.lvh.me).
  return buildTenantUrl("app", path);
}
