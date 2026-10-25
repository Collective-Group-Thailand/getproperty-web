import { BlockList, isIP } from "node:net";

import { z } from "zod";

import { DEFAULT_HOSTS, ZONES, type Zone } from "@/lib/zones";

/**
 * Every environment variable this app reads (F1 1.1), validated once at boot by
 * `src/instrumentation.ts`. Pure on purpose — no `process.env` here — so the unit test can feed it
 * any environment, and the proxy, the BFF and Server Components share one parsed view.
 *
 * Outside production the zone hosts and the API URL default to the local-dev values, so `pnpm dev`
 * needs no `.env`. In production every one of them is required: a deployment that silently answered
 * on `localhost` or talked to an API on `localhost:4000` would be worse than one that refuses to start.
 *
 * Not here on purpose (D-154): `TENANT_HOST` and `NEXT_PUBLIC_LIFF_ID` belong to `getproperty-liff`.
 *
 * **One image for every environment** (D-230): the platform promotes the image that passed UAT to production
 * without a rebuild (collective-infra `promote.yml`), so nothing environment-specific may be compiled in. The
 * `NEXT_PUBLIC_*` values keep their names (they are public by definition) but are read **at run time on the
 * server** — never as literal `process.env` member reads, which Next would inline at build time — and reach the
 * browser as props or as attributes of the root `<html>` (`ZoneDocument`). `runtime-env.test.ts` guards it.
 */

/** `host[:port]`, no scheme, no path — compared against the request's `Host` header. */
const hostValue = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9.-]+(:\d{1,5})?$/, "must be a host name with an optional port, without scheme or path");

const urlValue = z.url({ protocol: /^https?$/ }).transform((value) => value.replace(/\/+$/, ""));

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value === "" ? undefined : value))
  .optional();

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(urlValue.optional());

const zonesList = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx): readonly Zone[] => {
    if (!value) return ZONES;
    const parts = value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const unknown = parts.filter((part) => !(ZONES as readonly string[]).includes(part));
    if (unknown.length > 0 || parts.length === 0) {
      ctx.addIssue({
        code: "custom",
        message: `unknown zone(s) ${unknown.join(", ") || "(empty)"}; allowed: ${ZONES.join(", ")}`,
      });
      return z.NEVER;
    }
    return ZONES.filter((zone) => parts.includes(zone));
  });

const sampleRate = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number(value) : 0))
  .pipe(z.number().min(0).max(1));

/** Default `METRICS_ALLOWED_CIDRS` (the API's): loopback and the private ranges — the platform's docker network. */
export const PRIVATE_RANGES = "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,::1/128,fc00::/7";

/** `10.0.0.0/8, 203.0.113.7, 2001:db8::/32` → a `BlockList`; throws on an invalid entry (getproperty-api's parser). */
export function parseCidrList(value: string): BlockList {
  const list = new BlockList();
  for (const raw of value.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const [address = "", prefix] = entry.split("/");
    const family = isIP(address);
    if (family === 0) throw new Error(`invalid IP in CIDR list: ${entry}`);
    const type = family === 6 ? "ipv6" : "ipv4";
    if (prefix === undefined) {
      list.addAddress(address, type);
      continue;
    }
    const bits = Number(prefix);
    if (!/^\d+$/.test(prefix) || bits > (family === 6 ? 128 : 32))
      throw new Error(`invalid prefix in CIDR list: ${entry}`);
    list.addSubnet(address, bits, type);
  }
  return list;
}

/** True when `ip` (IPv4, IPv6 or IPv4-mapped IPv6) is inside the list. */
export function ipAllowed(list: BlockList, ip: string | undefined): boolean {
  if (!ip) return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped?.[1]) return list.check(mapped[1], "ipv4");
  const family = isIP(ip);
  if (family === 0) return false;
  return list.check(ip, family === 6 ? "ipv6" : "ipv4");
}

const cidrList = z
  .string()
  .trim()
  .optional()
  .transform((value, ctx): string => {
    const list = value || PRIVATE_RANGES;
    try {
      parseCidrList(list);
    } catch (error) {
      ctx.addIssue({ code: "custom", message: (error as Error).message });
      return z.NEVER;
    }
    return list;
  });

