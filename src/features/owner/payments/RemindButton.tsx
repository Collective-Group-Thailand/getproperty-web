"use client";

import { useTranslations } from "next-intl";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { IconBell } from "@/ui/icons/glyphs/bell";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";

/** "Send reminder now" for one overdue invoice (D-045): the resident gets it on LINE; quiet hours apply. */
export function RemindButton({ invoiceId, label, balance }: { invoiceId: string; label: string; balance: string }) {
  const t = useTranslations("owner.arrears.remind");
  return (
    <ConfirmAction
      label={t("button")}
      icon={IconBell}
      size="sm"
      variant="secondary"
      testId="arrears-remind"
      title={t("title")}
      description={t("body", { invoice: label, balance })}
      confirmLabel={t("button")}
      successMessage={t("sent")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/invoices/{invoiceId}/actions/send-reminder", {
            params: { path: { invoiceId }, header: { "Idempotency-Key": key } },
          }),
        )
      }
    />
  );
}
