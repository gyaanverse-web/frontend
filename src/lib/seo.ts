import { APP_HOST, APP_ROOT_DOMAIN, slugFromHost } from "./domain";

/**
 * What crawlers are allowed to see, in one place.
 *
 * The wrinkle here is that ONE Vercel deployment answers for every host in the
 * model — the apex, the app host, each tenant's `<slug>.gyaanverse.com`, the
 * reserved hosts like `ops.`, and preview URLs. A static `public/robots.txt`
 * would hand the same answer to all of them, which is exactly wrong: a
 * coaching institute's portal must never be indexed, while the marketing site
 * must be. So the policy is computed per request from the `Host` header, and
 * `robots.txt`, the sitemap and the `X-Robots-Tag` header in `proxy.ts` all
 * read it from here rather than each keeping their own copy.
 */

/** Canonical origin for absolute URLs in the sitemap and OG tags. */
export const SITE_ORIGIN = `https://${APP_ROOT_DOMAIN || "gyaanverse.com"}`;

/**
 * Public marketing surface — the only paths that belong in a search index.
 * `/mocks` is deliberately included: the public exam catalogue is the one part
 * of the product that genuinely wants organic traffic.
 */
export const INDEXABLE_PATHS = [
  "/",
  "/mocks",
  "/privacy",
  "/terms",
  "/refunds",
] as const;

/**
 * Everything a signed-in user does. Listed as prefixes and used three ways:
 * `Disallow:` lines in robots.txt, the `X-Robots-Tag: noindex` decision in the
 * middleware, and the sitemap's exclusion. Auth screens are here too — they
 * carry no SEO value and a half-indexed `/reset-password` is just confusing.
 */
export const APP_PATH_PREFIXES = [
  "/coaching",
  "/student",
  "/account",
  "/choose-coaching",
  "/create-coaching",
  "/join",
  "/accept-invite",
  "/login",
  "/signup",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/version",
] as const;

export type HostKind = "marketing" | "tenant" | "unknown";

/**
 * Classify the host a request arrived on.
 *
 * `slugFromHost` alone cannot answer this: it returns `null` both for the real
 * marketing host and for anything it does not recognise (a `*.vercel.app`
 * preview, a reserved subdomain like `ops.`). Those must NOT be treated as the
 * marketing site, so they are classified `unknown` and get a blanket noindex.
 */
export function hostKind(host: string): HostKind {
  const hostname = (host || "").toLowerCase().split(":")[0];
  if (!hostname) return "unknown";

  if (APP_ROOT_DOMAIN) {
    if (
      hostname === APP_ROOT_DOMAIN ||
      hostname === `www.${APP_ROOT_DOMAIN}` ||
      (APP_HOST && hostname === APP_HOST)
    ) {
      return "marketing";
    }
    if (hostname.endsWith(`.${APP_ROOT_DOMAIN}`)) {
      // A real tenant slug, or a reserved subdomain (ops., api., …) which is
      // not a tenant and is certainly not the marketing site.
      return slugFromHost(hostname) ? "tenant" : "unknown";
    }
    return "unknown";
  }

  // Dev, where no root domain is configured.
  if (hostname === "localhost" || hostname === "lvh.me" || hostname === "app.lvh.me") {
    return "marketing";
  }
  return slugFromHost(hostname) ? "tenant" : "unknown";
}

/** True when the path is signed-in app surface rather than public marketing. */
export function isAppPath(pathname: string): boolean {
  return APP_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * The single question the middleware asks: should this response carry
 * `X-Robots-Tag: noindex`? Anything that is not a public marketing page on the
 * marketing host gets one.
 */
export function shouldNoindex(host: string, pathname: string): boolean {
  return hostKind(host) !== "marketing" || isAppPath(pathname);
}
