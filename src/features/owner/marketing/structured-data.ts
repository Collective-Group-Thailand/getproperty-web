import { BRAND_COMPANY, BRAND_NAME } from "@/ui/brand/config";

/*
 * schema.org structured data for the public pages (SEO, and the answer engines that read it — AEO/GEO). The rule of
 * getpack's structured data holds here: nothing is claimed that is not on the page or in the API — no ratings, no
 * review counts, no invented contact numbers.
 */

export type JsonLd = Record<string, unknown>;

export function organizationSchema(origin: string, description: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: BRAND_NAME,
    legalName: BRAND_COMPANY,
    url: origin,
    // A raster logo: search engines want PNG/JPEG for an organisation's logo (`pnpm brand`, 880 × 188).
    logo: `${origin}/brand/getproperty-logo.png`,
    description,
  };
}

/** The site, with the listing search as its search action (a search box in results, and a hint for answer engines). */
export function websiteSchema(origin: string, rentPath: string, inLanguage: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    name: BRAND_NAME,
    url: origin,
    inLanguage,
    publisher: { "@id": `${origin}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${origin}${rentPath}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

/** The product: free to use (D-250); the per-payment fee is not a price of the software, so no other offer is claimed. */
export function softwareSchema(origin: string, description: string, url: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: BRAND_NAME,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Property management",
    operatingSystem: "Web, LINE",
    url,
    description,
    publisher: { "@id": `${origin}/#organization` },
    offers: { "@type": "Offer", price: "0", priceCurrency: "THB" },
  };
}

export function faqSchema(items: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function breadcrumbSchema(crumbs: { name: string; url?: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      ...(crumb.url ? { item: crumb.url } : {}),
    })),
  };
}

export function itemListSchema(urls: string[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: urls.map((url, index) => ({ "@type": "ListItem", position: index + 1, url })),
  };
}

/** One `<script type="application/ld+json">` body for several graphs, `<` escaped. */
export function jsonLd(...graphs: JsonLd[]): string {
  return JSON.stringify(graphs.length === 1 ? graphs[0] : graphs).replace(/</g, "\\u003c");
}

/** A guide (D-271) as an Article by the organisation, with its review date. */
export function articleSchema(input: {
  origin: string;
  url: string;
  headline: string;
  description: string;
  reviewed: string;
  inLanguage: string;
  section: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: input.headline,
    description: input.description,
    url: input.url,
    mainEntityOfPage: input.url,
    inLanguage: input.inLanguage,
    articleSection: input.section,
    dateModified: input.reviewed,
    datePublished: input.reviewed,
    author: { "@type": "Organization", name: "getproperty", url: input.origin },
    publisher: {
      "@type": "Organization",
      name: "getproperty",
      logo: { "@type": "ImageObject", url: `${input.origin}/brand/getproperty-logo.png` },
    },
  };
}

/** A plain web page of a given type (AboutPage, ContactPage, CollectionPage, WebApplication…). */
export function webPageSchema(
  type: string,
  input: { url: string; name: string; description: string; inLanguage: string },
): JsonLd {
  return { "@context": "https://schema.org", "@type": type, ...input };
}
