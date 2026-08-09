import { slugFromHost, hasTenantContext } from "./domain";

const FALLBACK_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// SSR / no-subdomain fallback. In dev, prefer hitting the app via
// http://<slug>.localhost:3000 — the slug is then auto-derived in the browser.
const FALLBACK_TENANT_SLUG = process.env.NEXT_PUBLIC_TENANT_SLUG ?? "dev";

export { hasTenantContext };

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
 * Derive the tenant slug from the current browser hostname, falling back to
 * FALLBACK_TENANT_SLUG on the app/root host or during SSR so the X-Tenant-Slug
 * header is always a string. See `slugFromHost` in lib/domain.ts for the
 * environment-aware resolution rules.
 */
export function resolveTenantSlug(): string {
  if (typeof window === "undefined") return FALLBACK_TENANT_SLUG;
  return slugFromHost(window.location.hostname) ?? FALLBACK_TENANT_SLUG;
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

/**
 * Notified whenever any request comes back 401.
 *
 * Registered by lib/sessionStore rather than imported from it: the store fetches
 * through this module, so importing it back would be a real runtime cycle.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

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
  if (!res.ok) {
    // The session is gone server-side; anything cached about it is now wrong.
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(data?.message ?? `HTTP ${res.status}`, res.status);
  }
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

  /**
   * Fire-and-forget PUT that survives the page going away.
   *
   * A normal fetch is cancelled when the document unloads, which is exactly when
   * an autosave matters most — the teacher closing the tab mid-wizard. `keepalive`
   * asks the browser to finish the request anyway. Returns nothing and never
   * throws: by the time it fails there is no UI left to tell.
   */
  keepalivePut: (path: string, body: unknown, opts?: { tenant?: string }): void => {
    const url = new URL(path, resolveApiUrl());
    const slug = opts?.tenant ?? resolveTenantSlug();
    void fetch(url.toString(), {
      method: "PUT",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json", ...(slug ? { "X-Tenant-Slug": slug } : {}) },
      body: JSON.stringify(body),
    }).catch(() => { /* the page is unloading; nothing to report to */ });
  },
};
