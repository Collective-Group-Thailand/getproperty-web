import type { MetadataRoute } from "next";

import { ownerOrigin } from "@/features/owner/marketing/seo";
import { MARKETING_PATHS } from "@/lib/zones/marketing";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Rendered per request: the origin comes from the runtime environment, not the build. */
export const dynamic = "force-dynamic";

/** The owner host's public pages only (F1 1.3 §7); the staff/admin hosts answer 404 for /sitemap.xml. */
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = ownerOrigin();
  return MARKETING_PATHS.map((path) => ({
    url: `${origin}${getPathname({ href: path, locale: routing.defaultLocale })}`,
    changeFrequency: path.startsWith("/legal") ? "yearly" : "monthly",
    priority: path === "/" ? 1 : 0.6,
    alternates: {
      languages: Object.fromEntries(
        routing.locales.map((locale) => [locale, `${origin}${getPathname({ href: path, locale })}`]),
      ),
    },
  }));
}
