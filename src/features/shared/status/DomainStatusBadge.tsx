"use client";

import { useTranslations } from "next-intl";

import { STATUS_MAPS, type StatusDomain } from "@/domain/status";
import { StatusBadge } from "@/ui/components/Badge";

type ValueOf<D extends StatusDomain> = keyof (typeof STATUS_MAPS)[D] & string;

/**
 * A status from the API as a badge: tone, icon and label all from `src/domain/status` (CLAUDE.md) —
 * screens never pick a colour for a status themselves.
 */
export function DomainStatusBadge<D extends StatusDomain>({
  domain,
  value,
  size,
}: {
  domain: D;
  value: ValueOf<D>;
  size?: "sm" | "md";
}) {
  const t = useTranslations();
  const meta = (STATUS_MAPS[domain] as Record<string, (typeof STATUS_MAPS)[D][keyof (typeof STATUS_MAPS)[D]]>)[value];
  if (!meta) return null;
  const status = meta as unknown as Parameters<typeof StatusBadge>[0]["status"];
  return <StatusBadge status={status} label={t(status.labelKey)} size={size} />;
}
