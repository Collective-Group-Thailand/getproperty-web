import { useTranslations } from "next-intl";

import type { StatusMeta } from "@/domain/status";
import { StatusBadge } from "@/ui/components/Badge";

/**
 * A status as a badge from one status map (`READING_STATUS`, `DEVICE_STATUS`…), importing only that
 * map's glyphs — the lean sibling of `DomainStatusBadge` (which carries every domain) for bundles with
 * a hard budget (staff PWA, D-179). Works in server and client components.
 */
export function StatusBadgeOf<Value extends string>({
  map,
  value,
  size,
}: {
  map: Readonly<Record<Value, StatusMeta>>;
  value: Value;
  size?: "sm" | "md";
}) {
  const t = useTranslations();
  const meta = map[value];
  if (!meta) return null;
  return <StatusBadge status={meta} label={t(meta.labelKey)} size={size} />;
}
