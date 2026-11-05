"use client";

import { useTranslations } from "next-intl";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";

import { ExportButton } from "../../shared/ExportButton";

/**
 * The receivables list as CSV (J1.2b): the same tab, search and sort, built by the export worker
 * (`juristic_receivables_csv`, UTF-8 with BOM) and downloaded through the BFF once done.
 */
export function ReceivablesExport({ params }: { params: Schemas["ReceivablesExportDto"] }) {
  const t = useTranslations("owner.collections.receivables");
  return (
    <ExportButton
      kind="juristic_receivables_csv"
      params={{}}
      label={t("export")}
      testId="receivables-export"
      create={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/receivables/exports", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: params,
          }),
        )
      }
    />
  );
}
