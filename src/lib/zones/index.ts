/**
 * Host → zone mapping (00-master-plan.md §2, ADR-0004): which zone a `Host` belongs to, which zones a
 * deployment answers for (`ZONES`), and which paths are never reachable from outside (another zone's
 * internal segment, the retired resident segments). `src/proxy.ts` applies it; the security headers
 * and CSP are `src/lib/security`.
 *
 * Three zones since D-154: the resident LINE Mini App lives in its own repository
 * (`getproperty-liff`), so there is no resident/"tenant" host here. In the platform's naming (D-151)
 * a *tenant* is the SaaS customer organisation, not a zone.
 *
 * Framework-free on purpose: the proxy runs on the edge runtime and the unit test runs in Node.
 */

export const ZONES = ["owner", "staff", "admin"] as const;
export type Zone = (typeof ZONES)[number];

export function isZone(value: unknown): value is Zone {
  return typeof value === "string" && (ZONES as readonly string[]).includes(value);
}

/** The env variable each zone's host comes from, and its local-dev default. */
export const ZONE_HOST_ENV = {
  owner: "OWNER_HOST",
  staff: "STAFF_HOST",
  admin: "ADMIN_HOST",
} as const satisfies Record<Zone, string>;

export const DEFAULT_HOSTS = {
  owner: "localhost",
  staff: "staff.localhost",
  admin: "admin.localhost",
} as const satisfies Record<Zone, string>;

/**
 * The internal route segment a zone's pages live under. The owner zone is the app root (its
 * `[locale]` segment is next-intl's); the other two are prefixed and never reachable by URL from
 * outside — the proxy rewrites onto them and (F1) 404s a direct request.
 */
export const ZONE_SEGMENT = {
  owner: "",
  staff: "/staff",
  admin: "/admin",
} as const satisfies Record<Zone, string>;

/** Header the proxy stamps so Server Components and `src/i18n/request.ts` know the zone. */
export const ZONE_HEADER = "x-gp-zone";

/** `Host` values are compared without the port, so `:3000`, `:3100` and `:3200` all match. */
export function hostname(host: string | null | undefined): string {
  return (host ?? "").split(":")[0]!.toLowerCase();
}

/** Reads the three hosts from the environment, falling back to the local-dev defaults. */
export function zoneHosts(env: Record<string, string | undefined> = process.env): Record<Zone, string> {
  return Object.fromEntries(
    ZONES.map((zone) => [zone, hostname(env[ZONE_HOST_ENV[zone]] || DEFAULT_HOSTS[zone])]),
  ) as Record<Zone, string>;
}

/**
 * The public origin of a host (`host[:port]`): HTTPS, except a loopback host (local runs, the e2e suite), which is
 * plain HTTP.
 */
export function publicOrigin(host: string): string {
  const local = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

/** Which zone a request's `Host` belongs to; an unknown host is `null` (the proxy answers 404). */
export function resolveZone(host: string | null | undefined, hosts: Record<Zone, string> = zoneHosts()): Zone | null {
  const name = hostname(host);
  for (const zone of ZONES) if (hosts[zone] === name) return zone;
  return null;
}

/**
 * First path segments no external URL may start with, on any host: the internal segments of the
 * staff and admin zones (the proxy rewrites *onto* them; a direct `/staff/x` on the owner host is
 * another zone's page) and the retired resident segments (D-154 — the resident app is
 * `getproperty-liff`).
 */
export const RESERVED_SEGMENTS = ["staff", "admin", "tenant", "resident"] as const;

export function isReservedPath(pathname: string): boolean {
  const first = pathname.split("/")[1]?.toLowerCase() ?? "";
  // `%2F`-style tricks never reach here decoded, but a trailing dot or encoded segment must not slip by.
  const decoded = safeDecode(first).replace(/\.+$/, "");
  return (RESERVED_SEGMENTS as readonly string[]).includes(decoded);
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** The zones this deployment answers for (`ZONES`, already parsed by `src/lib/env`). */
export function isZoneEnabled(zone: Zone, enabled: readonly Zone[]): boolean {
  return enabled.includes(zone);
}
