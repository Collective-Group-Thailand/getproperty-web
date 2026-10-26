import { articlesLlmsSection } from "@collective/content";
import { type LlmsSection, renderLlmsTxt } from "@collective/web-kit";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { guidesFor } from "@/features/owner/marketing/guides";
import { publicListingAreas, publicListings } from "@/features/owner/marketing/publicApi";
import { TOOL_PATH } from "@/features/owner/marketing/tools/ToolFrame";
import { marketingOrigin } from "@/features/owner/marketing/seo";
import { serverEnv } from "@/lib/env/server";
import { hostname } from "@/lib/zones";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/** Rendered per request: the origin and the listings come from the runtime environment. */
export const dynamic = "force-dynamic";

/** The FAQ entries each page shows (its `FAQ_KEYS`), in the same order. */
const FAQ = {
  "faq.items": ["what", "meters", "money", "residents", "import", "data"],
  "landlords.faq.items": ["person", "one", "tenant", "agent", "existing"],
  "pricing.faq.items": ["when", "who", "settle", "line", "meter", "invoice"],
} as const;

/**
 * `/llms.txt` (llmstxt.org): a plain markdown statement of what getproperty is, for answer engines and AI assistants
 * (GEO/AEO, same pattern as getpack; rendered by @collective/web-kit). Built only from the marketing copy and the published listings, so it never says
 * anything the pages do not; served on the indexed host only (the one `robots.txt` opens), 404 elsewhere.
 */
export async function GET(): Promise<Response> {
  const env = serverEnv();
  const indexedHost = env.MARKETING_HOST ?? env.OWNER_HOST;
  if (hostname((await headers()).get("host")) !== hostname(indexedHost)) {
    return new Response("Not found", { status: 404 });
  }
  const origin = marketingOrigin();
  const url = (path: string, locale: Locale) => `${origin}${getPathname({ href: path, locale })}`;

  const sections: LlmsSection[] = [];
  for (const locale of [routing.defaultLocale, ...routing.locales.filter((l) => l !== routing.defaultLocale)]) {
    const t = await getTranslations({ locale, namespace: "owner.marketing" });
    const faq = (group: keyof typeof FAQ) =>
      FAQ[group].map((key) => ({ question: t(`${group}.${key}.q`), answer: t(`${group}.${key}.a`) }));
    sections.push({
      heading: locale === "th" ? "ภาษาไทย" : "English",
      summary: t("meta.description"),
      links: [
        { title: t("nav.home"), url: url("/", locale), description: t("meta.description") },
        { title: t("nav.landlords"), url: url("/landlords", locale), description: t("landlords.meta.description") },
        { title: t("nav.rent"), url: url("/rent", locale), description: t("listings.meta.description") },
        { title: t("nav.pricing"), url: url("/pricing", locale), description: t("meta.pricingDescription") },
        { title: t("guides.title"), url: url("/guides", locale), description: t("guides.meta.description") },
        {
          title: t("tools.title"),
          url: url("/tools", locale),
          description: t("tools.intro"),
          children: (["utility", "receipt", "yield"] as const).map((key) => ({
            title: t(`tools.${key}.title`),
            url: url(TOOL_PATH[key], locale),
            description: t(`tools.${key}.card`),
          })),
        },
        {
          title: t("nav.foreignRenters"),
          url: url("/foreign-renters", locale),
          description: t("foreign.meta.description"),
        },
        { title: t("nav.help"), url: url("/help", locale), description: t("help.meta.description") },
        { title: t("nav.security"), url: url("/security", locale), description: t("security.meta.description") },
        { title: t("nav.about"), url: url("/about", locale), description: t("about.meta.description") },
        { title: t("nav.contactPage"), url: url("/contact", locale), description: t("contact.meta.description") },
        { title: t("nav.legal"), url: url("/legal/terms", locale) },
      ],
      qa: [
        // Guides: the short answer of each, which is what an answer engine quotes (D-271, D-277).
        ...articlesLlmsSection(
          t("guides.title"),
          (await guidesFor(locale)).map((guide) => ({
            article: { ...guide, sections: [], faq: [], sources: [] },
            url: url(`/guides/${guide.slug}`, locale),
          })),
        ).qa!,
        ...faq("faq.items"),
        ...faq("landlords.faq.items"),
        ...faq("pricing.faq.items"),
      ],
    });
  }

  const listings = await publicListings({ sort: "newest" });
  const listingLinks = (listings?.data ?? []).map((l) => ({
    title: l.title,
    url: url(`/rent/${l.slug}`, routing.defaultLocale),
    description: `${l.district}, ${l.province} · ${l.rent} THB/month`,
  }));

  const areas = (await publicListingAreas()).filter((area) => area.indexable);
  const areaLinks = areas.map((a) => ({
    title: `${a.nameEn} / ${a.name}`,
    url: url(`/rent/area/${a.slug}`, routing.defaultLocale),
    description: `${a.count} listings`,
  }));

  const tEn = await getTranslations({ locale: "en", namespace: "owner.marketing" });
  const body = renderLlmsTxt({
    name: "getproperty",
    summary: tEn("meta.description"),
    facts: [
      "Operator: Collective Group (Thailand)",
      "Market: Thailand; Thai and English",
      "For: apartment and dormitory operators, and owners renting out houses and condos",
      "Price: free to use — no monthly or per-room fee; a fee applies only to payments confirmed through the platform",
      "Money: paid through a licensed payment provider and settled to the owner's account; getproperty never holds funds",
      "Residents: bills with a QR, receipts and repair requests in LINE",
      "Listings: owners list rooms, condos and houses for rent free, with the full address shown",
    ],
    sections: [
      ...sections,
      ...(areaLinks.length ? [{ heading: "Areas", links: areaLinks }] : []),
      ...(listingLinks.length ? [{ heading: "Listings (latest)", links: listingLinks }] : []),
      { heading: "More", links: [{ title: "Sitemap", url: `${origin}/sitemap.xml` }] },
    ],
  });

  return new Response(body, {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
