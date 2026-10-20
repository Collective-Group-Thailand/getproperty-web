import type { Schemas } from "@/lib/api/types";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconChevronDown } from "@/ui/icons/glyphs/chevron-down";
import { IconChevronUp } from "@/ui/icons/glyphs/chevron-up";
import { IconDot } from "@/ui/icons/glyphs/dot";

import { defineStatuses } from "./define";

/**
 * `ServicePriority` — contract enum, ops.service_request.priority (B5.1, D-072). A value the contract adds fails the build here until it has a
 * tone, an icon and a label.
 */
export type ServicePriority = Schemas["ServicePriority"];

export const PRIORITY_STATUS = defineStatuses<ServicePriority>("priority", {
  low: { tone: "neutral", icon: IconChevronDown },
  normal: { tone: "info", icon: IconDot },
  high: { tone: "warning", icon: IconChevronUp },
  urgent: { tone: "danger", icon: IconAlert },
});

export const PRIORITY_VALUES = Object.keys(PRIORITY_STATUS) as ServicePriority[];
