"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";

/**
 * Confirm or dismiss a held payment (D-220): a provider payment the API did not book because it repeats a
 * transfer already booked. Confirm books it now (allocated oldest first, the rest as the payer's credit, a
 * receipt); dismiss marks it failed with a reason and it is never booked. Both are typed with the unit and
 * carry the dialog's Idempotency-Key; shown only for the actions the API offers (`nextActions`).
 */
export function HeldPaymentActions({
  payment,
  amountLabel,
}: {
  payment: Pick<Schemas["PaymentDto"], "id" | "nextActions" | "unitNo" | "payerName">;
  amountLabel: string;
}) {
  const t = useTranslations("owner.payments.held");
  const [reason, setReason] = useState("");
  const path = { paymentId: payment.id };
  const unit = payment.unitNo ?? "—";
  const can = (action: string) => payment.nextActions.includes(action);
  if (!can("confirm") && !can("dismiss")) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="held-actions">
      {can("confirm") ? (
        <ConfirmAction
          label={t("confirm")}
          icon={IconCheck}
          testId="held-confirm"
          title={t("confirmTitle")}
          description={t("confirmBody", { amount: amountLabel, payer: payment.payerName ?? "—", unit })}
          confirmLabel={t("confirm")}
          phrase={payment.unitNo ?? undefined}
          successMessage={t("confirmed")}
          onConfirm={(key) =>
            unwrap(
              browserApi().POST("/v1/owner/payments/{paymentId}/actions/confirm", {
                params: { path, header: { "Idempotency-Key": key } },
              }),
            )
          }
        />
      ) : null}
      {can("dismiss") ? (
        <ConfirmAction
          label={t("dismiss")}
          icon={IconXCircle}
          variant="secondary"
          tone="destructive"
          testId="held-dismiss"
          title={t("dismissTitle")}
          description={t("dismissBody", { amount: amountLabel, unit })}
          confirmLabel={t("dismiss")}
          phrase={payment.unitNo ?? undefined}
          ready={reason.trim().length > 0}
          successMessage={t("dismissed")}
          onConfirm={(key) =>
            unwrap(
              browserApi().POST("/v1/owner/payments/{paymentId}/actions/dismiss", {
                params: { path, header: { "Idempotency-Key": key } },
                body: { reason: reason.trim() },
              }),
            )
          }
        >
          <Field label={t("dismissReason")} required hint={t("dismissReasonHint")}>
            <Textarea
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              data-testid="held-dismiss-reason"
            />
          </Field>
        </ConfirmAction>
      ) : null}
    </div>
  );
}
