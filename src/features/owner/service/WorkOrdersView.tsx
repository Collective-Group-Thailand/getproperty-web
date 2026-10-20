import { getTranslations } from "next-intl/server";

import { PRIORITY_STATUS } from "@/domain/status/priority";
import { WORK_ORDER_STATUS, WORK_ORDER_VALUES } from "@/domain/status/workOrder";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { enumParam } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconWrench } from "@/ui/icons/glyphs/wrench";

import { ownerPath } from "../shared/links";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";
import { ServiceNav } from "./ServiceNav";

type SearchParams = Record<string, string | string[] | undefined>;
const KINDS: Schemas["WorkOrderKind"][] = ["repair", "preventive", "install", "deinstall", "inspection"];

/**
 * Work orders (F2 2.7): of the focused building by visit time — active ones by default — with assignee (a
 * member in the staff PWA or an external technician in getproperty-liff), visit, status and the API's cost
 * total (it feeds the income & expense export by completion month, D-210).
 */
export async function WorkOrdersView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.service.workOrders");
  const kinds = await getTranslations("owner.service.kind");
  const statuses = await getTranslations("status.workOrder");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const status = enumParam(searchParams.status, WORK_ORDER_VALUES);
  const kind = enumParam(searchParams.kind, KINDS);
  const list = await unwrap(
    api.GET("/v1/owner/work-orders", {
      params: {
        query: {
          page: pageParam(searchParams.page),
          perPage: 25,
          buildingId: building?.id,
          status,
          kind,
          active: !status && param(searchParams.view) !== "all" ? true : undefined,
          q: param(searchParams.q),
        },
      },
    }),
  );
  return (
    <OwnerPage testId="work-orders">
      <PageHeader title={t("title")} description={t("description")} crumbs={[{ label: t("title") }]} />
      <ServiceNav current="/work-orders" locale={locale} />
      <FilterBar
        fields={[
          { name: "q", label: t("filter.search"), type: "search" },
          {
            name: "view",
            label: t("filter.view"),
            type: "select",
            placeholder: t("filter.active"),
            options: [{ value: "all", label: t("filter.all") }],
          },
          {
            name: "status",
            label: t("filter.status"),
            type: "select",
            placeholder: t("filter.anyStatus"),
            options: WORK_ORDER_VALUES.map((value) => ({ value, label: statuses(value) })),
          },
          {
            name: "kind",
            label: t("filter.kind"),
            type: "select",
            placeholder: t("filter.anyKind"),
            options: KINDS.map((value) => ({ value, label: kinds(value) })),
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconWrench} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="work-order-table"
          minWidth="52rem"
          columns={[
            { key: "title", header: t("col.title") },
            { key: "assignee", header: t("col.assignee") },
            { key: "visit", header: t("col.visit") },
            { key: "status", header: t("col.status") },
            { key: "cost", header: t("col.cost"), align: "end" },
          ]}
          rows={list.data.map((workOrder) => ({
            key: workOrder.id,
            testId: "work-order-row",
            data: { status: workOrder.status },
            cells: {
              title: (
                <span className="flex flex-col gap-1">
                  <a
                    className="font-medium underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/work-orders/${workOrder.id}`)}
                  >
                    {workOrder.title}
                  </a>
                  <span className="text-muted flex flex-wrap items-center gap-2 text-xs">
                    {kinds(workOrder.kind)} · {workOrder.unitNo ?? t("commonArea")}
                    <StatusBadgeOf map={PRIORITY_STATUS} value={workOrder.priority} size="sm" />
                  </span>
                </span>
              ),
              assignee: workOrder.assignee ? (
                <span className="flex flex-col">
                  <span>{workOrder.assignee.displayName}</span>
                  <span className="text-muted text-xs">{t(`assigneeType.${workOrder.assignee.type}`)}</span>
                </span>
              ) : (
                <span className="text-muted">{t("unassigned")}</span>
              ),
              visit: workOrder.scheduledAt ? formatDateTime(workOrder.scheduledAt, locale) : "—",
              status: <StatusBadgeOf map={WORK_ORDER_STATUS} value={workOrder.status} size="sm" />,
              cost: formatTHB(workOrder.costTotal, locale),
            },
          }))}
        />
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/work-orders")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
