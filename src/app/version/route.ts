import { BUILD_INFO } from "@/lib/buildInfo";

/**
 * GET /version
 *
 * The check that needs no browser: `curl https://gyaanverse.com/version`.
 * Handy for a deploy script or an uptime monitor that should assert *which*
 * build is live, not merely that something answered.
 *
 * Dynamic on purpose. The values are compile-time constants, so prerendering
 * this would be cheaper — but a prerendered route is exactly the kind of thing
 * a CDN serves from the previous deploy, which would make the endpoint
 * confidently wrong at the one moment it is being trusted. Running it per
 * request, with `no-store`, is what makes the answer worth believing.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    {
      sha: BUILD_INFO.sha,
      shortSha: BUILD_INFO.shortSha,
      ref: BUILD_INFO.ref,
      env: BUILD_INFO.env,
      builtAt: BUILD_INFO.builtAt,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
