import type { Schemas } from "./types";

export type SearchResult = Schemas["SearchHitDto"];

/** Every hit type of the contract — a new `SearchHitType` fails the build here until it is linked. */
const KNOWN_TYPES: Record<Schemas["SearchHitType"], true> = {
  building: true,
  unit: true,
  party: true,
  lease: true,
  device: true,
  invoice: true,
};
const SEARCH_TYPES: ReadonlySet<string> = new Set(Object.keys(KNOWN_TYPES));

/**
 * `GET /v1/owner/search` (D-180) checked without a schema library (the owner console's bundle stays
 * lean): a hit of a type this build does not know yet is dropped rather than linked nowhere.
 */
export function parseSearchResults(value: unknown): SearchResult[] {
  const data = (value as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  return data.filter(
    (hit): hit is SearchResult =>
      typeof hit === "object" &&
      hit !== null &&
      SEARCH_TYPES.has((hit as SearchResult).type) &&
      typeof (hit as SearchResult).id === "string" &&
      typeof (hit as SearchResult).label === "string" &&
      ((hit as SearchResult).sublabel === null || typeof (hit as SearchResult).sublabel === "string"),
  );
}
