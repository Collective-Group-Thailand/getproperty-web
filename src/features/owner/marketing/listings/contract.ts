import type { Schemas } from "@/lib/api/types";

/*
 * The public listings read of D-252 (api B7.2) and the areas and owner pages of B7.9 (D-272, D-274): the shapes are
 * the API's DTOs. Money and sizes are decimal strings, as everywhere.
 */
export type ListingUnitKind = Schemas["PortfolioUnitKind"];
export type ListingFurnishing = Schemas["Furnishing"];
export type PublicListingPhoto = Schemas["PublicListingPhotoDto"];
export type PublicListingSummary = Schemas["PublicListingSummaryDto"];
export type PublicListingDetail = Schemas["PublicListingDetailDto"];
export type PublicListingsPage = Schemas["PublicListingsPageDto"];
/** A district or transit station with published listings (D-272, `GET /v1/public/listings/areas`). */
export type PublicListingArea = Schemas["PublicAreaDto"];
/** A verified owner's public page (D-274, `GET /v1/public/owners/{slug}`). */
export type PublicOwner = Schemas["PublicOwnerDto"];

export interface ListingQuery {
  q?: string;
  /** An area slug (D-272). */
  area?: string;
  kind?: ListingUnitKind;
  minRent?: string;
  maxRent?: string;
  bedrooms?: string;
  pets?: "1";
  sort?: "newest" | "rent_asc" | "rent_desc";
  cursor?: string;
}

const KINDS: ListingUnitKind[] = ["condo_unit", "house", "townhouse", "room"];
const SORTS = ["newest", "rent_asc", "rent_desc"] as const;
const digits = (value: unknown) => (typeof value === "string" && /^\d{1,7}$/.test(value) ? value : undefined);

/** Reads the page's search params into a query, dropping anything malformed instead of passing it on. */
export function parseListingQuery(params: Record<string, string | string[] | undefined>): ListingQuery {
  const one = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const q = one("q")?.trim().slice(0, 80);
  const kind = one("kind");
  const sort = one("sort");
  const bedrooms = one("bedrooms");
  return {
    q: q || undefined,
    kind: KINDS.includes(kind as ListingUnitKind) ? (kind as ListingUnitKind) : undefined,
    minRent: digits(one("minRent")),
    maxRent: digits(one("maxRent")),
    bedrooms: bedrooms && /^[0-4]$/.test(bedrooms) ? bedrooms : undefined,
    pets: one("pets") === "1" ? "1" : undefined,
    sort: SORTS.includes(sort as (typeof SORTS)[number]) ? (sort as ListingQuery["sort"]) : undefined,
    cursor: one("cursor")?.slice(0, 200) || undefined,
  };
}

export function listingQueryString(query: ListingQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
  return params.toString();
}
