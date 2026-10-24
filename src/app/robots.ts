import { robotsAllowRules } from "@collective/web-kit";
import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { marketingOrigin } from "@/features/owner/marketing/seo";
import { serverEnv } from "@/lib/env/server";
import { hostname } from "@/lib/zones";
import { MARKETING_PATHS } from "@/lib/zones/marketing";

/**
 * Every public path in both languages, from the zone's own list (so a new page cannot be forgotten here): exact pages
 * end with `$`, slug families (listings, areas, guides) end with `/`.
 */
const ROBOTS_ALLOW = robotsAllowRules({
  pages: MARKETING_PATHS.filter((path) => !path.startsWith("/legal/")),
  families: ["/legal/", "/rent/", "/guides/"],
  localePrefixes: ["/en"],
  extra: ["/llms.txt$"],
});

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
        allow: ROBOTS_ALLOW,
        disallow: "/",
      },
    ],
    sitemap: `${marketingOrigin()}/sitemap.xml`,
  };
}
