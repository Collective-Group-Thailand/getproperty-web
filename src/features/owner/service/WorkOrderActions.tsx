"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokInstant, bangkokLocal } from "@/features/shared/console/time";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconPlay } from "@/ui/icons/glyphs/play";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconStaff } from "@/ui/icons/glyphs/staff";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import type { FieldMember } from "../shared/members";
import { PhotoUploadField, usePhotoUploads } from "../shared/PhotoUploads";
import { AssigneeFields, VisitWindowFields } from "./AssigneeFields";

type WorkOrder = Pick<
  Schemas["WorkOrderDto"],
  | "id"
  | "title"
  | "status"
  | "nextActions"
  | "unitNo"
  | "assignee"
  | "scheduledAt"
  | "scheduledUntil"
  | "costTotal"
  | "buildingId"
  | "unitId"
>;

const COST_KINDS: Schemas["WorkOrderCostKind"][] = ["part", "labour", "travel", "other"];
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const QTY = /^\d{1,6}(\.\d{1,3})?$/;

/**
 * A work order's steps, exactly as the API offers them (`nextActions`, operator audience): assign or re-assign
 * (staff or an external technician, visit window), the field steps an operator may also take — check in,
 * waiting for parts (note) / resume, complete (the API needs an after photo) —, **verify** (typed: the costs
 * become final and the technician's access ends, D-210) and cancel with a reason.
 */
