"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconUndo } from "@/ui/icons/glyphs/undo";

/**
 * Disputes an invoiced success / co-broke fee (G5, D-297 (5)): Finance asks for a platform credit note for what the
 * fee was charged incl. VAT (never above the unpaid part) — the maker step; another platform user approves or rejects
 * it on the invoice (D-091). Reason required; Idempotency-Key per opening.
 */
export function FeeDispute({
  accrualId,
  tenant,
  unit,
  amount,
  invoice,
}: {
  accrualId: string;
  tenant: string;
  unit: string;
  /** Formatted fee before VAT. */
  amount: string;
  invoice: string;
}) {
  const t = useTranslations("admin.growth.fees");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("dispute")}
      icon={IconUndo}
      size="sm"
      variant="secondary"
      testId="fee-dispute"
      title={t("disputeTitle", { tenant, unit })}
      description={t("disputeBody", { amount, invoice })}
      confirmLabel={t("disputeConfirm")}
      successMessage={t("disputed")}
      ready={reason.trim().length > 0}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/admin/fee-accruals/{accrualId}/actions/dispute", {
            params: { path: { accrualId }, header: { "Idempotency-Key": idempotencyKey } },
            body: { reason: reason.trim() },
          }),
        )
      }
    >
      <Field label={t("reason")} hint={t("reasonHint")} required>
        <Textarea
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          data-testid="fee-dispute-reason"
        />
      </Field>
    </ConfirmAction>
  );
}
