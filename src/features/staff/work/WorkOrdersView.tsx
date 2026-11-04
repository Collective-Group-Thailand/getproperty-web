import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";

import { PRIORITY_STATUS } from "@/domain/status/priority";
import { SERVICE_REQUEST_STATUS } from "@/domain/status/serviceRequest";
import { WORK_ORDER_STATUS } from "@/domain/status/workOrder";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconInbox } from "@/ui/icons/glyphs/inbox";

import { StaffList, StaffSection } from "../shell/StaffList";
import type { StaffScope } from "../shared/server";

/** Normal is the default: only a priority that changes the order of the day earns a badge. */
const priorityBadge = (priority: Schemas["ServicePriority"]) =>
  priority === "high" || priority === "urgent" ? (
    <StatusBadgeOf map={PRIORITY_STATUS} value={priority} size="sm" />
  ) : null;

/**
 * Jobs (F4 4.4, D-072; redesign G7): my active work orders in the focused building, by visit time, then the open
 * service requests of the building — one card each, every row opens its screen (a request is triaged or taken there).
 */
export async function WorkOrdersView({ scope }: { scope: StaffScope }) {
  const t = await getTranslations("staff.work");
  const locale = (await getLocale()) as Locale;
  const buildingId = scope.buildingId ?? undefined;
  const [mine, requests] = await Promise.all([
    unwrap(
      scope.api.GET("/v1/staff/work-orders", {
        params: { query: { mine: true, active: true, buildingId, perPage: 50 } },
      }),
    )
      .then((page) => page.data)
      .catch(() => null),
    unwrap(scope.api.GET("/v1/staff/service-requests", { params: { query: { open: true, buildingId, perPage: 50 } } }))
      .then((page) => page.data.filter((request) => request.status === "new" || request.status === "triaged"))
      .catch(() => null),
  ]);
  return (
    <div className="flex flex-col gap-8 py-6" data-testid="staff-work-orders">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted">{t("lede")}</p>
      </header>

      <StaffSection id="my-work" title={t("mine")} count={mine?.length}>
        {mine === null ? (
          <Callout tone="warning">{t("unavailable")}</Callout>
        ) : mine.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconCheckCircle}
            title={t("noneMine")}
            description={t("noneMineHint")}
            action={
              <Button asChild variant="secondary" size="lg">
                <Link href="/">{t("backToday")}</Link>
              </Button>
            }
          />
        ) : (
          <StaffList
            label={t("mine")}
            testId="my-work-orders"
            groups={[
              {
                key: "mine",
                rows: mine.map((workOrder) => ({
                  key: workOrder.id,
                  href: `/work-orders/${workOrder.id}`,
                  title: workOrder.title,
                  meta: [
                    workOrder.unitNo ? t("unit", { unit: workOrder.unitNo }) : t("commonArea"),
                    workOrder.scheduledAt
                      ? t("visit", { at: formatDateTime(workOrder.scheduledAt, locale) })
                      : t("noVisit"),
                  ].join(" · "),
                  status: (
                    <>
                      <StatusBadgeOf map={WORK_ORDER_STATUS} value={workOrder.status} size="sm" />
                      {priorityBadge(workOrder.priority)}
                    </>
                  ),
                })),
              },
            ]}
          />
        )}
      </StaffSection>

      <StaffSection id="requests-title" title={t("requests")} count={requests?.length}>
        {requests === null ? (
          <Callout tone="warning">{t("unavailable")}</Callout>
        ) : requests.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconInbox}
            title={t("noneRequests")}
            description={t("noneRequestsHint")}
            action={
              <Button asChild variant="secondary" size="lg">
                <Link href="/">{t("backToday")}</Link>
              </Button>
            }
          />
        ) : (
          <StaffList
            label={t("requests")}
            testId="open-requests"
            groups={[
              {
                key: "requests",
                rows: requests.map((request) => ({
                  key: request.id,
                  href: `/service-requests/${request.id}`,
                  lead: request.ref,
                  title: <span className="line-clamp-2">{request.description}</span>,
                  meta: [
                    request.unitNo ? t("unit", { unit: request.unitNo }) : t("commonArea"),
                    t("reportedAt", { at: formatDateTime(request.createdAt, locale) }),
                  ].join(" · "),
                  status: (
                    <>
                      <StatusBadgeOf map={SERVICE_REQUEST_STATUS} value={request.status} size="sm" />
                      {priorityBadge(request.priority)}
                    </>
                  ),
                })),
              },
            ]}
          />
        )}
      </StaffSection>
    </div>
  );
}
