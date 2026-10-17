import type { ContractEnum } from "@/lib/api/types";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconGateway } from "@/ui/icons/glyphs/gateway";
import { IconHelp } from "@/ui/icons/glyphs/help";

import { defineStatuses } from "./define";

/**
 * Reading sources (D-012; `smart.reading_source` in schema-design v2). The tone says how much to trust
 * the number: an estimate needs attention and is reconciled later (D-041).
 */
export type ReadingSource = ContractEnum<"ReadingSource", "iot" | "ocr" | "manual" | "estimated">;

export const READING_SOURCE = defineStatuses<ReadingSource>("readingSource", {
  iot: { tone: "primary", icon: IconGateway },
  ocr: { tone: "info", icon: IconCamera },
  manual: { tone: "neutral", icon: IconEdit },
  estimated: { tone: "warning", icon: IconHelp },
});

export const READING_SOURCE_VALUES = Object.keys(READING_SOURCE) as ReadingSource[];
