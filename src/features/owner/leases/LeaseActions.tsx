"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatDate } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { blobToBase64 } from "@/ui/components/SignaturePad";
import { toast } from "@/ui/components/Toast";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconSign } from "@/ui/icons/glyphs/sign";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DialogSignaturePad } from "@/features/shared/console/DialogSignaturePad";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, integer, text } from "@/features/shared/console/FormDialog";
import { useSignatureLabels } from "@/features/shared/console/labels";

const LESSOR_REASONS: Schemas["LessorReason"][] = [
  "lessee_breach",
  "disturbance",
  "end_of_term",
  "mutual_agreement",
  "unlawful_use",
];
const TERMINATION_REASONS: Schemas["TerminationReason"][] = [
  "lessee_notice",
  "lessee_breach",
  "disturbance",
  "end_of_term",
  "mutual_agreement",
  "unlawful_use",
];

type LeaseView = Pick<Schemas["LeaseDto"], "id" | "unitNo" | "nextActions" | "months" | "endDate" | "number">;

/**
 * The lease's actions, exactly those the API lists in `nextActions` (never inferred from the status):
 * send for signature, countersign (the lessor's drawn signature), cancel a draft, record a notice,
 * renew, terminate (typed confirmation), begin and complete the move-out. Compliance refusals and
 * D-021a acknowledgements come back through each dialog with their legal reference.
 */
