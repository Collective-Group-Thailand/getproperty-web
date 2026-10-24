import "server-only";

import type { Schemas } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";

export type PublicPlan = Schemas["PublicPlanDto"];

/*
 * The public marketing data (`/v1/public/*`, D-180): anonymous, read on the server only (no BFF), cached
 * for five minutes like the API's own cache header. Every failure (API down, nothing published yet) degrades to "not available" — the marketing pages never show a price or a
 * rate that did not come from the API (configurable values, CLAUDE.md).
 */
async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${serverEnv().API_INTERNAL_URL}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function publicPlans(): Promise<PublicPlan[] | null> {
  const body = await getJson<Schemas["PublicPlansDto"]>("/v1/public/plans");
  return Array.isArray(body?.data) ? body.data : null;
}
