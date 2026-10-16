import type { IconName } from "@/ui/icons/registry";

/**
 * Status presentation (design-system.md §2): every status the API returns maps to a tone, an icon and
 * a translation key, here and nowhere else. Never colour alone — `<StatusBadge>` renders icon + text.
 *
 * F0 ships the generic shape and one worked example. F1 types each map to the generated contract
 * enums (`Record<Schemas["BillStatus"], StatusMeta>` …), so a new backend enum value fails the build
 * until it has a label, tone and icon (00-master-plan.md §5).
 */

export type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export interface StatusMeta {
  tone: StatusTone;
  icon: IconName;
  /** Key under `status.<domain>.<value>` in `src/i18n/messages`. */
  labelKey: string;
}

/** Builds a typed status map; the generic parameter is the contract enum in F1. */
export function defineStatuses<Value extends string>(
  domain: string,
  entries: Record<Value, Omit<StatusMeta, "labelKey">>,
): Record<Value, StatusMeta> {
  return Object.fromEntries(
    (Object.entries(entries) as [Value, Omit<StatusMeta, "labelKey">][]).map(([value, meta]) => [
      value,
      { ...meta, labelKey: `status.${domain}.${value}` },
    ]),
  ) as Record<Value, StatusMeta>;
}

/**
 * Reading sources (D-012) — the one enum the decisions already fix, so it can be typed now. The
 * tone says how much to trust the number: an estimate needs attention and is reconciled later (D-041).
 */
export type ReadingSource = "iot" | "ocr" | "manual" | "estimated";

export const READING_SOURCE = defineStatuses<ReadingSource>("readingSource", {
  iot: { tone: "primary", icon: "gateway" },
  ocr: { tone: "info", icon: "camera" },
  manual: { tone: "neutral", icon: "edit" },
  estimated: { tone: "warning", icon: "help" },
});