function serverSchema(production: boolean) {
  const host = (fallback: string) => (production ? hostValue : hostValue.default(fallback));
  return z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    OWNER_HOST: host(`${DEFAULT_HOSTS.owner}:3000`),
    STAFF_HOST: host(`${DEFAULT_HOSTS.staff}:3000`),
    ADMIN_HOST: host(`${DEFAULT_HOSTS.admin}:3000`),
    /**
     * The platform's public site (`getproperty.app`): serves only the owner marketing pages (`MARKETING_PATHS`) and
     * sends every other path to `OWNER_HOST` (308). Unset = the marketing pages live on the owner host, as before.
     */
    MARKETING_HOST: z
      .string()
      .trim()
      .transform((value) => (value === "" ? undefined : value))
      .pipe(hostValue.optional())
      .optional(),
    ZONES: zonesList,
    /** getproperty-api as this server reaches it (never exposed to the browser). */
    API_INTERNAL_URL: production ? urlValue : urlValue.default("http://localhost:4000"),
    /**
     * Proxies in front of this app that write `X-Forwarded-For` — on the Collective platform (D-230) Caddy alone =
     * 1 (the platform compose file sets it). The BFFs, Server Actions and Server Components send the API only the
     * entry this many from the right — the end-user address our own edge saw (review H1, api RUNBOOK §11, D-229).
     * 0 = none is forwarded (local dev); never more than the real number of hops, or a caller chooses its own
     * address.
     */
    TRUSTED_HOPS: z.coerce.number().int().min(0).max(5).default(0),
    /** Build-time only (`pnpm gen:api --adopt`); validated so a typo is caught where it is set. */
    API_CONTRACT_SOURCE: optionalString,
    SENTRY_DSN: optionalUrl,
    SENTRY_ENVIRONMENT: optionalString,
    SENTRY_TRACES_SAMPLE_RATE: sampleRate,
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    OTEL_SERVICE_NAME: z.string().trim().default("getproperty-web"),
    /**
     * Who may read `GET /api/metrics` (Prometheus), by client address — the API's rule and default (D-230): loopback
     * and the private ranges, i.e. Grafana Alloy scraping the container on the platform's docker network. Caddy also
     * answers 404 for the path on every public host.
     */
    METRICS_ALLOWED_CIDRS: cidrList,
    /**
     * Sign-in with Google, Apple and LINE on the owner console (D-255, D-283). `live` (production default): a provider
     * button shows only when its OAuth client is configured below; `fake` (default outside production, and for a UAT
     * against an API with `INTEGRATIONS_MODE=fake`): every button shows and opens a local test page instead of the
     * provider, which hands back the readable fake tokens getproperty-api's fake verifiers accept.
     */
    OAUTH_MODE: production ? z.enum(["live", "fake"]).default("live") : z.enum(["live", "fake"]).default("fake"),
    /** LINE Login channel of the web console (its id must also be in the API's `LINE_LOGIN_CHANNEL_IDS`). */
    LINE_LOGIN_CHANNEL_ID: optionalString,
    LINE_LOGIN_CHANNEL_SECRET: optionalString,
    /** Google OAuth web client; the Google id token is exchanged for a Firebase ID token (`FIREBASE_WEB_API_KEY`). */
    GOOGLE_OAUTH_CLIENT_ID: optionalString,
    GOOGLE_OAUTH_CLIENT_SECRET: optionalString,
    /** Sign in with Apple: the Services ID, team, key id and the `.p8` private key (PEM, `\n` allowed). */
    APPLE_SERVICES_ID: optionalString,
    APPLE_TEAM_ID: optionalString,
    APPLE_KEY_ID: optionalString,
    APPLE_PRIVATE_KEY: optionalString,
    /** Web API key of getproperty's Firebase project (the one `FIREBASE_PROJECT_ID` names in the API). */
    FIREBASE_WEB_API_KEY: optionalString,
    ...publicShape,
  });
}

/** The public half: read on the server at run time and handed to the browser, so it never holds a secret. */
const publicShape = {
  /** Object storage / CDN origin of signed file URLs (CSP `img-src`/`connect-src`). */
  NEXT_PUBLIC_ASSET_BASE_URL: optionalUrl,
  /** The LINE Official Account id (`@getproperty`) for the help link — a link only, no LINE SDK (D-154). */
  NEXT_PUBLIC_LINE_OA_ID: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(
      z
        .string()
        .regex(/^@[\w.-]+$/, "must look like @account")
        .optional(),
    ),
  /**
   * The resident / prospect LINE Mini App's LIFF id (getproperty-liff): a listing's "ask the owner" button opens
   * `https://liff.line.me/<id>/rent/<slug>` (enquiry + viewing booking, D-252); unset = the LINE OA chat link.
   */
  NEXT_PUBLIC_LIFF_ID: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined))
    .pipe(
      z
        .string()
        .regex(/^\d+-[A-Za-z0-9]+$/, "must look like 1234567890-AbCdEfGh")
        .optional(),
    ),
  /** VAPID application server key; when unset the staff PWA reads it from `/v1/auth/web-push/public-key`. */
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: optionalString,
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl,
  /** Environment badge text in every shell (`uat`, `staging`…); unset or `production` shows none. */
  NEXT_PUBLIC_ENV_BADGE: z
    .string()
    .trim()
    .max(16)
    .optional()
    .transform((value) => (value && value.toLowerCase() !== "production" ? value : undefined)),
};

export const publicEnvSchema = z.object(publicShape);

export type ServerEnv = z.output<ReturnType<typeof serverSchema>>;
export type PublicEnv = z.output<typeof publicEnvSchema>;

export class EnvError extends Error {
  constructor(readonly issues: string[]) {
    super(`Invalid environment:\n${issues.map((issue) => `  - ${issue}`).join("\n")}`);
    this.name = "EnvError";
  }
}

function format(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

/** Parses the server environment; throws one `EnvError` listing every problem. */
export function parseServerEnv(env: Record<string, string | undefined>): ServerEnv {
  const production = env.NODE_ENV === "production";
  const result = serverSchema(production).safeParse(env);
  if (!result.success) throw new EnvError(format(result.error));
  const parsed = result.data;
  const issues: string[] = [];
  const hosts = [parsed.OWNER_HOST, parsed.STAFF_HOST, parsed.ADMIN_HOST, parsed.MARKETING_HOST]
    .filter((h): h is string => h !== undefined)
    .map((h) => h.split(":")[0]);
  if (new Set(hosts).size !== hosts.length)
    issues.push("OWNER_HOST, STAFF_HOST, ADMIN_HOST and MARKETING_HOST must be different hosts");
  if (issues.length > 0) throw new EnvError(issues);
  return parsed;
}

export function parsePublicEnv(env: Record<string, string | undefined>): PublicEnv {
  const result = publicEnvSchema.safeParse(env);
  if (!result.success) throw new EnvError(format(result.error));
  return result.data;
}
