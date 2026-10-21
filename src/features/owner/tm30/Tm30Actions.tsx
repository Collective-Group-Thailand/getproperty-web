"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconUpload } from "@/ui/icons/glyphs/upload";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokInstant, bangkokLocal } from "@/features/shared/console/time";

/**
 * Generate the Immigration Bureau upload file for a building's pending TM30 notifications (D-052, D-216):
 * the API decrypts each passport number for the file only (audited) and answers `422 tm30.data_missing` with
 * what to complete per person — shown in the dialog. The platform never submits: the owner uploads the file
 * on the Bureau's site and then records the submission.
 */
export function GenerateTm30({
  buildingId,
  buildingName,
  count,
}: {
  buildingId: string;
  buildingName: string;
  count: number;
}) {
  const t = useTranslations("owner.tm30.generate");
  return (
    <ConfirmAction
      label={t("button", { building: buildingName })}
      icon={IconUpload}
      size="sm"
      testId="tm30-generate"
      title={t("title", { building: buildingName })}
      description={t("body", { count, building: buildingName })}
      confirmLabel={t("confirm")}
      onDone={() => toast.success(t("done"))}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/buildings/{buildingId}/tm30-exports/actions/generate", {
            params: { path: { buildingId }, header: { "Idempotency-Key": key } },
            body: {},
          }),
        )
      }
    />
  );
}

/** Record the manual submission (time + the Bureau's receipt reference) or cancel a notification not due. */
export function Tm30RowActions({
  row,
}: {
  row: Pick<Schemas["Tm30ExportDto"], "id" | "name" | "unitNo" | "nextActions">;
}) {
  const t = useTranslations("owner.tm30.row");
  const [reason, setReason] = useState("");
  const path = { tm30ExportId: row.id };
  return (
    <div className="flex flex-wrap gap-2" data-testid="tm30-row-actions">
      {row.nextActions.includes("mark-submitted") ? (
        <FormDialog
          label={t("markSubmitted")}
          icon={IconCheck}
          size="sm"
          testId="tm30-mark-submitted"
          title={t("markSubmittedTitle", { name: row.name, unit: row.unitNo })}
          description={t("markSubmittedBody")}
          submitLabel={t("markSubmitted")}
          successMessage={t("submitted")}
          onSubmit={(data, _ack, key) =>
            unwrap(
              browserApi().POST("/v1/owner/tm30-exports/{tm30ExportId}/actions/mark-submitted", {
                params: { path, header: { "Idempotency-Key": key } },
                body: {
                  reference: text(data, "reference") ?? null,
                  submittedAt: bangkokInstant(text(data, "submittedAt")),
                },
              }),
            )
          }
        >
          {(errors) => (
            <>
              <Field label={t("submittedAt")} hint={t("submittedAtHint")} error={errors.submittedAt}>
                <Input
                  name="submittedAt"
                  type="datetime-local"
                  defaultValue={bangkokLocal(new Date().toISOString())}
                  data-testid="tm30-submitted-at"
                />
              </Field>
              <Field label={t("reference")} hint={t("referenceHint")} error={errors.reference}>
                <Input name="reference" maxLength={100} data-testid="tm30-reference" />
              </Field>
            </>
          )}
        </FormDialog>
      ) : null}
      {row.nextActions.includes("cancel") ? (
        <ConfirmAction
          label={t("cancel")}
          icon={IconXCircle}
          size="sm"
          variant="ghost"
          tone="destructive"
          testId="tm30-cancel"
          title={t("cancelTitle", { name: row.name, unit: row.unitNo })}
          description={t("cancelBody")}
          confirmLabel={t("cancel")}
          ready={reason.trim().length >= 3}
          successMessage={t("cancelled")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/owner/tm30-exports/{tm30ExportId}/actions/cancel", {
                params: { path },
                body: { reason: reason.trim() },
              }),
            )
          }
        >
          <Field label={t("cancelReason")} required hint={t("cancelReasonHint")}>
            <Textarea
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              data-testid="tm30-cancel-reason"
            />
          </Field>
        </ConfirmAction>
      ) : null}
    </div>
  );
}
