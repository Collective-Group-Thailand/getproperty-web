import type { IconGlyph } from "@/ui/icons";

/**
 * Status presentation (design-system.md §2): every status the API returns maps to a tone, an icon and
 * a translation key, here and nowhere else. Never colour alone — `<StatusBadge>` renders icon + text.
 */
export type StatusTone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export interface StatusMeta {
  tone: StatusTone;
  icon: IconGlyph;
  /** Key under `status.<domain>.<value>` in `src/i18n/messages/<locale>/common/status.json`. */
  labelKey: string;
}

/** Builds a typed status map; `Value` is the contract enum (`ContractEnum<…>`), so coverage is checked by tsc. */
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
