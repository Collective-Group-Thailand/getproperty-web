import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PRIORITY_STATUS } from "@/domain/status/priority";
import { SERVICE_REQUEST_STATUS } from "@/domain/status/serviceRequest";
import { WORK_ORDER_STATUS } from "@/domain/status/workOrder";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { section } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatRelativeTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Timeline } from "@/ui/components/Timeline";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconTimer } from "@/ui/icons/glyphs/timer";

import { ownerPath } from "../shared/links";
import { fieldMembers } from "../shared/members";
import { PhotoThumb } from "../shared/PhotoThumb";
import { ownerCan, readOnly, type OwnerContext } from "../shared/server";
import { RequestActions } from "./RequestActions";
import { categoryName, serviceCategories } from "./server";
import { SlaTimer } from "./SlaTimer";
import { currentTime } from "@/features/shared/console/time";

/**
 * One service request (F2 2.7): what was reported (place, category, priority, reporter, photos), its SLA, the
 * work orders opened for it, the timeline of the workflow (state changes, SLA warning and breach) and the
 * actions the API allows now.
 */
export async function RequestDetail({
  context,
  serviceRequestId,
}: {
  context: OwnerContext;
  serviceRequestId: string;
}) {
  const t = await getTranslations("owner.service.request");
  const reporter = await getTranslations("owner.service.reporter");
  const kinds = await getTranslations("owner.service.kind");
  const events = await getTranslations("owner.service.timeline");
  const statuses = await getTranslations("status.serviceRequest");
  const statusLabel = (value: string) => (statuses.has(value) ? statuses(value) : value);
  const { api, locale, me } = context;
  const request = await unwrap(
    api.GET("/v1/owner/service-requests/{serviceRequestId}", { params: { path: { serviceRequestId } } }),
  ).catch((error: unknown) => {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  });
  const [timeline, categories, members] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/service-requests/{serviceRequestId}/timeline", { params: { path: { serviceRequestId } } }),
      ),
    ),
    serviceCategories(api),
    fieldMembers(api, request.buildingId),
  ]);
  const building = context.buildings.find((candidate) => candidate.id === request.buildingId);
  const canHandle = ownerCan(me, "service_request.handle") && !readOnly(me);
  const now = currentTime();

  return (
    <OwnerPage testId="service-request">
      <PageHeader
        title={request.ref}
        testId="request-title"
        status={<StatusBadgeOf map={SERVICE_REQUEST_STATUS} value={request.status} />}
        description={t("subtitle", {
          category: categoryName(request.category, locale),
          place: request.unitNo ?? t("commonArea"),
          building: building?.name ?? "",
        })}
        crumbs={[{ label: t("crumb"), href: ownerPath(locale, "/service-requests") }, { label: request.ref }]}
        actions={
          canHandle ? (
            <RequestActions
              request={request}
              categories={categories.map(({ id, nameTh, nameEn, slaHours }) => ({ id, nameTh, nameEn, slaHours }))}
              members={members}
            />
          ) : null
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" as="section" aria-labelledby="request-facts">
          <CardHeader title={<span id="request-facts">{t("facts")}</span>} />
          <p className="mb-4 whitespace-pre-line" data-testid="request-description">
            {request.description}
          </p>
          <DescriptionList
            columns={2}
            items={[
              {
                id: "priority",
                term: t("priority"),
                description: <StatusBadgeOf map={PRIORITY_STATUS} value={request.priority} size="sm" />,
              },
              {
                id: "reporter",
                term: t("reporter"),
                description:
                  request.reporterKind === "system"
                    ? t("automatic", {
                        reason: request.autoReason ?? "",
                      })
                    : reporter(request.reporterKind, { name: request.requesterName ?? "" }),
              },
              { id: "reported", term: t("reportedAt"), description: formatDateTime(request.createdAt, locale) },
              {
                id: "triaged",
                term: t("triagedAt"),
                description: request.triagedAt ? formatDateTime(request.triagedAt, locale) : null,
              },
              {
                id: "done",
                term: t("doneAt"),
                description: request.doneAt ? formatDateTime(request.doneAt, locale) : null,
              },
              {
                id: "rating",
                term: t("rating"),
                description:
                  request.rating !== null
                    ? t("ratingValue", { rating: request.rating, comment: request.ratingComment ?? "" })
                    : null,
              },
              ...(request.cancelReason
                ? [{ id: "cancel", term: t("cancelReason"), description: request.cancelReason, wide: true }]
                : []),
            ]}
          />
          {request.inWarranty ? (
            <p className="mt-4 flex items-center gap-2 text-sm" data-testid="request-warranty">
              <Badge tone="info" size="sm" icon={IconShield}>
                {t("warranty")}
              </Badge>
              {t("warrantyBody", { resolution: request.warrantyResolution ?? t("warrantyPending") })}
            </p>
          ) : null}
          {request.photoIds.length ? (
            <div className="mt-4 flex flex-wrap gap-2" data-testid="request-photos">
              {request.photoIds.map((photoId, index) => (
                <PhotoThumb
                  key={photoId}
                  fileId={photoId}
                  alt={t("photoAlt", { ref: request.ref, index: index + 1 })}
                />
              ))}
            </div>
          ) : null}
        </Card>
        <Card as="section" aria-labelledby="request-sla" data-testid="request-sla">
          <CardHeader title={<span id="request-sla">{t("sla")}</span>} />
          <SlaTimer request={request} locale={locale} now={now} />
          <p className="text-muted mt-2 text-sm">{t("slaHours", { hours: request.slaHours })}</p>
        </Card>
      </div>

      <Card as="section" aria-labelledby="request-work-orders" data-testid="request-work-orders">
        <CardHeader title={<span id="request-work-orders">{t("workOrders")}</span>} />
        {request.workOrders.length ? (
          <ul className="divide-border flex flex-col divide-y text-sm">
            {request.workOrders.map((workOrder) => (
              <li
                key={workOrder.id}
                className="flex flex-wrap items-center gap-3 py-2"
                data-testid="request-work-order"
              >
                <a
                  className="font-medium underline-offset-4 hover:underline"
                  href={ownerPath(locale, `/work-orders/${workOrder.id}`)}
                >
                  {workOrder.title}
                </a>
                <span className="text-muted">{kinds(workOrder.kind)}</span>
                <StatusBadgeOf map={WORK_ORDER_STATUS} value={workOrder.status} size="sm" />
                {workOrder.scheduledAt ? (
                  <span className="text-muted">
                    {t("visit", { at: formatDateTime(workOrder.scheduledAt, locale) })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted text-sm">{t("noWorkOrders")}</p>
        )}
      </Card>

      <Card as="section" aria-labelledby="request-timeline" data-testid="request-timeline">
        <CardHeader title={<span id="request-timeline">{t("timeline")}</span>} />
        {timeline.error ? (
          <SectionError error={timeline.error} />
        ) : (
          <Timeline
            events={(timeline.data?.data ?? []).map((entry, index) => ({
              id: `${entry.at}-${index}`,
              title: events.has(entry.event) ? events(entry.event) : entry.event,
              time: formatRelativeTime(entry.at, locale, now),
              timeTitle: formatDateTime(entry.at, locale),
              description: entry.from
                ? t("transition", { from: statusLabel(entry.from), to: statusLabel(entry.to) })
                : null,
              icon: entry.event === "sla.breached" ? IconAlert : entry.event === "sla.warning" ? IconTimer : undefined,
              tone: entry.event === "sla.breached" ? "danger" : entry.event === "sla.warning" ? "warning" : "neutral",
            }))}
          />
        )}
      </Card>
    </OwnerPage>
  );
}
