"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconUndo } from "@/ui/icons/glyphs/undo";

import { ConfirmAction } from "../shared/ConfirmAction";

/**
 * Reverse a confirmed payment (a bounced transfer, money recorded on the wrong invoice): typed
 * confirmation with the amount, a reason, one Idempotency-Key. The API reopens the invoices and voids
 * the receipts; only when `nextActions` offers it.
 */
export function ReversePayment({
  payment,
  amountLabel,
}: {
  payment: Pick<Schemas["PaymentDto"], "id" | "nextActions" | "unitNo">;
  amountLabel: string;
}) {
  const t = useTranslations("owner.payments.reverse");
  const [reason, setReason] = useState("");
  if (!payment.nextActions.includes("reverse")) return null;
  return (
    <ConfirmAction
      label={t("button")}
      icon={IconUndo}
      variant="destructive"
      tone="destructive"
      testId="payment-reverse"
      title={t("title")}
      description={t("body", { amount: amountLabel, unit: payment.unitNo ?? "—" })}
      confirmLabel={t("button")}
      phrase={payment.unitNo ?? undefined}
      ready={reason.trim().length > 0}
      successMessage={t("done")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/payments/{paymentId}/actions/reverse", {
            params: { path: { paymentId: payment.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim() },
          }),
        )
      }
    >
      <Field label={t("reason")} required>
        <Textarea
          rows={2}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          data-testid="reverse-reason"
        />
      </Field>
    </ConfirmAction>
  );
}
