"use client";

import { useTranslations } from "next-intl";

import { READING_SOURCE, type ReadingSource } from "@/domain/status";
import { StatusBadge } from "@/ui/components/Badge";

/** Where a meter reading came from (D-012): smart meter, photo (OCR), typed in, or estimated. */
export function ReadingSourceBadge({ source, size = "sm" }: { source: ReadingSource; size?: "sm" | "md" }) {
  const t = useTranslations();
  const meta = READING_SOURCE[source];
  return <StatusBadge status={meta} label={t(meta.labelKey)} size={size} />;
}
