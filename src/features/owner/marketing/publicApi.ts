import "server-only";

import type { Schemas } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";

import {
  listingQueryString,
  type ListingQuery,
  type PublicListingDetail,
  type PublicListingsPage,
} from "./listings/contract";

export type PublicPlan = Schemas["PublicPlanDto"];

/*
 * The public marketing data (`/v1/public/*`, D-180): anonymous, read on the server only (no BFF), cached
 * for five minutes like the API's own cache header. Every failure (API down, nothing published yet) degrades to "not available" — the marketing pages never show a price or a
 * rate that did not come from the API (configurable values, CLAUDE.md).
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

export async function publicPlans(): Promise<PublicPlan[] | null> {
  const body = await getJson<Schemas["PublicPlansDto"]>("/v1/public/plans");
  return Array.isArray(body?.data) ? body.data : null;
}

/*
 * Public listings (D-252, api B7.3) — CONTRACT-REQUEST until the API publishes `/v1/public/listings`. Like the plans,
 * a failure is "nothing to show", never an error page: the `/rent` page then shows its empty state.
 */
export async function publicListings(query: ListingQuery): Promise<PublicListingsPage | null> {
  const qs = listingQueryString(query);
  const body = await getJson<PublicListingsPage>(`/v1/public/listings${qs ? `?${qs}` : ""}`);
  return Array.isArray(body?.data) ? body : null;
}

export async function publicListing(slug: string): Promise<PublicListingDetail | null> {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null;
  const body = await getJson<PublicListingDetail>(`/v1/public/listings/${slug}`);
  return body && typeof body.slug === "string" ? body : null;
}

export async function publicListingSlugs(): Promise<{ slug: string; updatedAt: string }[]> {
  const body = await getJson<{ data: { slug: string; updatedAt: string }[] }>("/v1/public/listings/sitemap");
  return Array.isArray(body?.data) ? body.data : [];
}
