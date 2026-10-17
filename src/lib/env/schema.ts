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

function serverSchema(production: boolean) {
  const host = (fallback: string) => (production ? hostValue : hostValue.default(fallback));
  return z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    OWNER_HOST: host(`${DEFAULT_HOSTS.owner}:3000`),
    STAFF_HOST: host(`${DEFAULT_HOSTS.staff}:3000`),
    ADMIN_HOST: host(`${DEFAULT_HOSTS.admin}:3000`),
    ZONES: zonesList,
    /** getproperty-api as this server reaches it (never exposed to the browser). */
    API_INTERNAL_URL: production ? urlValue : urlValue.default("http://localhost:4000"),
    /** Build-time only (`pnpm gen:api --adopt`); validated so a typo is caught where it is set. */
    API_CONTRACT_SOURCE: optionalString,
    /** `1` serves the API from MSW inside this server (`pnpm dev:mock`, the e2e suite). */
    API_MOCKS: z
      .enum(["0", "1", ""])
      .optional()
      .transform((value) => value === "1"),
    SENTRY_DSN: optionalUrl,
    SENTRY_ENVIRONMENT: optionalString,
    SENTRY_TRACES_SAMPLE_RATE: sampleRate,
    OTEL_EXPORTER_OTLP_ENDPOINT: optionalUrl,
    OTEL_SERVICE_NAME: z.string().trim().default("getproperty-web"),
    ...clientShape,
  });
}

/** The public half: compiled into the browser bundle, so it never holds a secret. */
const clientShape = {
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

export const clientEnvSchema = z.object(clientShape);

export type ServerEnv = z.output<ReturnType<typeof serverSchema>>;
export type ClientEnv = z.output<typeof clientEnvSchema>;

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
  const hosts = [parsed.OWNER_HOST, parsed.STAFF_HOST, parsed.ADMIN_HOST].map((h) => h.split(":")[0]);
  if (new Set(hosts).size !== hosts.length)
    issues.push("OWNER_HOST, STAFF_HOST and ADMIN_HOST must be different hosts");
  if (issues.length > 0) throw new EnvError(issues);
  return parsed;
}

export function parseClientEnv(env: Record<string, string | undefined>): ClientEnv {
  const result = clientEnvSchema.safeParse(env);
  if (!result.success) throw new EnvError(format(result.error));
  return result.data;
}
