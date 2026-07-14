const FALLBACK_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// SSR / no-subdomain fallback. In dev, prefer hitting the app via
// http://<slug>.localhost:3000 — the slug is then auto-derived in the browser.
const FALLBACK_TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? "dev";

// Reserved hostnames that must never be treated as tenant slugs. Mirrors the
// backend's RESERVED_SUBDOMAINS list in tenant.middleware.ts.
const RESERVED_SUBDOMAINS = new Set(["www", "api", "app", "admin", "auth", "static", "cdn"]);

/**
 * Resolve the API base URL.
 *
 * On *.lvh.me in the browser, mirror the current subdomain onto port 8000
 * (e.g. niazi.lvh.me:3000 -> http://niazi.lvh.me:8000). Frontend and API
 * then share a registrable domain, so Better Auth's SameSite=Lax cookies
 * are delivered on cross-origin fetch.
 *
 * In SSR or on non-dev hosts (production), fall back to NEXT_PUBLIC_API_URL.
 */
function resolveApiUrl(): string {
  if (typeof window === "undefined") return FALLBACK_API_URL;
  const host = window.location.hostname;
  if (host.endsWith(".lvh.me")) return `http://${host}:8000`;
  return FALLBACK_API_URL;
}

/**
 * Derive the tenant slug from the current browser hostname.
 *   niazi.lvh.me        -> "niazi"
 *   niazi.gyanverse.com -> "niazi"
 *   lvh.me / gyanverse.com / app.<root> -> FALLBACK_TENANT_SLUG
 * Returns the fallback on SSR (no window) so callers always get a string.
 */
export function resolveTenantSlug(): string {
  if (typeof window === "undefined") return FALLBACK_TENANT_SLUG;

  const host = window.location.hostname;
  if (host === "lvh.me") return FALLBACK_TENANT_SLUG;

  const parts = host.split(".");
  // Need at least <slug>.<root> — e.g. "niazi.lvh.me" or "niazi.gyanverse.com"
  if (parts.length < 2) return FALLBACK_TENANT_SLUG;

  const candidate = parts[0];
  if (RESERVED_SUBDOMAINS.has(candidate)) return FALLBACK_TENANT_SLUG;
  return candidate;
}

/**
 * Returns true when the current page is on a tenant subdomain (e.g. niazi.lvh.me
 * or niazi.gyanverse.com). False on the main app domain (app.lvh.me, app.gyanverse.com).
 * Always false during SSR.
 */
export function hasTenantContext(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "lvh.me" || host === "localhost") return false;
  const parts = host.split(".");
  if (parts.length < 2) return false;
  return !RESERVED_SUBDOMAINS.has(parts[0]);
}

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  tenant?: string;
};

// Concurrent GET requests to the same URL share one in-flight promise instead
// of each firing a separate HTTP round-trip. Cleared as soon as the promise
// settles, so the next call after the response always gets a fresh fetch.
const inflightGets = new Map<string, Promise<unknown>>();

async function execFetch<T>(
  url: URL,
  method: string,
  headers: Record<string, string>,
  body?: unknown,
): Promise<T> {
  const res = await fetch(url.toString(), {
    method,
    credentials: "include",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(data?.message ?? `HTTP ${res.status}`, res.status);
  return data as T;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, tenant } = opts;

  const url = new URL(path, resolveApiUrl());
  const slug = tenant ?? resolveTenantSlug();

  // Send the tenant slug as a header on every request. The backend's
  // tenantMiddleware reads X-Tenant-Slug; routes without that middleware
  // (auth, global) ignore it harmlessly. This lets us drop the old
  // `/tenant/`-prefix gate that was needed for the ?tenant= query param.
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (slug) headers["X-Tenant-Slug"] = slug;

  if (method === "GET") {
    const tenantHeader = headers["X-Tenant-Slug"] ?? "";
    const key = `${url.toString()}|${tenantHeader}`;
    const inflight = inflightGets.get(key);
    if (inflight) return inflight as Promise<T>;

    const promise = execFetch<T>(url, "GET", headers).finally(() =>
      inflightGets.delete(key),
    );
    inflightGets.set(key, promise);
    return promise;
  }

  return execFetch<T>(url, method, headers, body);
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "GET" }),

  post: <T>(path: string, body: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),

  patch: <T>(path: string, body: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),

  put: <T>(path: string, body: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PUT", body }),

  delete: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
