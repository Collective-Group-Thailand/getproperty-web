import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PRIORITY_STATUS } from "@/domain/status/priority";
import { WORK_ORDER_STATUS } from "@/domain/status/workOrder";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { ownerPath } from "../shared/links";
import { fieldMembers } from "../shared/members";
import { PhotoThumb } from "../shared/PhotoThumb";
import { ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { AddCostLine, RemoveCostLine, WorkOrderActions, WorkOrderPhotoUpload } from "./WorkOrderActions";

const PHOTO_OPEN: Schemas["WorkOrderStatus"][] = ["assigned", "accepted", "in_progress", "done"];
const COST_OPEN: Schemas["WorkOrderStatus"][] = ["open", "assigned", "accepted", "in_progress", "done"];

/**
 * One work order (F2 2.7, D-072, D-210): the request it serves, assignee and visit window, the field steps'
 * times, before / after photos, cost lines with the API's total (income & expense by completion month), and the
 * steps the API allows now — verification is the owner's.
 */
export async function WorkOrderDetail({ context, workOrderId }: { context: OwnerContext; workOrderId: string }) {
  const t = await getTranslations("owner.service.workOrder");
  const kinds = await getTranslations("owner.service.kind");
  const costT = await getTranslations("owner.service.cost");
  const { api, locale, me } = context;
  const workOrder = await unwrap(
    api.GET("/v1/owner/work-orders/{workOrderId}", { params: { path: { workOrderId } } }),
  ).catch((error: unknown) => {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  });
  const [request, members] = await Promise.all([
    workOrder.serviceRequestId
      ? unwrap(
          api.GET("/v1/owner/service-requests/{serviceRequestId}", {
            params: { path: { serviceRequestId: workOrder.serviceRequestId } },
          }),
        ).catch(() => null)
      : Promise.resolve(null),
    fieldMembers(api, workOrder.buildingId),
  ]);
  const canHandle = ownerCan(me, "service_request.handle") && !readOnly(me);
  const building = context.buildings.find((candidate) => candidate.id === workOrder.buildingId);
  const photos = (ids: string[], role: "before" | "after") =>
    ids.length ? (
      <div className="flex flex-wrap gap-2" data-testid={`work-order-${role}`}>
        {ids.map((id, index) => (
          <PhotoThumb key={id} fileId={id} alt={t(`${role}Alt`, { title: workOrder.title, index: index + 1 })} />
        ))}
      </div>
    ) : (
      <p className="text-muted text-sm">{t("noPhotos")}</p>
    );

  return (
    <OwnerPage testId="work-order">
      <PageHeader
        title={workOrder.title}
        testId="work-order-title"
        status={<StatusBadgeOf map={WORK_ORDER_STATUS} value={workOrder.status} />}
        description={t("subtitle", {
          kind: kinds(workOrder.kind),
          place: workOrder.unitNo ?? t("commonArea"),
          building: building?.name ?? "",
        })}
        crumbs={[{ label: t("crumb"), href: ownerPath(locale, "/work-orders") }, { label: workOrder.title }]}
        actions={canHandle ? <WorkOrderActions workOrder={workOrder} members={members} /> : null}
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" as="section" aria-labelledby="work-order-facts">
          <CardHeader title={<span id="work-order-facts">{t("facts")}</span>} />
          {workOrder.description ? <p className="mb-4 whitespace-pre-line">{workOrder.description}</p> : null}
          <DescriptionList
            columns={2}
            items={[
              {
                id: "assignee",
                term: t("assignee"),
                description: workOrder.assignee ? (
                  <span data-testid="work-order-assignee">
                    {workOrder.assignee.displayName} · {t(`assigneeType.${workOrder.assignee.type}`)}
                  </span>
                ) : (
                  t("unassigned")
                ),
              },
              {
                id: "priority",
                term: t("priority"),
                description: <StatusBadgeOf map={PRIORITY_STATUS} value={workOrder.priority} size="sm" />,
              },
              {
                id: "visit",
                term: t("visit"),
                description: workOrder.scheduledAt
                  ? t("visitWindow", {
                      from: formatDateTime(workOrder.scheduledAt, locale),
                      until: workOrder.scheduledUntil ? formatDateTime(workOrder.scheduledUntil, locale) : "—",
                    })
                  : null,
              },
              {
                id: "request",
                term: t("request"),
                description: request ? (
                  <a
                    className="underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/service-requests/${request.id}`)}
                    data-testid="work-order-request"
                  >
                    {request.ref}
                  </a>
                ) : workOrder.maintenancePlanId ? (
                  t("preventive")
                ) : null,
              },
              {
                id: "checkedIn",
                term: t("checkedInAt"),
                description: workOrder.checkedInAt ? formatDateTime(workOrder.checkedInAt, locale) : null,
              },
              {
                id: "completed",
                term: t("completedAt"),
                description: workOrder.completedAt ? formatDateTime(workOrder.completedAt, locale) : null,
              },
              {
                id: "verified",
                term: t("verifiedAt"),
                description: workOrder.verifiedAt ? formatDateTime(workOrder.verifiedAt, locale) : null,
              },
              { id: "note", term: t("completionNote"), description: workOrder.completionNote, wide: true },
              ...(workOrder.cancelReason
                ? [{ id: "cancel", term: t("cancelReason"), description: workOrder.cancelReason, wide: true }]
                : []),
            ]}
          />
        </Card>
        <Card as="section" aria-labelledby="work-order-request-card">
          <CardHeader title={<span id="work-order-request-card">{t("reported")}</span>} />
          {request ? (
            <>
              <p className="text-sm whitespace-pre-line">{request.description}</p>
              {request.photoIds.length ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {request.photoIds.map((id, index) => (
                    <PhotoThumb key={id} fileId={id} alt={t("reportedAlt", { index: index + 1 })} size="sm" />
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-muted text-sm">{t("noRequest")}</p>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {(["before", "after"] as const).map((role) => (
          <Card key={role} as="section" aria-labelledby={`photos-${role}-title`} data-testid={`photos-${role}-card`}>
            <CardHeader title={<span id={`photos-${role}-title`}>{t(role)}</span>} />
            {photos(role === "before" ? workOrder.beforePhotoIds : workOrder.afterPhotoIds, role)}
            {canHandle && PHOTO_OPEN.includes(workOrder.status) ? (
              <div className="mt-3">
                <WorkOrderPhotoUpload workOrder={workOrder} role={role} />
              </div>
            ) : null}
          </Card>
        ))}
      </div>

      <Card as="section" aria-labelledby="work-order-costs" data-testid="work-order-costs">
        <CardHeader
          title={<span id="work-order-costs">{costT("title")}</span>}
          description={costT("hint")}
          action={canHandle && COST_OPEN.includes(workOrder.status) ? <AddCostLine workOrder={workOrder} /> : null}
        />
        {workOrder.costLines.length ? (
          <SimpleTable
            caption={costT("title")}
            minWidth="36rem"
            columns={[
              { key: "description", header: costT("description") },
              { key: "kind", header: costT("kind") },
              { key: "quantity", header: costT("quantity"), align: "end" },
              { key: "unitPrice", header: costT("unitPrice"), align: "end" },
              { key: "amount", header: costT("amount"), align: "end" },
              { key: "actions", header: <span className="sr-only">{costT("actions")}</span> },
            ]}
            rows={workOrder.costLines.map((line) => ({
              key: line.id,
              testId: "cost-row",
              cells: {
                description: (
                  <span className="flex items-center gap-2">
                    {line.description}
                    {line.receiptDocumentId ? (
                      <PhotoThumb
                        fileId={line.receiptDocumentId}
                        alt={costT("receiptAlt", { description: line.description })}
                        size="sm"
                      />
                    ) : null}
                  </span>
                ),
                kind: costT(`kinds.${line.kind}`),
                quantity: line.quantity,
                unitPrice: formatTHB(line.unitPrice, locale),
                amount: formatTHB(line.amount, locale),
                actions:
                  canHandle && COST_OPEN.includes(workOrder.status) ? (
                    <RemoveCostLine workOrderId={workOrder.id} line={line} />
                  ) : null,
              },
            }))}
          />
        ) : (
          <p className="text-muted text-sm">{costT("none")}</p>
        )}
        <p className="mt-3 text-end font-semibold" data-testid="work-order-cost-total">
          {costT("total", { total: formatTHB(workOrder.costTotal, locale) })}
        </p>
      </Card>
    </OwnerPage>
  );
}
