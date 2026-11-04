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
export function ResendReceipt({
  receiptId,
  number,
  payer,
  open,
  onOpenChange,
}: {
  receiptId: string;
  number: string;
  payer: string;
  /** Controlled from a row's "⋯" menu. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("owner.payments.resendReceipt");
  return (
    <ConfirmAction
      label={t("action")}
      icon={IconMail}
      variant="ghost"
      size="sm"
      testId="receipt-resend"
      open={open}
      onOpenChange={onOpenChange}
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
