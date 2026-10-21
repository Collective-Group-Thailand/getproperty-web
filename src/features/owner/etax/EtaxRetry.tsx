"use client";

import { useTranslations } from "next-intl";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";

/**
 * Send a refused or failed e-Tax document again after fixing what the provider refused (D-215): back to
 * `queued`, attempts reset, sent at once. Only when the API offers `retry`; one Idempotency-Key per dialog.
 */
export function EtaxRetry({
  submission,
}: {
  submission: Pick<Schemas["EtaxSubmissionDto"], "id" | "number" | "nextActions">;
}) {
  const t = useTranslations("owner.etax.retry");
  if (!submission.nextActions.includes("retry")) return null;
  return (
    <ConfirmAction
      label={t("button")}
      icon={IconRefresh}
      testId="etax-retry"
      title={t("title", { number: submission.number })}
      description={t("body", { number: submission.number })}
      confirmLabel={t("button")}
      successMessage={t("done")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/etax/submissions/{submissionId}/actions/retry", {
            params: { path: { submissionId: submission.id }, header: { "Idempotency-Key": key } },
          }),
        )
      }
    />
  );
}
