"use client";

import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { Callout } from "@/ui/components/Callout";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

/** Send a fresh invitation link to getbuild (G8): the previous link stops working; Idempotency-Key per opening. */
export function ResendHandoff({ handoffId, unit }: { handoffId: string; unit: string }) {
  const t = useTranslations("admin.insight.handoffs");
  return (
    <ConfirmAction
      label={t("resend")}
      icon={IconRefresh}
      size="sm"
      variant="secondary"
      testId="handoff-resend"
      title={t("resendTitle", { unit })}
      description={t("resendBody")}
      confirmLabel={t("resend")}
      successMessage={t("resent")}
      explain={(error) =>
        isApiError(error) && error.code === "handoff.invalid_state" ? (
          <div className="mt-4" role="alert">
            <Callout tone="warning">{t("invalidState")}</Callout>
          </div>
        ) : null
      }
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/admin/rental-handoffs/{handoffId}/actions/resend", {
            params: { path: { handoffId }, header: { "Idempotency-Key": idempotencyKey } },
          }),
        )
      }
    />
  );
}
