"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokInstant } from "@/features/shared/console/time";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconFilter } from "@/ui/icons/glyphs/filter";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconWrench } from "@/ui/icons/glyphs/wrench";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath } from "../shared/links";
import type { FieldMember } from "../shared/members";
import { PhotoUploadField, usePhotoUploads } from "../shared/PhotoUploads";
import { AssigneeFields, VisitWindowFields } from "./AssigneeFields";

const PRIORITIES: Schemas["ServicePriority"][] = ["low", "normal", "high", "urgent"];
const KINDS: Schemas["WorkOrderKind"][] = ["repair", "preventive", "install", "deinstall", "inspection"];

type Category = Pick<Schemas["ServiceCategoryDto"], "id" | "nameTh" | "nameEn" | "slaHours">;
type Unit = { id: string; unitNo: string };

function useCategoryOptions(categories: Category[]) {
  const locale = useLocale() as Locale;
  const t = useTranslations("owner.service");
  return categories.map((category) => ({
    value: category.id,
    label: t("categoryOption", {
      name: locale === "th" ? category.nameTh : category.nameEn,
      hours: category.slaHours,
    }),
  }));
}

/**
 * Reports a request for the building (D-072): a unit or the common area, a category (its SLA hours start
 * now, D-159), priority, what is wrong and photos (`service_photo`). The API answers its reference; the page
 * opens it.
 */
export function NewRequestButton({
  buildingId,
  units,
  categories,
}: {
  buildingId: string;
  units: Unit[];
  categories: Category[];
}) {
  const t = useTranslations("owner.service.new");
  const priorities = useTranslations("status.priority");
  const router = useRouter();
  const locale = useLocale() as Locale;
  const [unitId, setUnitId] = useState("");
  const photos = usePhotoUploads({
    kind: "service_photo",
    scopeType: unitId ? "unit" : "building",
    scopeId: unitId || buildingId,
  });
  const categoryOptions = useCategoryOptions(categories);
  return (
    <FormDialog
      label={t("action")}
      icon={IconAdd}
      variant="primary"
      testId="new-request"
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/service-requests", {
            body: {
              unitId: text(data, "unitId") ?? null,
              buildingId: text(data, "unitId") ? null : buildingId,
              categoryId: text(data, "categoryId") ?? "",
              priority: (text(data, "priority") ?? "normal") as Schemas["ServicePriority"],
              description: text(data, "description") ?? "",
              photoDocumentIds: photos.ids.length ? photos.ids : undefined,
            },
          }),
        )
      }
      onDone={(result) => {
        photos.reset();
        router.push(ownerPath(locale, `/service-requests/${(result as Schemas["ServiceRequestDto"]).id}`));
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("unit")} hint={t("unitHint")} error={errors.unitId}>
              <NativeSelect
                name="unitId"
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
                placeholder={t("commonArea")}
                options={units.map((unit) => ({ value: unit.id, label: unit.unitNo }))}
                data-testid="request-unit"
              />
            </Field>
            <Field label={t("category")} required error={errors.categoryId}>
              <NativeSelect
                name="categoryId"
                required
                placeholder={t("chooseCategory")}
                options={categoryOptions}
                data-testid="request-category"
              />
            </Field>
            <Field label={t("priority")} error={errors.priority}>
              <NativeSelect
                name="priority"
                defaultValue="normal"
                options={PRIORITIES.map((value) => ({ value, label: priorities(value) }))}
              />
            </Field>
          </div>
          <Field label={t("description")} required error={errors.description}>
            <Textarea name="description" rows={3} required data-testid="request-description" />
          </Field>
          <PhotoUploadField uploads={photos} label={t("photos")} testId="request-photos" />
        </>
      )}
    </FormDialog>
  );
}

/**
 * The request's actions, exactly as the API offers them (`nextActions`): triage (category, priority — only
 * while `new`), create a work order (assigned to staff or an external technician, with a visit window),
 * close / reopen once the work is done, cancel with a reason (the resident is told).
 */
