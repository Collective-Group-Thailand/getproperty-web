/*
 * CONTRACT-REQUEST (docs/contract-requests.md, 2026-10-24): the public listings read of D-252 / api B7.3 is not in the
 * contract yet. These shapes are the request we sent; when `pnpm gen:api` adopts the API's DTOs, replace every type
 * here with `Schemas["PublicListing…"]` and delete this file. Money and sizes are decimal strings, as everywhere.
 */
export type ListingUnitKind = "condo_unit" | "house" | "townhouse" | "room";
export type ListingFurnishing = "furnished" | "partly_furnished" | "unfurnished";

export interface PublicListingPhoto {
  url: string;
  width: number;
  height: number;
  caption: string | null;
}

export interface PublicListingSummary {
  slug: string;
  title: string;
  unitKind: ListingUnitKind;
  /** THB per month, decimal string. */
  rent: string;
  depositMonths: number;
  advanceMonths: number;
  minTermMonths: number;
  sizeSqm: string;
  bedrooms: number;
  bathrooms: number;
  furnishing: ListingFurnishing;
  petsAllowed: boolean;
  availableFrom: string | null;
  province: string;
  district: string;
  /** Full address (D-252: nothing hidden); the unit number only when the owner chose to show it. */
  address: string;
  nearestTransit: { name: string; line: string; distanceM: number } | null;
  cover: PublicListingPhoto;
  verifiedOwner: boolean;
  publishedAt: string;
}

export interface PublicListingDetail extends PublicListingSummary {
  description: string;
  facilities: string[];
  photos: PublicListingPhoto[];
  floor: string | null;
  geo: { lat: number; lng: number } | null;
  ownerDisplayName: string;
  smokingAllowed: boolean;
}

export interface PublicListingsPage {
  data: PublicListingSummary[];
  total: number;
  nextCursor: string | null;
}

/** The search the `/rent` page sends, from its URL (every filter is a plain GET parameter, so the page needs no JS). */
export interface ListingQuery {
  q?: string;
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
