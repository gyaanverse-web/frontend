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

// Subdomains that are NOT tenants. MIRROR of the backend's RESERVED_SLUGS in
// `backend/src/config/reserved-slugs.ts`, which is the source of truth and the
// list that actually blocks registration — keep the two in step. A name here
// that is missing there could be registered and then never resolve.
export const RESERVED_SUBDOMAINS = new Set([
  // Platform hosts and environments.
  "app", "api", "www", "admin", "ops", "internal", "auth", "login", "logout",
  "signin", "signup", "register", "account", "accounts", "dashboard", "portal",
  "staging", "preview", "production", "prod", "dev", "development", "test",
  "testing", "demo", "sandbox", "local", "localhost", "beta", "alpha",

  // Infrastructure and asset hosts.
  "cdn", "static", "assets", "media", "img", "images", "files", "uploads",
  "download", "downloads", "storage", "db", "database", "redis", "queue",
  "queues", "worker", "cache", "proxy", "gateway", "router",

  // Mail and DNS.
  "mail", "email", "smtp", "imap", "pop", "pop3", "mx", "webmail", "send",
  "bounce", "bounces", "noreply", "no-reply", "postmaster", "hostmaster",
  "abuse", "ns", "ns1", "ns2", "ns3", "ns4", "dns", "ftp", "sftp", "vpn",

  // Phishing-adjacent names.
  "secure", "security", "ssl", "tls", "verify", "verification", "validate",
  "confirm", "update", "billing", "payment", "payments", "pay", "checkout",
  "invoice", "invoices", "refund", "wallet", "bank", "my", "me", "user",
  "users", "profile", "password", "reset", "token", "oauth", "sso", "saml",

  // Marketing and content surfaces.
  "blog", "news", "help", "support", "docs", "doc", "documentation", "status",
  "about", "contact", "careers", "jobs", "legal", "privacy", "terms", "press",
  "partners", "pricing", "plans", "store", "shop", "community", "forum",
  "events", "webinar", "academy", "learn", "courses",

  // Observability and tooling.
  "metrics", "monitor", "monitoring", "health", "healthz", "grafana", "kibana",
  "sentry", "logs", "log", "trace", "debug", "ci", "cd", "build", "git",
  "jenkins", "runner", "webhook", "webhooks", "callback", "callbacks",

  // Generic/system words.
  "root", "system", "sys", "config", "settings", "setup", "onboarding", "new",
  "edit", "create", "delete", "remove", "null", "undefined", "none", "true",
  "false", "example", "sample", "default", "public", "private", "index",

  // Brand names.
  "gyaanverse", "gyanverse", "gyaan", "gyan",
]);

/** Hostname-label shape for a tenant slug. Mirrors backend `SLUG_PATTERN`. */
export const SLUG_PATTERN = "^[a-z0-9]([a-z0-9-]*[a-z0-9])?$";

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
