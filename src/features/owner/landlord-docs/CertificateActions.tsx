"use client";

import { useState } from "react";

import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { LazyDropdownMenu } from "@/ui/components/overlays";
import { IconMore } from "@/ui/icons/glyphs/more";
import { Textarea } from "@/ui/components/Input";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";

/** Issue or decline a resident's certificate request (B7.5, D-253); the API renders the letter and tells the resident. */
export function CertificateActions({ id, unitNo }: { id: string; unitNo: string }) {
  const t = useTranslations("owner.certificates.actions");
  const params = (key: string) => ({ path: { certificateId: id }, header: { "Idempotency-Key": key } });
  const [declining, setDeclining] = useState(false);
  // One action on the row (issue); declining — rarer — waits in the row's "⋯" (G3 revision).
  return (
    <div className="flex items-center justify-end gap-1">
      <ConfirmAction
        label={t("issue")}
        icon={IconCheckCircle}
        size="sm"
        variant="secondary"
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
      <LazyDropdownMenu
        label={t("more", { unit: unitNo })}
        trigger={<IconButton icon={IconMore} label={t("more", { unit: unitNo })} data-testid="certificate-menu" />}
        items={[
          {
            id: "decline",
            label: <span data-testid="certificate-decline">{t("decline")}</span>,
            destructive: true,
            onSelect: () => setDeclining(true),
          },
        ]}
      />
      <FormDialog
        label={t("decline")}
        open={declining}
        onOpenChange={setDeclining}
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
