"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { toast } from "@/ui/components/Toast";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

import { ExportButton } from "../../shared/ExportButton";

type Format = Schemas["JuristicJournalExportFormat"];
const FORMATS: readonly Format[] = ["csv", "express", "flowaccount"];
const KIND: Record<Format, Schemas["ExportKind"]> = {
  csv: "juristic_journal_csv",
  express: "juristic_journal_express",
  flowaccount: "juristic_journal_flowaccount",
};

/**
 * The journals of the statement's range for the accountant's own software (J2.1 §6): plain CSV, or the Express /
 * FlowAccount import layouts the API keeps as data (unverified against the live import screens, O-043 — said in the
 * option's hint). Built by the export worker and downloaded through the BFF, like every export.
 */
export function LedgerExport({ from, to, buildingId }: { from: string; to: string; buildingId: string | null }) {
  const t = useTranslations("owner.accounting.export");
  const [format, setFormat] = useState<Format>("csv");
  return (
    <div className="flex items-center gap-2" data-testid="ledger-export">
      <NativeSelect
        aria-label={t("format")}
        inputSize="md"
        value={format}
        onChange={(event) => setFormat(event.target.value as Format)}
        options={FORMATS.map((value) => ({ value, label: t(`formats.${value}`) }))}
        className="w-44"
        data-testid="ledger-export-format"
      />
      <ExportButton
        key={format}
        kind={KIND[format]}
        params={{}}
        label={t("button")}
        testId="ledger-export-button"
        create={(idempotencyKey) =>
          unwrap(
            browserApi().POST("/v1/owner/juristic/ledger/exports", {
              params: { header: { "Idempotency-Key": idempotencyKey } },
              body: { format, from, to, ...(buildingId ? { buildingId } : {}) },
            }),
          )
        }
      />
    </div>
  );
}

/**
 * Posts what the ledger has not posted yet (J2.1 §2: invoices, notes, payments and refunds without a journal) and
 * recognises the revenue months that are due — the hourly job's work, on demand. Idempotent: running it twice posts
 * nothing the second time.
 */
export function BackPostButton({ size = "md" }: { size?: "sm" | "md" }) {
  const t = useTranslations("owner.accounting.backPost");
  return (
    <ConfirmAction
      label={t("button")}
      icon={IconRefresh}
      variant="secondary"
      size={size}
      testId="ledger-back-post"
      title={t("title")}
      description={t("body")}
      confirmLabel={t("confirm")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic/ledger/actions/back-post", {
            params: { header: { "Idempotency-Key": key } },
          }),
        )
      }
      onDone={(result) => {
        const answer = result as Schemas["BackPostResultDto"];
        toast.success(
          answer.posted + answer.recognised === 0
            ? t("nothing")
            : t("done", { posted: answer.posted, recognised: answer.recognised }),
        );
      }}
    />
  );
}
