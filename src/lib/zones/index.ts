/**
 * Host → zone mapping (00-master-plan.md §2). F0 ships only what `src/proxy.ts` needs to render the
 * three placeholder shells on `*.localhost`; F1 1.1 adds the enabled-zones allow-list, the internal
 * path refusal, security headers and the per-zone CSP on top of this module.
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
 * Which zone a request's `Host` belongs to. An unknown host is `null`: in F0 the proxy serves it
 * as the owner zone so a preview URL still renders; F1 makes unknown hosts a 404.
 */
export function resolveZone(host: string | null | undefined, hosts: Record<Zone, string> = zoneHosts()): Zone | null {
  const name = hostname(host);
  for (const zone of ZONES) if (hosts[zone] === name) return zone;
  return null;
}
