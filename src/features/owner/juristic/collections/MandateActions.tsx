"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

/** Stops a pending or active auto-pay mandate with a reason (the provider is told; nothing more is charged). */
export function RevokeMandateButton({ mandate }: { mandate: Schemas["PaymentMandateDto"] }) {
  const t = useTranslations("owner.collections.mandates");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("revoke")}
      icon={IconXCircle}
      variant="ghost"
      size="sm"
      tone="destructive"
      testId="mandate-revoke"
      title={t("revokeTitle", { unit: mandate.unitNo })}
      description={t("revokeBody", { masked: mandate.masked ?? "—" })}
      confirmLabel={t("revoke")}
      ready={reason.trim().length >= 3}
      successMessage={t("revoked")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/payment-mandates/{mandateId}/actions/revoke", {
            params: { path: { mandateId: mandate.id } },
            body: { reason: reason.trim() },
          }),
        )
      }
      onDone={() => setReason("")}
    >
      <Field label={t("reason")} required>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={2}
          maxLength={500}
          data-testid="mandate-revoke-reason"
        />
      </Field>
    </ConfirmAction>
  );
}
