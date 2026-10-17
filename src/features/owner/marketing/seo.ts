import type { Metadata } from "next";

import { serverEnv } from "@/lib/env/server";
import type { MarketingPath } from "@/lib/zones/marketing";
import { getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/** The owner host's public origin, for canonical URLs, hreflang and the sitemap. */
export function ownerOrigin(): string {
  const host = serverEnv().OWNER_HOST;
  // Public hosts are HTTPS; only a loopback host (local runs, the e2e suite) is plain HTTP.
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

/** Indexable metadata of a marketing page: canonical, th/en alternates, Open Graph. */
export function marketingMetadata(
  path: MarketingPath,
  locale: Locale,
  { title, description }: { title: string; description: string },
): Metadata {
  const origin = ownerOrigin();
  const url = (lang: Locale) => `${origin}${getPathname({ href: path, locale: lang })}`;
  return {
    title: { absolute: title },
    description,
    robots: { index: true, follow: true },
    alternates: {
      canonical: url(locale),
      languages: Object.fromEntries([...routing.locales.map((lang) => [lang, url(lang)]), ["x-default", url("th")]]),
    },
    openGraph: {
      title,
      description,
      url: url(locale),
      siteName: "getproperty",
      locale: locale === "th" ? "th_TH" : "en_US",
      type: "website",
    },
  };
}

/** Organization JSON-LD (schema.org) for the landing page. */
export function organizationJsonLd(description: string): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "getproperty",
    legalName: "Collective Group (Thailand)",
    url: ownerOrigin(),
    logo: `${ownerOrigin()}/brand/wordmark.svg`,
    description,
  }).replace(/</g, "\\u003c");
}
