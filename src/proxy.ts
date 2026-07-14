import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * In dev, every page request to bare `localhost` or bare `lvh.me` is
 * redirected to `app.lvh.me` (the marketing / auth root).
 *
 * Why lvh.me instead of localhost? Chromium treats `localhost` as a public
 * suffix, so `Set-Cookie: Domain=localhost` from any subdomain is silently
 * rejected (RFC 6265 §5.3 step 5). `lvh.me` is a real registered domain
 * whose wildcard DNS resolves to 127.0.0.1 — no public-suffix quirk, so
 * the cross-subdomain auth cookie actually lands and sticks.
 *
 * Why redirect to `app.lvh.me` (not bare `lvh.me`)? Because Better Auth
 * also normalizes `Domain=lvh.me` to host-only when the response host is
 * identical (lvh.me ↔ lvh.me). Serving the root from a subdomain makes
 * host ≠ Domain, so the Domain attribute survives.
 *
 * Implementation note: we read the actual `host` header instead of
 * `new URL(request.url).hostname` because Next.js normalizes the URL's
 * hostname in dev (always reports `localhost`), which would create an
 * infinite redirect loop.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const [hostname, port] = host.split(":");

  if (hostname === "localhost" || hostname === "lvh.me") {
    const url = new URL(request.url);
    url.host = port ? `app.lvh.me:${port}` : "app.lvh.me";
    return NextResponse.redirect(url, 307);
  }

  return NextResponse.next();
}

// Skip Next.js internals so HMR / static assets aren't redirected.
export const config = {
  matcher: ["/((?!_next/|favicon\\.ico).*)"],
};
