import { createGuardBffHandler } from "@/lib/bff/guard";

/** The gate tablet's BFF (JW4): `/v1/guard/*` and the device / PIN session actions, guard cookies only. */
export const dynamic = "force-dynamic";

export const { GET, HEAD, POST, PUT, PATCH, DELETE } = createGuardBffHandler();