export function RequestActions({
  request,
  categories,
  members,
}: {
  request: Pick<
    Schemas["ServiceRequestDto"],
    "id" | "ref" | "nextActions" | "category" | "priority" | "unitNo" | "description"
  >;
  categories: Category[];
  members: FieldMember[];
}) {
  const t = useTranslations("owner.service.request");
  const priorities = useTranslations("status.priority");
  const kinds = useTranslations("owner.service.kind");
  const router = useRouter();
  const locale = useLocale() as Locale;
  const [reason, setReason] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const can = (name: string) => request.nextActions.includes(name);
  const path = { serviceRequestId: request.id };
  const categoryOptions = useCategoryOptions(categories);
  const subject = { ref: request.ref, unit: request.unitNo ?? t("commonArea") };

  return (
    <div className="flex flex-wrap gap-2" data-testid="request-actions">
      {can("triage") ? (
        <FormDialog
          label={t("triage")}
          icon={IconFilter}
          testId="request-triage"
          title={t("triageTitle", subject)}
          description={t("triageBody")}
          submitLabel={t("triage")}
          successMessage={t("triaged")}
          onSubmit={(data) =>
            unwrap(
              browserApi().POST("/v1/owner/service-requests/{serviceRequestId}/actions/triage", {
                params: { path },
                body: {
                  categoryId: text(data, "categoryId"),
                  priority: text(data, "priority") as Schemas["ServicePriority"] | undefined,
                },
              }),
            )
          }
        >
          {(errors) => (
            <>
              <Field label={t("category")} error={errors.categoryId}>
                <NativeSelect name="categoryId" defaultValue={request.category.id} options={categoryOptions} />
              </Field>
              <Field label={t("priority")} error={errors.priority}>
                <NativeSelect
                  name="priority"
                  defaultValue={request.priority}
                  options={PRIORITIES.map((value) => ({ value, label: priorities(value) }))}
                  data-testid="triage-priority"
                />
              </Field>
            </>
          )}
        </FormDialog>
      ) : null}
      {can("create-work-order") ? (
        <FormDialog
          label={t("createWorkOrder")}
          icon={IconWrench}
          variant="primary"
          testId="request-create-work-order"
          title={t("createTitle", subject)}
          description={t("createBody")}
          submitLabel={t("createSubmit")}
          successMessage={t("created")}
          size_="lg"
          onSubmit={(data) =>
            unwrap(
              browserApi().POST("/v1/owner/service-requests/{serviceRequestId}/work-orders", {
                params: { path },
                body: {
                  title: text(data, "title") ?? "",
                  kind: (text(data, "kind") ?? "repair") as Schemas["WorkOrderKind"],
                  description: text(data, "description") ?? null,
                  assigneeUserId: text(data, "assigneeUserId") ?? null,
                  assigneePartyId: text(data, "assigneePartyId") ?? null,
                  scheduledAt: bangkokInstant(text(data, "scheduledAt")) ?? null,
                  scheduledUntil: bangkokInstant(text(data, "scheduledUntil")) ?? null,
                },
              }),
            )
          }
          onDone={(result) => router.push(ownerPath(locale, `/work-orders/${(result as Schemas["WorkOrderDto"]).id}`))}
        >
          {(errors) => (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("woTitle")} required error={errors.title}>
                  <Input
                    name="title"
                    required
                    defaultValue={request.description.slice(0, 80)}
                    data-testid="work-order-title"
                  />
                </Field>
                <Field label={t("kind")} error={errors.kind}>
                  <NativeSelect
                    name="kind"
                    defaultValue="repair"
                    options={KINDS.map((value) => ({ value, label: kinds(value) }))}
                  />
                </Field>
              </div>
              <Field label={t("woDescription")} error={errors.description}>
                <Textarea name="description" rows={2} />
              </Field>
              <AssigneeFields members={members} errors={errors} />
              <VisitWindowFields errors={errors} />
            </>
          )}
        </FormDialog>
      ) : null}
      {can("close") ? (
        <ConfirmAction
          label={t("close")}
          icon={IconCheck}
          variant="secondary"
          testId="request-close"
          title={t("closeTitle", subject)}
          description={t("closeBody")}
          confirmLabel={t("close")}
          successMessage={t("closed")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/owner/service-requests/{serviceRequestId}/actions/close", { params: { path } }),
            )
          }
        />
      ) : null}
      {can("reopen") ? (
        <ConfirmAction
          label={t("reopen")}
          icon={IconRefresh}
          variant="secondary"
          testId="request-reopen"
          title={t("reopenTitle", subject)}
          description={t("reopenBody")}
          confirmLabel={t("reopen")}
          ready={reason.trim().length > 0}
          successMessage={t("reopened")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/owner/service-requests/{serviceRequestId}/actions/reopen", {
                params: { path },
                body: { reason: reason.trim() },
              }),
            )
          }
        >
          <Field label={t("reason")} required>
            <Textarea
              rows={2}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              data-testid="reopen-reason"
            />
          </Field>
        </ConfirmAction>
      ) : null}
      {can("cancel") ? (
        <ConfirmAction
          label={t("cancel")}
          icon={IconXCircle}
          variant="destructive"
          tone="destructive"
          testId="request-cancel"
          title={t("cancelTitle", subject)}
          description={t("cancelBody")}
          confirmLabel={t("cancel")}
          ready={cancelReason.trim().length > 0}
          successMessage={t("cancelled")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/owner/service-requests/{serviceRequestId}/actions/cancel", {
                params: { path },
                body: { reason: cancelReason.trim() },
              }),
            )
          }
        >
          <Field label={t("reason")} required hint={t("cancelHint")}>
            <Textarea
              rows={2}
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              data-testid="cancel-reason"
            />
          </Field>
        </ConfirmAction>
      ) : null}
    </div>
  );
}
