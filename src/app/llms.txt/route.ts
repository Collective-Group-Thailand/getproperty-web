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
 * (GEO/AEO, same pattern as getpack). Built only from the marketing copy and the published listings, so it never says
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

  const sections: string[] = [];
  for (const locale of [routing.defaultLocale, ...routing.locales.filter((l) => l !== routing.defaultLocale)]) {
    const t = await getTranslations({ locale, namespace: "owner.marketing" });
    const faq = (group: keyof typeof FAQ) =>
      FAQ[group].map((key) => `### ${t(`${group}.${key}.q`)}\n\n${t(`${group}.${key}.a`)}`).join("\n\n");
    sections.push(
      [
        `## ${locale === "th" ? "ภาษาไทย" : "English"}`,
        `> ${t("meta.description")}`,
        [
          `- [${t("nav.home")}](${url("/", locale)}): ${t("meta.description")}`,
          `- [${t("nav.landlords")}](${url("/landlords", locale)}): ${t("landlords.meta.description")}`,
          `- [${t("nav.rent")}](${url("/rent", locale)}): ${t("listings.meta.description")}`,
          `- [${t("nav.pricing")}](${url("/pricing", locale)}): ${t("meta.pricingDescription")}`,
          `- [${t("guides.title")}](${url("/guides", locale)}): ${t("guides.meta.description")}`,
          `- [${t("tools.title")}](${url("/tools", locale)}): ${t("tools.intro")}`,
          ...(["utility", "receipt", "yield"] as const).map(
            (key) => `  - [${t(`tools.${key}.title`)}](${url(TOOL_PATH[key], locale)}): ${t(`tools.${key}.card`)}`,
          ),
          `- [${t("nav.foreignRenters")}](${url("/foreign-renters", locale)}): ${t("foreign.meta.description")}`,
          `- [${t("nav.help")}](${url("/help", locale)}): ${t("help.meta.description")}`,
          `- [${t("nav.security")}](${url("/security", locale)}): ${t("security.meta.description")}`,
          `- [${t("nav.about")}](${url("/about", locale)}): ${t("about.meta.description")}`,
          `- [${t("nav.contactPage")}](${url("/contact", locale)}): ${t("contact.meta.description")}`,
          `- [${t("nav.legal")}](${url("/legal/terms", locale)})`,
        ].join("\n"),
        // Guides: the short answer of each, which is what an answer engine quotes (D-271).
        guidesFor(locale)
          .map((guide) => `### [${guide.title}](${url(`/guides/${guide.slug}`, locale)})\n\n${guide.answer}`)
          .join("\n\n"),
        faq("faq.items"),
        faq("landlords.faq.items"),
        faq("pricing.faq.items"),
      ].join("\n\n"),
    );
  }

  const listings = await publicListings({ sort: "newest" });
  const listingLines = (listings?.data ?? []).map(
    (l) =>
      `- [${l.title}](${url(`/rent/${l.slug}`, routing.defaultLocale)}): ${l.district}, ${l.province} · ${l.rent} THB/month`,
  );

  const areas = (await publicListingAreas()).filter((area) => area.indexable);
  const areaLines = areas.map(
    (a) => `- [${a.nameEn} / ${a.name}](${url(`/rent/area/${a.slug}`, routing.defaultLocale)}): ${a.count} listings`,
  );

  const tEn = await getTranslations({ locale: "en", namespace: "owner.marketing" });
  const body = [
    "# getproperty",
    `> ${tEn("meta.description")}`,
    [
      "Key facts:",
      "- Operator: Collective Group (Thailand)",
      "- Market: Thailand; Thai and English",
      "- For: apartment and dormitory operators, and owners renting out houses and condos",
      "- Price: free to use — no monthly or per-room fee; a fee applies only to payments confirmed through the platform",
      "- Money: paid through a licensed payment provider and settled to the owner's account; getproperty never holds funds",
      "- Residents: bills with a QR, receipts and repair requests in LINE",
      "- Listings: owners list rooms, condos and houses for rent free, with the full address shown",
    ].join("\n"),
    ...sections,
    areaLines.length ? ["## Areas", ...areaLines].join("\n") : "",
    listingLines.length ? ["## Listings (latest)", ...listingLines].join("\n") : "",
    `## More\n\n- [Sitemap](${origin}/sitemap.xml)`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return new Response(`${body}\n`, {
    headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
