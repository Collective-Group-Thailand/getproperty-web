import { parseServerEnv, type ServerEnv } from "./schema";

/**
 * The validated server environment. `src/instrumentation.ts` calls this at boot so a bad deployment
 * fails on start, listing every invalid variable, instead of on the first request that needs one.
 * Memoised per process; tests call `resetServerEnv()` after changing `process.env`.
 */
let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

export function resetServerEnv(): void {
  cached = undefined;
}

export type { ServerEnv };