export function LeaseActions({ lease }: { lease: LeaseView }) {
  const t = useTranslations("owner.leases.actions");
  const reasons = useTranslations("owner.leases.reason");
  const signatureLabels = useSignatureLabels();
  const [signature, setSignature] = useState<Blob | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [terminate, setTerminate] = useState<{ reasonCode: string; effectiveDate: string | null; notes: string }>({
    reasonCode: "",
    effectiveDate: null,
    notes: "",
  });
  const [noticeBy, setNoticeBy] = useState<Schemas["NoticeParty"]>("lessee");
  const can = (name: string) => lease.nextActions.includes(name);
  const path = { leaseId: lease.id };
  const locale = useLocale() as Locale;
  /**
   * D-219: a date after today records the lessor's notice (`notice_given` / still `ending`, `termination: null`) —
   * the lease, the occupancy and the resident's door codes stay as they are until the office completes the
   * move-out; only a date of today or earlier closes the lease now.
   */
  const terminationMessage = (answer: Schemas["LeaseDto"]) =>
    answer.status === "terminated" || !answer.notice?.effectiveDate
      ? t("terminated")
      : t("terminationScheduled", {
          date: formatDate(answer.notice.effectiveDate, locale),
        });

  return (
    <div className="flex flex-wrap gap-2" data-testid="lease-actions">
      {can("send-for-signature") ? (
        <ConfirmAction
          label={t("send")}
          icon={IconSign}
          testId="lease-send"
          title={t("sendTitle")}
          description={t("sendBody", { unit: lease.unitNo })}
          confirmLabel={t("send")}
          successMessage={t("sent")}
          onConfirm={(key) =>
            unwrap(
              browserApi().POST("/v1/owner/leases/{leaseId}/actions/send-for-signature", {
                params: { path, header: { "Idempotency-Key": key } },
              }),
            )
          }
        />
      ) : null}

      {can("countersign") ? (
        <ConfirmAction
          label={t("countersign")}
          icon={IconSign}
          testId="lease-countersign"
          title={t("countersignTitle")}
          description={t("countersignBody", { unit: lease.unitNo })}
          confirmLabel={t("countersignConfirm")}
          successMessage={t("countersigned")}
          ready={signature !== null}
          onConfirm={async (key) =>
            unwrap(
              browserApi().POST("/v1/owner/leases/{leaseId}/actions/countersign", {
                params: { path, header: { "Idempotency-Key": key } },
                body: { signaturePng: await blobToBase64(signature!) },
              }),
            )
          }
        >
          <DialogSignaturePad
            label={t("signatureLabel")}
            labels={signatureLabels}
            onChange={setSignature}
            height={180}
          />
        </ConfirmAction>
      ) : null}

      {can("record-notice") ? (
        <FormDialog
          label={t("notice")}
          icon={IconCalendar}
          testId="lease-notice"
          title={t("noticeTitle")}
          description={t("noticeBody", { unit: lease.unitNo })}
          submitLabel={t("noticeSubmit")}
          successMessage={t("noticeRecorded")}
          onSubmit={(data, acknowledgementIds) =>
            unwrap(
              browserApi().POST("/v1/owner/leases/{leaseId}/actions/record-notice", {
                params: { path },
                body: {
                  by: noticeBy,
                  effectiveDate: text(data, "effectiveDate") ?? "",
                  noticeDate: text(data, "noticeDate"),
                  reasonCode: noticeBy === "lessor" ? (text(data, "reasonCode") as Schemas["LessorReason"]) : undefined,
                  acknowledgementIds: acknowledgementIds.length ? acknowledgementIds : undefined,
                },
              }),
            )
          }
        >
          {(errors) => (
            <>
              <Field label={t("noticeBy")}>
                <NativeSelect
                  value={noticeBy}
                  onChange={(event) => setNoticeBy(event.target.value as Schemas["NoticeParty"])}
                  options={[
                    { value: "lessee", label: t("byLessee") },
                    { value: "lessor", label: t("byLessor") },
                  ]}
                  data-testid="notice-by"
                />
              </Field>
              {noticeBy === "lessor" ? (
                <Field label={t("reason")} required error={errors.reasonCode}>
                  <NativeSelect
                    name="reasonCode"
                    required
                    options={LESSOR_REASONS.map((value) => ({ value, label: reasons(value) }))}
                  />
                </Field>
              ) : null}
              <Field label={t("noticeDate")} hint={t("noticeDateHint")} error={errors.noticeDate}>
                <DateField name="noticeDate" />
              </Field>
              <Field label={t("effectiveDate")} required hint={t("effectiveDateHint")} error={errors.effectiveDate}>
                <DateField name="effectiveDate" />
              </Field>
            </>
          )}
        </FormDialog>
      ) : null}

      {can("renew") ? (
        <FormDialog
          label={t("renew")}
          icon={IconRefresh}
          testId="lease-renew"
          title={t("renewTitle")}
          description={t("renewBody", { unit: lease.unitNo })}
          submitLabel={t("renewSubmit")}
          successMessage={t("renewed")}
          onSubmit={(data, acknowledgementIds) =>
            unwrap(
              browserApi().POST("/v1/owner/leases/{leaseId}/actions/renew", {
                params: { path },
                body: {
                  months: integer(data, "months"),
                  rent: text(data, "rent"),
                  acknowledgementIds: acknowledgementIds.length ? acknowledgementIds : undefined,
                },
              }),
            )
          }
        >
          {(errors) => (
            <>
              <Field label={t("renewMonths")} error={errors.months}>
                <Input name="months" type="number" min={1} defaultValue={lease.months} />
              </Field>
              <Field label={t("renewRent")} hint={t("renewRentHint")} error={errors.rent}>
                <Input name="rent" inputMode="decimal" />
              </Field>
            </>
          )}
        </FormDialog>
      ) : null}

      {can("begin-move-out") ? (
        <ConfirmAction
          label={t("beginMoveOut")}
          variant="secondary"
          testId="lease-begin-move-out"
          title={t("beginMoveOutTitle")}
          description={t("beginMoveOutBody", { unit: lease.unitNo })}
          confirmLabel={t("beginMoveOut")}
          onConfirm={() =>
            unwrap(browserApi().POST("/v1/owner/leases/{leaseId}/actions/begin-move-out", { params: { path } }))
          }
        />
      ) : null}

      {can("complete-move-out") ? (
        <ConfirmAction
          label={t("completeMoveOut")}
          icon={IconCheck}
          testId="lease-complete-move-out"
          title={t("completeMoveOutTitle")}
          description={t("completeMoveOutBody", { unit: lease.unitNo })}
          confirmLabel={t("completeMoveOut")}
          phrase={lease.unitNo}
          onConfirm={(key) =>
            unwrap(
              browserApi().POST("/v1/owner/leases/{leaseId}/actions/complete-move-out", {
                params: { path, header: { "Idempotency-Key": key } },
                body: {},
              }),
            )
          }
        />
      ) : null}

      {can("terminate") ? (
        <ConfirmAction
          label={t("terminate")}
          icon={IconXCircle}
          variant="destructive"
          tone="destructive"
          testId="lease-terminate"
          title={t("terminateTitle")}
          description={t("terminateBody", { unit: lease.unitNo })}
          confirmLabel={t("terminate")}
          phrase={lease.unitNo}
          ready={Boolean(terminate.reasonCode && terminate.effectiveDate)}
          onDone={(result) => toast.success(terminationMessage(result as Schemas["LeaseDto"]))}
          onConfirm={(key, acknowledgementIds) =>
            unwrap(
              browserApi().POST("/v1/owner/leases/{leaseId}/actions/terminate", {
                params: { path, header: { "Idempotency-Key": key } },
                body: {
                  reasonCode: terminate.reasonCode as Schemas["TerminationReason"],
                  effectiveDate: terminate.effectiveDate!,
                  notes: terminate.notes.trim() || null,
                  acknowledgementIds: acknowledgementIds.length ? acknowledgementIds : undefined,
                },
              }),
            )
          }
        >
          <Field label={t("reason")} required>
            <NativeSelect
              value={terminate.reasonCode}
              placeholder={t("chooseReason")}
              onChange={(event) => setTerminate({ ...terminate, reasonCode: event.target.value })}
              options={TERMINATION_REASONS.map((value) => ({ value, label: reasons(value) }))}
              data-testid="terminate-reason"
            />
          </Field>
          <Field label={t("effectiveDate")} required hint={t("terminateDateHint")}>
            <DateField
              name="terminateDate"
              onChange={(value) => setTerminate((current) => ({ ...current, effectiveDate: value }))}
            />
          </Field>
          <Field label={t("notes")}>
            <Textarea
              rows={2}
              value={terminate.notes}
              onChange={(event) => setTerminate({ ...terminate, notes: event.target.value })}
            />
          </Field>
        </ConfirmAction>
      ) : null}

      {can("cancel") ? (
        <ConfirmAction
          label={t("cancel")}
          variant="ghost"
          tone="destructive"
          testId="lease-cancel"
          title={t("cancelTitle")}
          description={t("cancelBody", { unit: lease.unitNo })}
          confirmLabel={t("cancelConfirm")}
          ready={cancelReason.trim().length > 0}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/owner/leases/{leaseId}/actions/cancel", {
                params: { path },
                body: { cancelReason: cancelReason.trim() },
              }),
            )
          }
        >
          <Field label={t("cancelReason")} required>
            <Textarea rows={2} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
          </Field>
        </ConfirmAction>
      ) : null}
    </div>
  );
}
