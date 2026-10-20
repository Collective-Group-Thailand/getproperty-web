"use client";

import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { IconMail } from "@/ui/icons/glyphs/mail";

/**
 * Sends a receipt to its payer again (`POST /v1/owner/receipts/{id}/actions/resend`, D-208): the same LINE
 * message, quiet hours and consent apply; a voided receipt is refused by the API. One Idempotency-Key per
 * confirmation.
 */
export function ResendReceipt({ receiptId, number, payer }: { receiptId: string; number: string; payer: string }) {
  const t = useTranslations("owner.payments.resendReceipt");
  return (
    <ConfirmAction
      label={t("action")}
      icon={IconMail}
      variant="ghost"
      size="sm"
      testId="receipt-resend"
      title={t("title")}
      description={t("body", { number, payer })}
      confirmLabel={t("action")}
      successMessage={t("done")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/receipts/{receiptId}/actions/resend", {
            params: { path: { receiptId }, header: { "Idempotency-Key": key } },
          }),
        )
      }
    />
  );
}
