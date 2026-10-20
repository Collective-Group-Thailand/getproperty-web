import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/**
 * The API's charge of a sample consumption at one tariff version in any state
 * (`GET /v1/admin/utility-tariffs/versions/{versionId}/charge?units=`, D-214) — what the checker compares with
 * the utility's notice before verifying and publishing. The console renders the `TariffChargeDto` and computes
 * nothing; a time-of-use structure is the API's 422.
 */
export function sampleCharge(api: ApiClient, versionId: string, units: string): Promise<Schemas["TariffChargeDto"]> {
  return unwrap(
    api.GET("/v1/admin/utility-tariffs/versions/{versionId}/charge", {
      params: { path: { versionId }, query: { units } },
    }),
  );
}
