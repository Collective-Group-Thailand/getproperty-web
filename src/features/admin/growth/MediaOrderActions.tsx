"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokInstant } from "@/features/shared/console/time";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { sha256Hex } from "@/lib/api/sha256";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { toast } from "@/ui/components/Toast";
import { IconCalendarCheck } from "@/ui/icons/glyphs/calendar-check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClose } from "@/ui/icons/glyphs/close";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

type Order = Schemas["AdminMediaServiceOrderDto"];

/** The partner's visit (G5, O-032): a requested (paid) order gets a date-time and the partner's reference; may be moved. */
export function ScheduleMediaVisit({ order, defaultWhen }: { order: Order; defaultWhen: string }) {
  const t = useTranslations("admin.growth.media");
  return (
    <FormDialog
      label={order.state === "scheduled" ? t("reschedule") : t("schedule")}
      icon={IconCalendarCheck}
      variant={order.state === "scheduled" ? "secondary" : "primary"}
      testId="media-schedule"
      title={t("scheduleTitle", { unit: order.unitNo, tenant: order.tenantName })}
      description={t("scheduleHint")}
      submitLabel={t("scheduleSave")}
      successMessage={t("scheduled")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/admin/media-service-orders/{orderId}/actions/schedule", {
            params: { path: { orderId: order.id } },
            body: {
              scheduledFor: bangkokInstant(text(data, "scheduledFor")) ?? "",
              partnerRef: text(data, "partnerRef") ?? null,
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("when")} hint={t("whenHint")} error={errors.scheduledFor} required>
            <Input
              name="scheduledFor"
              type="datetime-local"
              required
              defaultValue={defaultWhen}
              data-testid="media-schedule-when"
            />
          </Field>
          <Field label={t("partnerRef")} hint={t("partnerRefHint")} error={errors.partnerRef}>
            <Input
              name="partnerRef"
              maxLength={200}
              defaultValue={order.partnerRef ?? ""}
              autoComplete="off"
              data-testid="media-schedule-ref"
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

type Uploaded = { name: string; documentId: string };

/**
 * The deliverables (G5, D-297 (6)): each file is presigned as a document of the ordering tenant in the order's unit
 * (photos as `listing_photo`, anything else `other`; counted to that tenant's storage, D-286), PUT to storage with the
 * signed headers, then *Deliver* attaches them all at once. Files are uploaded one by one so a refused one
 * (`storage.allowance_exceeded`, wrong type) names itself and the others stay.
 */
export function DeliverMedia({ order }: { order: Order }) {
  const t = useTranslations("admin.growth.media");
  const [uploaded, setUploaded] = useState<Uploaded[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const upload = useApiAction<Uploaded>({ refresh: false });
  const deliver = useApiAction<Order>();

  const send = async (file: File): Promise<Uploaded> => {
    const signed = await unwrap(
      browserApi().POST("/v1/admin/media-service-orders/{orderId}/deliverables", {
        params: { path: { orderId: order.id } },
        body: {
          kind: file.type.startsWith("image/") ? "listing_photo" : "other",
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          sha256: await sha256Hex(file),
          title: null,
        },
      }),
    );
    if (!signed.uploadUrl) throw new ApiError(422, { code: "document.multipart_unsupported", title: "", detail: "" });
    const put = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: signed.headers as Record<string, string>,
      body: file,
    });
    if (!put.ok) throw new ApiError(put.status, { code: "document.upload_failed", title: "", detail: "" });
    return { name: file.name, documentId: signed.file.id };
  };

  const onFiles = async (files: File[]) => {
    for (const file of files) {
      setUploading(file.name);
      const done = await upload.run(() => send(file));
      if (done) setUploaded((list) => [...list, done]);
      else break;
    }
    setUploading(null);
  };

  return (
    <div className="flex flex-col gap-4" data-testid="media-deliver">
      <FileDropzone
        label={t("files")}
        hint={t("filesHint")}
        accept="image/jpeg,image/png,image/webp,application/pdf,video/mp4"
        multiple
        chooseText={t("choose")}
        disabled={uploading !== null || deliver.busy}
        onFiles={(files) => void onFiles(files)}
        data-testid="media-deliver-files"
      />
      {uploading ? <p className="text-muted m-0 text-sm">{t("uploading", { name: uploading })}</p> : null}
      <ProblemNotice error={upload.error} />
      {uploaded.length > 0 ? (
        <ul className="divide-border m-0 list-none divide-y p-0" aria-label={t("ready")}>
          {uploaded.map((file) => (
            <li
              key={file.documentId}
              className="flex items-center justify-between gap-3 py-2 text-sm"
              data-testid="media-uploaded"
            >
              <span className="min-w-0 truncate">{file.name}</span>
              <Button
                size="sm"
                variant="ghost"
                iconStart={IconClose}
                aria-label={t("removeFile", { name: file.name })}
                onClick={() => setUploaded((list) => list.filter((one) => one.documentId !== file.documentId))}
              >
                {t("remove")}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          iconStart={IconCheckCircle}
          disabled={uploaded.length === 0 || uploading !== null}
          loading={deliver.busy}
          data-testid="media-deliver-submit"
          onClick={() =>
            void deliver.run(
              () =>
                unwrap(
                  browserApi().POST("/v1/admin/media-service-orders/{orderId}/actions/deliver", {
                    params: { path: { orderId: order.id } },
                    body: { documentIds: uploaded.map((file) => file.documentId) },
                  }),
                ),
              () => {
                setUploaded([]);
                toast.success(t("delivered"));
              },
            )
          }
        >
          {t("deliver", { count: uploaded.length })}
        </Button>
        <span className="text-muted text-sm">{t("deliverHint")}</span>
      </div>
      <ProblemNotice error={deliver.error} />
    </div>
  );
}

/** Cancels an open order with a reason (G5): money already paid comes back only by a credit note through Finance. */
export function CancelMediaOrder({ order }: { order: Order }) {
  const t = useTranslations("admin.growth.media");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("cancel")}
      icon={IconXCircle}
      variant="destructive"
      tone="destructive"
      testId="media-cancel"
      title={t("cancelTitle", { unit: order.unitNo, tenant: order.tenantName })}
      description={order.state === "pending_payment" ? t("cancelBodyUnpaid") : t("cancelBodyPaid")}
      confirmLabel={t("cancelConfirm")}
      successMessage={t("cancelled")}
      ready={reason.trim().length > 0}
      onConfirm={(idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/admin/media-service-orders/{orderId}/actions/cancel", {
            params: { path: { orderId: order.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: { reason: reason.trim() },
          }),
        )
      }
    >
      <Field label={t("reason")} required>
        <Textarea
          value={reason}
          maxLength={500}
          onChange={(event) => setReason(event.target.value)}
          data-testid="media-cancel-reason"
        />
      </Field>
    </ConfirmAction>
  );
}
