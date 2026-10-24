import {
  breadcrumbSchema as kitBreadcrumb,
  faqSchema as kitFaq,
  itemListSchema as kitItemList,
  type JsonLd,
  organizationSchema as kitOrganization,
  serializeJsonLd,
  softwareApplicationSchema,
  webPageSchema as kitWebPage,
  websiteSchema as kitWebsite,
} from "@collective/web-kit";

import { BRAND_COMPANY, BRAND_NAME } from "@/ui/brand/config";

/*
 * schema.org structured data for the public pages (SEO, and the answer engines that read it — AEO/GEO). The builders
 * come from `@collective/web-kit` (D-275); this file keeps getproperty's call signatures and adds what links the graphs
 * of one page together (`@id`, `publisher`). The rule of getpack's structured data holds here: nothing is claimed that
 * is not on the page or in the API — no ratings, no review counts, no invented contact numbers.
 */

export type { JsonLd };

const LOGO_PATH = "/brand/getproperty-logo.png";

export function organizationSchema(origin: string, description: string): JsonLd {
  return {
    ...kitOrganization({
      name: BRAND_NAME,
      legalName: BRAND_COMPANY,
      url: origin,
      // A raster logo: search engines want PNG/JPEG for an organisation's logo (`pnpm brand`, 880 × 188).
      logo: `${origin}${LOGO_PATH}`,
      description,
    }),
    "@id": `${origin}/#organization`,
  };
}

/** The site, with the listing search as its search action (a search box in results, and a hint for answer engines). */
export function websiteSchema(origin: string, rentPath: string, inLanguage: string): JsonLd {
  return {
    ...kitWebsite({
      name: BRAND_NAME,
      url: origin,
      inLanguage,
      searchUrlTemplate: `${origin}${rentPath}?q={search_term_string}`,
    }),
    "@id": `${origin}/#website`,
    publisher: { "@id": `${origin}/#organization` },
  };
}

/** The product: free to use (D-250); the per-payment fee is not a price of the software, so no other offer is claimed. */
export function softwareSchema(origin: string, description: string, url: string): JsonLd {
  return {
    ...softwareApplicationSchema({ name: BRAND_NAME, url, description, category: "BusinessApplication", price: "0" }),
    applicationSubCategory: "Property management",
    operatingSystem: "Web, LINE",
    publisher: { "@id": `${origin}/#organization` },
  };
}

export const faqSchema = kitFaq;
export const breadcrumbSchema = kitBreadcrumb;
export const itemListSchema = kitItemList;
export const webPageSchema = kitWebPage;

/** One `<script type="application/ld+json">` body for several graphs, `<` escaped. */
export const jsonLd = serializeJsonLd;
