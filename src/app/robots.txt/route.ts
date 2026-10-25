import { APP_PATH_PREFIXES, SITE_ORIGIN, hostKind } from "@/lib/seo";

/**
 * `/robots.txt`, computed per host.
 *
 * A route handler rather than the `app/robots.ts` convention because that one
 * is evaluated at build time and baked into a single static file — and a
 * single file cannot say "index the marketing site" to `gyaanverse.com` and
 * "index nothing" to `niazi.gyaanverse.com`, which is the entire requirement.
 */
export const dynamic = "force-dynamic";

const DISALLOW_ALL = `User-agent: *
Disallow: /
`;

export function GET(request: Request) {
  const host = request.headers.get("host") ?? "";

  // Tenant portals, reserved subdomains and preview deployments: nothing here
  // is ours to publish. A coaching's student portal showing up in a search
  // result is a privacy problem, not a marketing win.
  const body =
    hostKind(host) === "marketing"
      ? `User-agent: *
${APP_PATH_PREFIXES.map((p) => `Disallow: ${p}`).join("\n")}

Sitemap: ${SITE_ORIGIN}/sitemap.xml
`
      : DISALLOW_ALL;

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Short cache: the answer depends on the Host header, and a CDN that
      // cached one host's copy for every host would defeat the point.
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
