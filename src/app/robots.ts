import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { marketingOrigin } from "@/features/owner/marketing/seo";
import { serverEnv } from "@/lib/env/server";
import { hostname } from "@/lib/zones";

/** Rendered per request: the origin comes from the runtime environment, not the build. */
export const dynamic = "force-dynamic";

/**
 * Only the public marketing pages may be crawled (every other response also carries `X-Robots-Tag: noindex`). With a
 * public site (`MARKETING_HOST`) they are crawled there and the owner host is closed (`Disallow: /`); without one, on
 * the owner host. The staff and admin hosts serve their own `Disallow: /`.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const marketingHost = serverEnv().MARKETING_HOST;
  if (marketingHost && hostname((await headers()).get("host")) !== hostname(marketingHost)) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/$",
          "/pricing$",
          "/landlords$",
          "/rent$",
          "/rent/",
          "/legal/",
          "/en$",
          "/en/pricing$",
          "/en/landlords$",
          "/en/rent$",
          "/en/rent/",
          "/en/legal/",
          "/llms.txt$",
        ],
        disallow: "/",
      },
    ],
    sitemap: `${marketingOrigin()}/sitemap.xml`,
  };
}
