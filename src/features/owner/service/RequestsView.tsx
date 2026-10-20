import { getTranslations } from "next-intl/server";

import { PRIORITY_STATUS } from "@/domain/status/priority";
import { SERVICE_REQUEST_STATUS, SERVICE_REQUEST_VALUES } from "@/domain/status/serviceRequest";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { enumParam } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconShield } from "@/ui/icons/glyphs/shield";

import { ownerPath, withQuery } from "../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, type OwnerContext } from "../shared/server";
import { NewRequestButton } from "./RequestActions";
import { buildingUnits, categoryName, serviceCategories } from "./server";
import { ServiceNav } from "./ServiceNav";
import { SlaTimer } from "./SlaTimer";
import { currentTime } from "@/features/shared/console/time";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The service requests inbox (F2 2.7, D-072, D-159): the focused building's requests, open first by default,
 * each with reference, place, category, priority, who reported it (automatic requests with their reason),
 * the SLA clock and the warranty referral mark; filters in the URL; a new request from the console.
 */
export async function RequestsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.service.list");
  const reporter = await getTranslations("owner.service.reporter");
  const statuses = await getTranslations("status.serviceRequest");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const view = param(searchParams.view) ?? "open";
  const status = enumParam(searchParams.status, SERVICE_REQUEST_VALUES);
  const sla = enumParam(searchParams.sla, ["breached"] as const);
  const now = currentTime();
  const [list, categories, units] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/service-requests", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            buildingId: building?.id,
            status,
            open: !status && view === "open" ? true : undefined,
            categoryId: param(searchParams.category),
            inWarranty: param(searchParams.warranty) === "true" ? true : undefined,
            slaBreached: sla === "breached" ? true : undefined,
            q: param(searchParams.q),
          },
        },
      }),
    ),
    serviceCategories(api),
    building ? buildingUnits(api, building.id) : Promise.resolve([]),
  ]);
  const canHandle = ownerCan(me, "service_request.handle") && !readOnly(me);

  return (
    <OwnerPage testId="service-requests">
      <PageHeader
        title={t("title")}
        description={building ? t("descriptionBuilding", { building: building.name }) : t("description")}
        crumbs={[{ label: t("title") }]}
        actions={
          canHandle && building ? (
            <NewRequestButton
              buildingId={building.id}
              units={units}
              categories={categories.map(({ id, nameTh, nameEn, slaHours }) => ({ id, nameTh, nameEn, slaHours }))}
            />
          ) : null
        }
      />
      <ServiceNav current="/service-requests" locale={locale} />
      <FilterBar
        fields={[
          { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
          {
            name: "view",
            label: t("filter.view"),
            type: "select",
            placeholder: t("filter.open"),
            options: [{ value: "all", label: t("filter.all") }],
          },
          {
            name: "status",
            label: t("filter.status"),
            type: "select",
            placeholder: t("filter.anyStatus"),
            options: SERVICE_REQUEST_VALUES.map((value) => ({ value, label: statuses(value) })),
          },
          {
            name: "category",
            label: t("filter.category"),
            type: "select",
            placeholder: t("filter.anyCategory"),
            options: categories.map((category) => ({ value: category.id, label: categoryName(category, locale) })),
          },
          {
            name: "sla",
            label: t("filter.sla"),
            type: "select",
            placeholder: t("filter.anySla"),
            options: [{ value: "breached", label: t("filter.slaBreached") }],
          },
          {
            name: "warranty",
            label: t("filter.warranty"),
            type: "select",
            placeholder: t("filter.anyWarranty"),
            options: [{ value: "true", label: t("filter.inWarranty") }],
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconCheckCircle} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="request-table"
          minWidth="56rem"
          columns={[
            { key: "ref", header: t("col.ref") },
            { key: "place", header: t("col.place") },
            { key: "problem", header: t("col.problem") },
            { key: "status", header: t("col.status") },
            { key: "sla", header: t("col.sla") },
          ]}
          rows={list.data.map((request) => ({
            key: request.id,
            testId: "request-row",
            data: { status: request.status, breached: request.slaBreached, ref: request.ref },
            tone: request.slaBreached ? "danger" : "default",
            cells: {
              ref: (
                <span className="flex flex-col">
                  <a
                    className="font-mono font-semibold underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/service-requests/${request.id}`)}
                  >
                    {request.ref}
                  </a>
                  <span className="text-muted text-xs">{formatDateTime(request.createdAt, locale)}</span>
                </span>
              ),
              place: request.unitNo ? (
                <span className="font-mono">{request.unitNo}</span>
              ) : (
                <span className="text-muted">{t("commonArea")}</span>
              ),
              problem: (
                <span className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{categoryName(request.category, locale)}</span>
                    <StatusBadgeOf map={PRIORITY_STATUS} value={request.priority} size="sm" />
                    {request.inWarranty ? (
                      <Badge tone="info" size="sm" icon={IconShield}>
                        {t("warranty")}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="line-clamp-2">{request.description}</span>
                  <span className="text-muted text-xs">
                    {request.reporterKind === "system" && request.autoReason
                      ? t("auto", {
                          reason: t.has(`autoReason.${request.autoReason}`)
                            ? t(`autoReason.${request.autoReason}`)
                            : request.autoReason,
                        })
                      : reporter(request.reporterKind, { name: request.requesterName ?? "" })}
                  </span>
                </span>
              ),
              status: <StatusBadgeOf map={SERVICE_REQUEST_STATUS} value={request.status} size="sm" />,
              sla: <SlaTimer request={request} locale={locale} now={now} />,
            },
          }))}
        />
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, withQuery("/service-requests", {}))}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
