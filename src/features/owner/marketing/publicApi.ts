import "server-only";

import type { Schemas } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";

import {
  listingQueryString,
  type ListingQuery,
  type PublicListingArea,
  type PublicListingDetail,
  type PublicListingsPage,
  type PublicOwner,
} from "./listings/contract";

export type PublicPlan = Schemas["PublicPlanDto"];

/*
 * The public marketing data (`/v1/public/*`, D-180): anonymous, read on the server only (no BFF), cached
 * for five minutes like the API's own cache header. Every failure (API down, nothing published yet) degrades to "not available" — the marketing pages never show a price or a
 * rate that did not come from the API (configurable values, CLAUDE.md).
 */
async function getJson<T>(path: string, language?: string): Promise<T | null> {
  try {
    const response = await fetch(`${serverEnv().API_INTERNAL_URL}${path}`, {
      headers: { accept: "application/json", ...(language ? { "accept-language": language } : {}) },
      next: { revalidate: 300 },
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function publicPlans(): Promise<PublicPlan[] | null> {
  const body = await getJson<Schemas["PublicPlansDto"]>("/v1/public/plans");
  return Array.isArray(body?.data) ? body.data : null;
}

/*
 * Public listings (D-252, api `13a2562`). Like the plans, a failure is "nothing to show", never an error page: the
 * `/rent` page then shows its empty state. The page language picks the owner's English title when there is one.
 */
export async function publicListings(query: ListingQuery, language?: string): Promise<PublicListingsPage | null> {
  const qs = listingQueryString(query);
  const body = await getJson<PublicListingsPage>(`/v1/public/listings${qs ? `?${qs}` : ""}`, language);
  return Array.isArray(body?.data) ? body : null;
}

export async function publicListing(slug: string, language?: string): Promise<PublicListingDetail | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const body = await getJson<PublicListingDetail>(`/v1/public/listings/${slug}`, language);
  return body && typeof body.slug === "string" ? body : null;
}

export async function publicListingSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const body = await getJson<{ data: { slug: string; updatedAt: string }[] }>("/v1/public/listings/sitemap");
  return Array.isArray(body?.data) ? body.data : [];
}

/** Areas and stations with published listings (D-272); empty when the API is down. */
export async function publicListingAreas(): Promise<PublicListingArea[]> {
  const body = await getJson<{ data: PublicListingArea[] }>("/v1/public/listings/areas");
  return Array.isArray(body?.data) ? body.data : [];
}

/** A verified owner's public page (D-274); null when it is not open (not verified, switched off) or the API is down. */
export async function publicOwner(slug: string, language?: string): Promise<PublicOwner | null> {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const body = await getJson<PublicOwner>(`/v1/public/owners/${slug}`, language);
  return body && typeof body.slug === "string" ? body : null;
}