export function WorkOrderActions({ workOrder, members }: { workOrder: WorkOrder; members: FieldMember[] }) {
  const t = useTranslations("owner.service.workOrder");
  const locale = useLocale() as Locale;
  const step = useApiAction();
  const [cancelReason, setCancelReason] = useState("");
  const can = (name: string) => workOrder.nextActions.includes(name);
  const path = { workOrderId: workOrder.id };
  const subject = { title: workOrder.title, unit: workOrder.unitNo ?? t("commonArea") };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2" data-testid="work-order-actions">
        {can("assign") ? (
          <FormDialog
            label={workOrder.assignee ? t("reassign") : t("assign")}
            icon={IconStaff}
            variant={workOrder.assignee ? "secondary" : "primary"}
            testId="work-order-assign"
            title={t("assignTitle", subject)}
            description={t("assignBody")}
            submitLabel={t("assignSubmit")}
            successMessage={t("assigned")}
            size_="lg"
            onSubmit={(data) =>
              unwrap(
                browserApi().POST("/v1/owner/work-orders/{workOrderId}/actions/assign", {
                  params: { path },
                  body: {
                    assigneeUserId: text(data, "assigneeUserId") ?? null,
                    assigneePartyId: text(data, "assigneePartyId") ?? null,
                    scheduledAt: bangkokInstant(text(data, "scheduledAt")) ?? null,
                    scheduledUntil: bangkokInstant(text(data, "scheduledUntil")) ?? null,
                  },
                }),
              )
            }
          >
            {(errors) => (
              <>
                <AssigneeFields
                  members={members}
                  allowNone={false}
                  initial={
                    workOrder.assignee
                      ? {
                          kind: workOrder.assignee.type,
                          id: workOrder.assignee.id,
                          name: workOrder.assignee.displayName,
                        }
                      : undefined
                  }
                  errors={errors}
                />
                <VisitWindowFields
                  from={bangkokLocal(workOrder.scheduledAt)}
                  until={bangkokLocal(workOrder.scheduledUntil)}
                  errors={errors}
                />
              </>
            )}
          </FormDialog>
        ) : null}
        {can("check-in") ? (
          <Button
            variant="secondary"
            iconStart={IconPlay}
            loading={step.busy}
            data-testid="work-order-check-in"
            onClick={() =>
              void step.run(() =>
                unwrap(browserApi().POST("/v1/owner/work-orders/{workOrderId}/actions/check-in", { params: { path } })),
              )
            }
          >
            {t("checkIn")}
          </Button>
        ) : null}
        {can("wait-parts") ? (
          <FormDialog
            label={t("waitParts")}
            icon={IconParcel}
            testId="work-order-wait-parts"
            title={t("waitPartsTitle", subject)}
            description={t("waitPartsBody")}
            submitLabel={t("waitParts")}
            successMessage={t("waiting")}
            onSubmit={(data) =>
              unwrap(
                browserApi().POST("/v1/owner/work-orders/{workOrderId}/actions/wait-parts", {
                  params: { path },
                  body: { note: text(data, "note") ?? null },
                }),
              )
            }
          >
            {(errors) => (
              <Field label={t("partsNote")} error={errors.note}>
                <Textarea name="note" rows={2} />
              </Field>
            )}
          </FormDialog>
        ) : null}
        {can("resume") ? (
          <Button
            variant="secondary"
            iconStart={IconPlay}
            loading={step.busy}
            data-testid="work-order-resume"
            onClick={() =>
              void step.run(() =>
                unwrap(browserApi().POST("/v1/owner/work-orders/{workOrderId}/actions/resume", { params: { path } })),
              )
            }
          >
            {t("resume")}
          </Button>
        ) : null}
        {can("complete") ? (
          <FormDialog
            label={t("complete")}
            icon={IconCheckCircle}
            testId="work-order-complete"
            title={t("completeTitle", subject)}
            description={t("completeBody")}
            submitLabel={t("complete")}
            successMessage={t("completed")}
            onSubmit={(data) =>
              unwrap(
                browserApi().POST("/v1/owner/work-orders/{workOrderId}/actions/complete", {
                  params: { path },
                  body: { note: text(data, "note") ?? null },
                }),
              )
            }
          >
            {(errors) => (
              <Field label={t("completionNote")} error={errors.note}>
                <Textarea name="note" rows={3} data-testid="completion-note" />
              </Field>
            )}
          </FormDialog>
        ) : null}
        {can("verify") ? (
          <ConfirmAction
            label={t("verify")}
            icon={IconShield}
            testId="work-order-verify"
            title={t("verifyTitle", subject)}
            description={t("verifyBody", { total: formatTHB(workOrder.costTotal, locale) })}
            confirmLabel={t("verify")}
            phrase={workOrder.unitNo ?? t("verifyPhrase")}
            successMessage={t("verified")}
            onConfirm={() =>
              unwrap(browserApi().POST("/v1/owner/work-orders/{workOrderId}/actions/verify", { params: { path } }))
            }
          />
        ) : null}
        {can("cancel") ? (
          <ConfirmAction
            label={t("cancel")}
            icon={IconXCircle}
            variant="destructive"
            tone="destructive"
            testId="work-order-cancel"
            title={t("cancelTitle", subject)}
            description={t("cancelBody")}
            confirmLabel={t("cancel")}
            ready={cancelReason.trim().length > 0}
            successMessage={t("cancelled")}
            onConfirm={() =>
              unwrap(
                browserApi().POST("/v1/owner/work-orders/{workOrderId}/actions/cancel", {
                  params: { path },
                  body: { reason: cancelReason.trim() },
                }),
              )
            }
          >
            <Field label={t("reason")} required>
              <Textarea
                rows={2}
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                data-testid="work-order-cancel-reason"
              />
            </Field>
          </ConfirmAction>
        ) : null}
      </div>
      <ProblemNotice error={step.error} />
    </div>
  );
}

/**
 * Before / after photos of the work (uploaded as `service_photo`, then attached with their role). The API
 * keeps at most ten per role; completing needs one after photo.
 */
