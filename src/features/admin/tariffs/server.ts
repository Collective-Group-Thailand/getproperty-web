import "server-only";

import { unwrap, type ApiClient } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

/**
 * CONTRACT-REQUEST: `GET /v1/admin/utility-tariffs/versions/{versionId}/charge?units=` — the API's own
 * charge of a sample consumption at a tariff version that is not in force yet (docs/contract-requests.md).
 * The owner surface has it for versions in force (`GET /v1/owner/utility-tariffs/current?units=`); the
 * admin needs it for the version being checked, before publishing. Same client, headers and error
 * mapping as every call; only the path is not typed until the contract publishes it. The answer is the
 * contract's `TariffChargeDto` — the console renders it and computes nothing.
 */
export function sampleCharge(api: ApiClient, versionId: string, units: string): Promise<Schemas["TariffChargeDto"]> {
  const path = `/v1/admin/utility-tariffs/versions/${encodeURIComponent(versionId)}/charge`;
  return unwrap(api.GET(path as never, { params: { query: { units } } } as never)) as Promise<
    Schemas["TariffChargeDto"]
  >;
}
