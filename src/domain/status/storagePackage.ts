import type { Schemas } from "@/lib/api/types";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconHistory } from "@/ui/icons/glyphs/history";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { defineStatuses } from "./define";

/** `StoragePackageState` (G1, D-285) — a bought storage package: waiting for its invoice, running, ended. */
export type StoragePackageState = Schemas["StoragePackageState"];

export const STORAGE_PACKAGE_STATUS = defineStatuses<StoragePackageState>("storagePackage", {
  pending_payment: { tone: "warning", icon: IconClock },
  active: { tone: "success", icon: IconCheckCircle },
  expired: { tone: "neutral", icon: IconHistory },
  cancelled: { tone: "neutral", icon: IconXCircle },
});
