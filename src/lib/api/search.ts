import type { SearchResult } from "./pending";

/*
 * CONTRACT-REQUEST — `GET /v1/owner/search` (docs/contract-requests.md). Type-only import of the
 * requested shape, so the browser bundle carries no schema library.
 */
const SEARCH_TYPES = new Set(["building", "unit", "party", "lease", "invoice"]);

/**
 * The search response checked without a schema library (the owner console's bundle stays lean):
 * anything not matching the requested shape is dropped.
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
