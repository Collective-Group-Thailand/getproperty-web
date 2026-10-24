import type { Locale } from "@/i18n/routing";

import { GUIDES_EN } from "./content.en";
import { GUIDES_TH } from "./content.th";
import type { Guide } from "./types";

export type { Guide, GuideBlock, GuideCategory } from "./types";

const BY_LOCALE: Record<Locale, Guide[]> = { th: GUIDES_TH, en: GUIDES_EN };

/** Every guide slug (the same in both languages), for the sitemap, `generateStaticParams` and the zone check. */
export const GUIDE_SLUGS: readonly string[] = GUIDES_TH.map((guide) => guide.slug);

export function guidesFor(locale: Locale): Guide[] {
  return BY_LOCALE[locale];
}

export function guideBySlug(locale: Locale, slug: string): Guide | null {
  return BY_LOCALE[locale].find((guide) => guide.slug === slug) ?? null;
}
