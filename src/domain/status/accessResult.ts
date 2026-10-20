import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconUnlock } from "@/ui/icons/glyphs/unlock";

import { defineStatuses } from "./define";

/**
 * `AccessResult` — contract enum, smart.access_event (B5.2, D-025). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type AccessResult = Schemas["AccessResult"];

export const ACCESS_RESULT_STATUS = defineStatuses<AccessResult>("accessResult", {
  success: { tone: "success", icon: IconUnlock },
  denied: { tone: "warning", icon: IconLock },
  error: { tone: "danger", icon: IconAlert },
});

export const ACCESS_RESULT_VALUES = Object.keys(ACCESS_RESULT_STATUS) as AccessResult[];
