import "server-only";

import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";

import type { Guide, GuideSection } from "./types";

export type { Guide, GuideBlock, GuideCategory } from "./types";

/** A guide on the index and in related lists (no body). */
export type GuideSummary = Schemas["GuideSummaryDto"];

/*
 * Guides (D-271) come from getproperty-api since B7.13 (`/v1/public/guides`, edited and published in admin › Guides).
 * Cached for five minutes like the other public reads; when the API is down there are simply no guides to show.
 */
async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${serverEnv().API_INTERNAL_URL}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

/** The published guides of a locale, newest first. */
export async function guidesFor(locale: Locale): Promise<GuideSummary[]> {
  const body = await getJson<Schemas["PublicGuidesDto"]>(`/v1/public/guides?locale=${locale}`);
  return Array.isArray(body?.data) ? body.data : [];
}

/** Every published guide slug (Thai is the default language), for the sitemap and static params. */
export async function guideSlugs(): Promise<string[]> {
  return (await guidesFor("th")).map((guide) => guide.slug);
}

/** One published guide with its body; null when unknown, unpublished or the API is down. */
export async function guideBySlug(locale: Locale, slug: string): Promise<Guide | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const body = await getJson<Schemas["GuideDetailDto"]>(`/v1/public/guides/${slug}?locale=${locale}`);
  if (!body || typeof body.slug !== "string") return null;
  return { ...body, sections: body.sections as unknown as GuideSection[] };
}
