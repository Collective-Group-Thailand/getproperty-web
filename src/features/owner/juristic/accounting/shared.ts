import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/**
 * Reads several accounting pages share. Each answers an empty list when the API refuses (a member without the
 * permission sees the page's own state instead of an error for a picker).
 */
export async function chartOfAccounts(api: ApiClient): Promise<Schemas["AccountDto"][]> {
  return unwrap(api.GET("/v1/owner/juristic/accounts", { params: { query: {} } }))
    .then((list) => list.data)
    .catch(() => []);
}

/** Adopted resolutions (the only ones a fund movement may cite), as picker options. */
export async function adoptedResolutions(
  api: ApiClient,
  label: (resolution: Schemas["ResolutionDto"]) => string,
): Promise<{ id: string; buildingId: string; label: string }[]> {
  return unwrap(api.GET("/v1/owner/juristic/resolutions", { params: { query: { state: "adopted", perPage: 100 } } }))
    .then((list) => list.data.map((row) => ({ id: row.id, buildingId: row.buildingId, label: label(row) })))
    .catch(() => []);
}

/** Members of the office (names for approvers, requesters, custodians); empty when the member list is not readable. */
export async function officeMembers(api: ApiClient): Promise<Schemas["MemberDto"][]> {
  return unwrap(api.GET("/v1/owner/members", { params: { query: {} } })).catch(() => []);
}
