import "server-only";

import type { Schemas } from "@/lib/api/types";
import { serverEnv } from "@/lib/env/server";

export type PublicPlan = Schemas["PublicPlanDto"];
export type PublicTariff = Schemas["PublicTariffDto"];

/*
 * The public marketing data (`/v1/public/*`, D-180): anonymous, read on the server only (no BFF), cached
 * for five minutes like the API's own cache header. Every failure (API down, `tariff.not_found` while
 * nothing is published) degrades to "not available" — the marketing pages never show a price or a
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

export async function publicElectricityTariffs(): Promise<Partial<Record<"mea" | "pea", PublicTariff>>> {
  const result: Partial<Record<"mea" | "pea", PublicTariff>> = {};
  await Promise.all(
    (["mea", "pea"] as const).map(async (provider) => {
      const tariff = await getJson<PublicTariff>(
        `/v1/public/utility-tariffs/current?utility=electric&provider=${provider}`,
      );
      if (tariff && typeof tariff.ceilingPerUnit === "string") result[provider] = tariff;
    }),
  );
  return result;
}
