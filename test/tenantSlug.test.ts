import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { resolveTenantSlug } from "@/lib/api";
import { setActiveTenantSlug } from "@/lib/activeTenant";

/**
 * The seam that decides which coaching every request is scoped to.
 *
 * Untested until a student reported "Could not resolve tenant from request" on
 * screens that had just rendered their coaching's name: `/tenants/me` runs
 * without `tenantMiddleware` and resolves a membership on a slugless host,
 * while every `/tenant/*` route needs a slug the hostname wasn't carrying.
 */

/** Stand in for the browser. `resolveTenantSlug` reads only the hostname. */
function onHost(hostname: string): void {
  (globalThis as { window?: unknown }).window = { location: { hostname } };
}

beforeEach(() => {
  setActiveTenantSlug(null);
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  setActiveTenantSlug(null);
});

describe("resolveTenantSlug", () => {
  it("reads the slug off a tenant subdomain", () => {
    onHost("niazi.lvh.me");
    expect(resolveTenantSlug()).toBe("niazi");
  });

  it("prefers the hostname over the session — the URL is what the user can see", () => {
    onHost("niazi.lvh.me");
    setActiveTenantSlug("sharma");
    expect(resolveTenantSlug()).toBe("niazi");
  });

  it("falls back to the session's coaching on a host with no slug", () => {
    // The bug: app host / apex / localhost render a coaching from /tenants/me,
    // then 400 on every tenant-scoped call for want of this header.
    for (const host of ["app.lvh.me", "lvh.me", "localhost"]) {
      onHost(host);
      setActiveTenantSlug("niazi");
      expect(resolveTenantSlug()).toBe("niazi");
    }
  });

  it("stays null for a signed-in user with no coaching", () => {
    // The public marketplace. A slug here would be a guaranteed-failing header.
    onHost("app.lvh.me");
    expect(resolveTenantSlug()).toBeNull();
  });

  it("never treats a reserved subdomain as a coaching", () => {
    onHost("api.lvh.me");
    expect(resolveTenantSlug()).toBeNull();
  });

  it("resolves nothing during SSR", () => {
    // No `window`, and no NEXT_PUBLIC_TENANT_SLUG in this environment — the
    // override is inlined at build time, so it can't be set from a test.
    expect(resolveTenantSlug()).toBeNull();
  });
});
