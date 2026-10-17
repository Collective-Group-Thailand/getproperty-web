import "server-only";

import { serverEnv } from "@/lib/env/server";
import { publicPlansSchema, publicTariffSchema, type PublicPlan, type PublicTariff } from "@/lib/api/pending";

/*
 * CONTRACT-REQUEST — the public marketing data (`GET /v1/public/plans`, `GET /v1/public/utility-tariffs/current`)
 * is requested in docs/contract-requests.md. Fetched on the server only (no BFF: anonymous), cached for
 * an hour, and every failure (endpoint missing, API down) degrades to "not available" — the marketing
 * pages never show a price or a rate that did not come from the API (configurable values, CLAUDE.md).
 */
async function getJson(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(`${serverEnv().API_INTERNAL_URL}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function publicPlans(): Promise<PublicPlan[] | null> {
  const parsed = publicPlansSchema.safeParse(await getJson("/v1/public/plans"));
  return parsed.success ? parsed.data.data : null;
}

export async function publicElectricityTariffs(): Promise<Partial<Record<"mea" | "pea", PublicTariff>>> {
  const result: Partial<Record<"mea" | "pea", PublicTariff>> = {};
  await Promise.all(
    (["mea", "pea"] as const).map(async (provider) => {
      const parsed = publicTariffSchema.safeParse(
        await getJson(`/v1/public/utility-tariffs/current?utility=electric&provider=${provider}`),
      );
      if (parsed.success) result[provider] = parsed.data;
    }),
  );
  return result;
}
