import "server-only";

import { headers } from "next/headers";

import { serverEnv } from "@/lib/env/server";

import { clientIpFrom, FORWARDED_FOR_HEADER } from "./edge";

/**
 * The end-user address for API calls made while rendering a Server Component or running a Server Action
 * (review H1): the `X-Forwarded-For` entry `TRUSTED_HOPS` from the right of the inbound request, sent as the only
 * value. Every call keeps its own fresh `X-Request-Id` (the API client adds it). Outside a request (build,
 * instrumentation), or with `TRUSTED_HOPS=0`, nothing is forwarded.
 */
export async function inboundEdgeHeaders(): Promise<Record<string, string>> {
  let inbound: Awaited<ReturnType<typeof headers>>;
  try {
    inbound = await headers();
  } catch {
    return {};
  }
  const clientIp = clientIpFrom(inbound, serverEnv().TRUSTED_HOPS);
  return clientIp ? { [FORWARDED_FOR_HEADER]: clientIp } : {};
}
