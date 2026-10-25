import type { MetadataRoute } from "next";
import { INDEXABLE_PATHS, SITE_ORIGIN } from "@/lib/seo";

/**
 * Only the public marketing surface. Tenant pages are deliberately absent —
 * they are `noindex` and `Disallow`ed, and listing them would be asking for
 * exactly the indexing this is meant to prevent.
 *
 * Individual `/mocks/<id>` pages are left out too: enumerating them needs a
 * live API call, and a sitemap that can fail the build when the backend is
 * down is worse than a sitemap that lists one page fewer.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return INDEXABLE_PATHS.map((path) => ({
    url: `${SITE_ORIGIN}${path}`,
    lastModified,
    changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
    priority: path === "/" ? 1 : 0.6,
  }));
}
