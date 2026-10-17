import { parseClientEnv, type ClientEnv } from "./schema";

/**
 * The public environment, readable in the browser. Each variable is named in full so Next inlines it
 * at build time (`process.env[name]` would not be replaced). Parsed lazily: a malformed public value
 * fails the page that reads it, and `src/instrumentation.ts` has already refused to boot with it.
 */
let cached: ClientEnv | undefined;

export function clientEnv(): ClientEnv {
  cached ??= parseClientEnv({
    NEXT_PUBLIC_ASSET_BASE_URL: process.env.NEXT_PUBLIC_ASSET_BASE_URL,
    NEXT_PUBLIC_LINE_OA_ID: process.env.NEXT_PUBLIC_LINE_OA_ID,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_ENV_BADGE: process.env.NEXT_PUBLIC_ENV_BADGE,
  });
  return cached;
}

export type { ClientEnv };
