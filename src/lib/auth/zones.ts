import type { Zone } from "@/lib/zones";

/**
 * What each zone signs in as and where its `/me` lives (00-master-plan.md §4, contract §2/§4).
 * Owner and staff share the `operator` audience (separate hosts, separate cookies); admin is
 * `platform`. Resident and technician audiences are `getproperty-liff`'s (D-154).
 */
export const ZONE_AUDIENCE = { owner: "operator", staff: "operator", admin: "platform" } as const satisfies Record<
  Zone,
  "operator" | "platform"
>;

export const ZONE_ME_PATH = {
  owner: "/v1/owner/me",
  staff: "/v1/staff/me",
  admin: "/v1/admin/me",
} as const satisfies Record<Zone, string>;

/** Zones whose requests run in a tenant context (`__Host-gp_tenant` → `X-Tenant-Id`, contract §8). */
export function zoneHasTenant(zone: Zone): zone is "owner" | "staff" {
  return zone !== "admin";
}

/**
 * Upstream prefixes each zone's BFF forwards (ADR-0004). Anything else — notably `/v1/resident/*` and
 * `/v1/technician/*` (getproperty-liff's) and the token endpoints `/v1/auth/refresh|logout` (the
 * server calls those itself) — is refused.
 */
export const BFF_ALLOW_LIST = {
  owner: ["/v1/owner", "/v1/auth/operator"],
  staff: ["/v1/staff", "/v1/owner/me", "/v1/auth/operator"],
  admin: ["/v1/admin", "/v1/auth/platform"],
} as const satisfies Record<Zone, readonly string[]>;

/** Refused by every BFF of this app whatever the allow-list says (D-154). */
export const BFF_DENY_LIST = ["/v1/resident", "/v1/technician", "/v1/device"] as const;

export function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function isAllowedUpstream(zone: Zone, path: string): boolean {
  if (BFF_DENY_LIST.some((prefix) => matchesPrefix(path, prefix))) return false;
  return BFF_ALLOW_LIST[zone].some((prefix) => matchesPrefix(path, prefix));
}
