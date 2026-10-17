import type { ContractEnum } from "@/lib/api/types";

import { defineStatuses } from "./define";

/**
 * Reading sources (D-012; `smart.reading_source` in schema-design v2). The tone says how much to trust
 * the number: an estimate needs attention and is reconciled later (D-041).
 */
export type ReadingSource = ContractEnum<"ReadingSource", "iot" | "ocr" | "manual" | "estimated">;

export const READING_SOURCE = defineStatuses<ReadingSource>("readingSource", {
  iot: { tone: "primary", icon: "gateway" },
  ocr: { tone: "info", icon: "camera" },
  manual: { tone: "neutral", icon: "edit" },
  estimated: { tone: "warning", icon: "help" },
});

export const READING_SOURCE_VALUES = Object.keys(READING_SOURCE) as ReadingSource[];
