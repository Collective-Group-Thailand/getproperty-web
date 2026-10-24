import type { MetadataRoute } from "next";

import { GUIDE_SLUGS } from "@/features/owner/marketing/guides";
import { publicListingAreas, publicListingSlugs } from "@/features/owner/marketing/publicApi";
import { marketingOrigin } from "@/features/owner/marketing/seo";
import { MARKETING_PATHS } from "@/lib/zones/marketing";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

/** Rendered per request: the origin comes from the runtime environment, not the build. */
export const dynamic = "force-dynamic";

/**
 * The public marketing pages only (F1 1.3 §7), on the public site when `MARKETING_HOST` is set; the staff/admin hosts
 * answer 404 for /sitemap.xml.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = marketingOrigin();
  const languages = (path: string) =>
    Object.fromEntries(routing.locales.map((locale) => [locale, `${origin}${getPathname({ href: path, locale })}`]));
  // Published listings (D-252) from the API; none when it is down — the static pages are listed regardless.
  const listings = (await publicListingSlugs()).map(({ slug, updatedAt }) => ({
    url: `${origin}${getPathname({ href: `/rent/${slug}`, locale: routing.defaultLocale })}`,
    lastModified: updatedAt,
    changeFrequency: "daily" as const,
    priority: 0.7,
    alternates: { languages: languages(`/rent/${slug}`) },
  }));
  const guides = GUIDE_SLUGS.map((slug) => ({
    url: `${origin}${getPathname({ href: `/guides/${slug}`, locale: routing.defaultLocale })}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
    alternates: { languages: languages(`/guides/${slug}`) },
  }));
  // Area pages (D-272) only when the API marks them indexable.
  const areas = (await publicListingAreas())
    .filter((area) => area.indexable)
    .map((area) => ({
      url: `${origin}${getPathname({ href: `/rent/area/${area.slug}`, locale: routing.defaultLocale })}`,
      changeFrequency: "daily" as const,
      priority: 0.6,
      alternates: { languages: languages(`/rent/area/${area.slug}`) },
    }));
  const pages = MARKETING_PATHS.map((path) => ({
    url: `${origin}${getPathname({ href: path, locale: routing.defaultLocale })}`,
    changeFrequency: (path.startsWith("/legal") ? "yearly" : "monthly") as "yearly" | "monthly",
    priority: path === "/" ? 1 : 0.6,
    alternates: {
      languages: languages(path),
    },
  }));
  return [...pages, ...guides, ...areas, ...listings];
}