export function WorkOrderPhotoUpload({
  workOrder,
  role,
}: {
  workOrder: Pick<Schemas["WorkOrderDto"], "id" | "unitId" | "buildingId">;
  role: Schemas["WorkOrderPhotoRole"];
}) {
  const t = useTranslations("owner.service.workOrder");
  const router = useRouter();
  const attach = useApiAction();
  const uploads = usePhotoUploads({
    kind: "service_photo",
    scopeType: workOrder.unitId ? "unit" : "building",
    scopeId: workOrder.unitId ?? workOrder.buildingId,
  });
  return (
    <div className="flex flex-col gap-2">
      <PhotoUploadField
        uploads={uploads}
        label={t(role === "before" ? "addBefore" : "addAfter")}
        testId={`photos-${role}`}
      />
      {uploads.ids.length ? (
        <Button
          size="sm"
          iconStart={IconCheck}
          loading={attach.busy}
          data-testid={`attach-${role}`}
          onClick={() =>
            void attach.run(
              async () => {
                for (const documentId of uploads.ids)
                  await unwrap(
                    browserApi().POST("/v1/owner/work-orders/{workOrderId}/photos", {
                      params: { path: { workOrderId: workOrder.id } },
                      body: { documentId, role },
                    }),
                  );
              },
              () => {
                uploads.reset();
                router.refresh();
              },
            )
          }
        >
          {t("attach", { count: uploads.ids.length })}
        </Button>
      ) : null}
      <ProblemNotice error={attach.error} />
    </div>
  );
}

/** Adds a cost line (part, labour, travel, other): the API multiplies quantity × unit price and sums the total. */
export function AddCostLine({
  workOrder,
}: {
  workOrder: Pick<Schemas["WorkOrderDto"], "id" | "title" | "unitId" | "buildingId">;
}) {
  const t = useTranslations("owner.service.cost");
  const receipt = usePhotoUploads({
    kind: "other",
    scopeType: workOrder.unitId ? "unit" : "building",
    scopeId: workOrder.unitId ?? workOrder.buildingId,
  });
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      size="sm"
      testId="cost-add"
      title={t("addTitle", { title: workOrder.title })}
      description={t("addBody")}
      submitLabel={t("addSubmit")}
      successMessage={t("added")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/work-orders/{workOrderId}/cost-lines", {
            params: { path: { workOrderId: workOrder.id } },
            body: {
              kind: (text(data, "kind") ?? "part") as Schemas["WorkOrderCostKind"],
              description: text(data, "description") ?? "",
              quantity: text(data, "quantity") ?? "1",
              unitPrice: text(data, "unitPrice") ?? "",
              receiptDocumentId: receipt.ids[0] ?? null,
            },
          }),
        )
      }
      onDone={() => receipt.reset()}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("kind")} error={errors.kind}>
              <NativeSelect
                name="kind"
                defaultValue="part"
                options={COST_KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
              />
            </Field>
            <Field label={t("description")} required error={errors.description}>
              <Input name="description" required data-testid="cost-description" />
            </Field>
            <Field
              label={t("quantity")}
              error={errors.quantity ?? (QTY.test(quantity) ? undefined : t("quantityHint"))}
            >
              <Input
                name="quantity"
                inputMode="decimal"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                data-testid="cost-quantity"
              />
            </Field>
            <Field
              label={t("unitPrice")}
              required
              hint={t("unitPriceHint")}
              error={errors.unitPrice ?? (price && !MONEY.test(price) ? t("unitPriceHint") : undefined)}
            >
              <Input
                name="unitPrice"
                inputMode="decimal"
                required
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                data-testid="cost-unit-price"
              />
            </Field>
          </div>
          <PhotoUploadField uploads={receipt} label={t("receipt")} multiple={false} testId="cost-receipt" />
        </>
      )}
    </FormDialog>
  );
}

/** Removes a cost line (before verification). */
export function RemoveCostLine({
  workOrderId,
  line,
}: {
  workOrderId: string;
  line: Pick<Schemas["CostLineDto"], "id" | "description">;
}) {
  const t = useTranslations("owner.service.cost");
  return (
    <ConfirmAction
      label={t("remove")}
      icon={IconDelete}
      variant="ghost"
      size="sm"
      tone="destructive"
      testId="cost-remove"
      title={t("removeTitle")}
      description={t("removeBody", { description: line.description })}
      confirmLabel={t("remove")}
      successMessage={t("removed")}
      onConfirm={() =>
        unwrap(
          browserApi().DELETE("/v1/owner/work-orders/{workOrderId}/cost-lines/{costLineId}", {
            params: { path: { workOrderId, costLineId: line.id } },
          }),
        )
      }
    />
  );
}
