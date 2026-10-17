import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `TenantStatus` — contract enum. A value the contract adds fails the build here until it has a tone, an icon and a label. */
export type TenantStatus = Schemas["TenantStatus"];

export const TENANT_STATUS = defineStatuses<TenantStatus>("tenant", {
  active: { tone: "success", icon: IconCheckCircle },
  read_only: { tone: "warning", icon: IconLock },
  deactivated: { tone: "neutral", icon: IconXCircle },
});

export const TENANT_VALUES = Object.keys(TENANT_STATUS) as TenantStatus[];
