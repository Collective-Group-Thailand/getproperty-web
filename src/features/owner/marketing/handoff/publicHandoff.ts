import "server-only";

import { plausibleHandoffToken } from "@/features/shared/growth/handoff";
import type { Schemas } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";
import { inboundEdgeHeaders } from "@/lib/http/server";

export type PublicHandoff = Schemas["PublicHandoffDto"];

/**
 * A getbuild rental invitation (G8, D-299) by its single-use token. Never cached — a claimed, declined or expired
 * invitation must show its new state at once; null when the token is unknown or the API is down.
 */
export async function publicHandoff(token: string): Promise<PublicHandoff | null> {
  if (!plausibleHandoffToken(token)) return null;
  try {
    const response = await fetch(`${serverEnv().API_INTERNAL_URL}/v1/public/handoffs/${encodeURIComponent(token)}`, {
      headers: { accept: "application/json", ...(await inboundEdgeHeaders()) },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const body = (await response.json()) as PublicHandoff;
    return typeof body.state === "string" ? body : null;
  } catch {
    return null;
  }
}
