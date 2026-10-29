"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

/**
 * Stops a sponsored campaign (G6, D-300): draft, scheduled or sending — messages not yet sent are cancelled and the
 * campaign is not billed. The reason is required and shown to the account. A finished campaign answers
 * `broadcast.invalid_state`, explained in words.
 */
export function RejectCampaign({ campaignId, name, tenant }: { campaignId: string; name: string; tenant: string }) {
  const t = useTranslations("admin.broadcast.campaigns");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("reject")}
      icon={IconXCircle}
      size="sm"
      variant="secondary"
      tone="destructive"
      testId="campaign-reject"
      title={t("rejectTitle", { name })}
      description={t("rejectBody", { tenant })}
      confirmLabel={t("rejectConfirm")}
      successMessage={t("rejected")}
      ready={reason.trim().length > 0}
      explain={(error) =>
        isApiError(error) && error.code === "broadcast.invalid_state" ? (
          <div className="mt-4" role="alert" data-testid="reject-invalid-state">
            <Callout tone="warning">{t("invalidState")}</Callout>
          </div>
        ) : null
      }
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/admin/sponsored-campaigns/{campaignId}/actions/reject", {
            params: { path: { campaignId } },
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
          data-testid="campaign-reject-reason"
        />
      </Field>
    </ConfirmAction>
  );
}
