import type { MetadataRoute } from "next";

import { ownerOrigin } from "@/features/owner/marketing/seo";

/** Rendered per request: the origin comes from the runtime environment, not the build. */
export const dynamic = "force-dynamic";

/**
 * Owner host: only the public marketing pages may be crawled (every other response also carries
 * `X-Robots-Tag: noindex`). The staff and admin hosts serve their own `Disallow: /`.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/$", "/pricing$", "/legal/", "/en$", "/en/pricing$", "/en/legal/"],
        disallow: "/",
      },
    ],
    sitemap: `${ownerOrigin()}/sitemap.xml`,
  };
}
