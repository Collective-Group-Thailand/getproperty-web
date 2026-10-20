import { getLocale, getTranslations } from "next-intl/server";

import { PRIORITY_STATUS } from "@/domain/status/priority";
import { SERVICE_REQUEST_STATUS } from "@/domain/status/serviceRequest";
import { WORK_ORDER_STATUS } from "@/domain/status/workOrder";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import { BigActionButton } from "@/ui/components/BigActionButton";
import { Callout } from "@/ui/components/Callout";
import { IconTicket } from "@/ui/icons/glyphs/ticket";
import { IconWrench } from "@/ui/icons/glyphs/wrench";

import { BuildingSelect } from "../shared/BuildingSelect";
import type { StaffScope } from "../shared/server";

/**
 * Work orders (F4 4.4, D-072): my active work orders in the focused building, by visit time, and the open
 * service requests of the building — a request can be triaged or taken (a work order assigned to me).
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
    <div className="flex flex-col gap-6 py-6" data-testid="staff-work-orders">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <BuildingSelect buildings={scope.buildings} buildingId={scope.buildingId} />
      </header>
      <section aria-labelledby="my-work" className="flex flex-col gap-3">
        <h2 id="my-work" className="text-lg font-semibold">
          {t("mine")}
        </h2>
        {mine === null ? (
          <Callout tone="warning">{t("unavailable")}</Callout>
        ) : mine.length === 0 ? (
          <p className="text-muted">{t("noneMine")}</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="my-work-orders">
            {mine.map((workOrder) => (
              <li key={workOrder.id} className="flex flex-col gap-1">
                <BigActionButton
                  href={`/work-orders/${workOrder.id}`}
                  icon={IconWrench}
                  tone={workOrder.status === "in_progress" ? "primary" : "default"}
                  title={
                    workOrder.unitNo
                      ? t("titleUnit", { title: workOrder.title, unit: workOrder.unitNo })
                      : workOrder.title
                  }
                  description={
                    workOrder.scheduledAt
                      ? t("visit", { at: formatDateTime(workOrder.scheduledAt, locale) })
                      : t("noVisit")
                  }
                />
                <span className="flex flex-wrap gap-2">
                  <StatusBadgeOf map={WORK_ORDER_STATUS} value={workOrder.status} size="sm" />
                  <StatusBadgeOf map={PRIORITY_STATUS} value={workOrder.priority} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="open-requests" className="flex flex-col gap-3">
        <h2 id="open-requests" className="text-lg font-semibold">
          {t("requests")}
        </h2>
        {requests === null ? (
          <Callout tone="warning">{t("unavailable")}</Callout>
        ) : requests.length === 0 ? (
          <p className="text-muted">{t("noneRequests")}</p>
        ) : (
          <ul className="flex flex-col gap-3" data-testid="open-requests">
            {requests.map((request) => (
              <li key={request.id} className="flex flex-col gap-1">
                <BigActionButton
                  href={`/service-requests/${request.id}`}
                  icon={IconTicket}
                  title={`${request.ref} · ${request.unitNo ?? t("commonArea")}`}
                  description={request.description}
                />
                <span className="flex flex-wrap gap-2">
                  <StatusBadgeOf map={SERVICE_REQUEST_STATUS} value={request.status} size="sm" />
                  <StatusBadgeOf map={PRIORITY_STATUS} value={request.priority} size="sm" />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
