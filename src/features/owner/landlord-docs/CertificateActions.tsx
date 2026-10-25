"use client";

import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Field } from "@/ui/components/Field";
import { Textarea } from "@/ui/components/Input";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

/** Issue or decline a resident's certificate request (B7.5, D-253); the API renders the letter and tells the resident. */
export function CertificateActions({ id, unitNo }: { id: string; unitNo: string }) {
  const t = useTranslations("owner.certificates.actions");
  const params = (key: string) => ({ path: { certificateId: id }, header: { "Idempotency-Key": key } });
  return (
    <div className="flex flex-wrap gap-2">
      <ConfirmAction
        label={t("issue")}
        icon={IconCheckCircle}
        size="sm"
        testId="certificate-issue"
        title={t("issueTitle", { unit: unitNo })}
        description={t("issueBody")}
        confirmLabel={t("issue")}
        successMessage={t("issued")}
        onConfirm={(key) =>
          unwrap(
            browserApi().POST("/v1/owner/rent-certificates/{certificateId}/actions/issue", { params: params(key) }),
          )
        }
      />
      <FormDialog
        label={t("decline")}
        size="sm"
        variant="ghost"
        testId="certificate-decline"
        title={t("declineTitle", { unit: unitNo })}
        description={t("declineBody")}
        submitLabel={t("decline")}
        successMessage={t("declined")}
        onSubmit={(data) =>
          unwrap(
            browserApi().POST("/v1/owner/rent-certificates/{certificateId}/actions/decline", {
              params: { path: { certificateId: id } },
              body: { reason: text(data, "reason") ?? "" },
            }),
          )
        }
      >
        {(errors) => (
          <Field label={t("reason")} required error={errors.reason}>
            <Textarea name="reason" rows={3} maxLength={300} required data-testid="certificate-decline-reason" />
          </Field>
        )}
      </FormDialog>
    </div>
  );
}
