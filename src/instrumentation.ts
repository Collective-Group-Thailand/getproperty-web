/**
 * Runs once when a server process starts (Next instrumentation hook, F1 1.1). It validates the
 * environment first — an invalid deployment exits here listing every bad variable — then wires the
 * server-side observability and, for `pnpm dev:mock` / the e2e suite only, the mock API.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { serverEnv } = await import("@/lib/env/server");
  serverEnv();
}
