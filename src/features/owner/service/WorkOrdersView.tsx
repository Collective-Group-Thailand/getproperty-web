import { getTranslations } from "next-intl/server";

import { WORK_ORDER_STATUS, WORK_ORDER_VALUES } from "@/domain/status/workOrder";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { enumParam } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { IconWrench } from "@/ui/icons/glyphs/wrench";

import { ownerPath, withQuery } from "../shared/links";
import { focusedBuilding, pageParam, param, type OwnerContext } from "../shared/server";
import { viewCounts } from "../shared/views";

type SearchParams = Record<string, string | string[] | undefined>;
const KINDS: Schemas["WorkOrderKind"][] = ["repair", "preventive", "install", "deinstall", "inspection"];

/**
 * Work orders (F2 2.7; G4): the focused building's jobs by visit time — figures from the API (active, not assigned,
 * in progress, done and waiting for the owner's check), one toolbar (active · waiting for the check · all, search,
 * status, kind) and rows that open the work order: what, where, who, when, status and the API's cost total.
 */
export async function WorkOrdersView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.service.workOrders");
  const kinds = await getTranslations("owner.service.kind");
  const statuses = await getTranslations("status.workOrder");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const status = enumParam(searchParams.status, WORK_ORDER_VALUES);
  const kind = enumParam(searchParams.kind, KINDS);
  const view = param(searchParams.view) === "all" ? "all" : "active";
  const base = { buildingId: building?.id };
  const count = (query: { active?: boolean; status?: Schemas["WorkOrderStatus"] }) =>
    unwrap(api.GET("/v1/owner/work-orders", { params: { query: { ...base, ...query, perPage: 1 } } }));
  const [list, counts] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/work-orders", {
        params: {
          query: {
            ...base,
            page: pageParam(searchParams.page),
            perPage: 25,
            status,
            kind,
            active: !status && view === "active" ? true : undefined,
            q: param(searchParams.q),
          },
        },
      }),
    ),
    viewCounts(["active", "open", "in_progress", "done"] as const, (key) =>
      key === "active" ? count({ active: true }) : count({ status: key }),
    ),
  ]);
  const path = (query: Record<string, string | undefined>) => ownerPath(locale, withQuery("/work-orders", query));
  const figure = (value: number | undefined) => (value === undefined ? "—" : formatNumber(value, locale));
  const filtered = Boolean(param(searchParams.q) || kind || (status && status !== "done"));
  const current = status === "done" ? "done" : status ? "" : view;

  return (
    <OwnerPage testId="work-orders">
      <PageHeader title={t("title")} description={t("description")} />
      <StatsRow
        label={t("figures.label")}
        highlight={counts.done ? "done" : counts.open ? "open" : undefined}
        figures={[
          { key: "active", label: t("figures.active"), value: figure(counts.active), href: path({}) },
          { key: "open", label: t("figures.open"), value: figure(counts.open), href: path({ status: "open" }) },
          {
            key: "in_progress",
            label: t("figures.inProgress"),
            value: figure(counts.in_progress),
            href: path({ status: "in_progress" }),
          },
          { key: "done", label: t("figures.done"), value: figure(counts.done), href: path({ status: "done" }) },
        ]}
      />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("filter.view")}
            current={current}
            tabs={[
              { key: "active", href: path({}), label: t("filter.active"), count: counts.active, testId: "view-active" },
              {
                key: "done",
                href: path({ status: "done" }),
                label: t("filter.toVerify"),
                count: counts.done,
                testId: "view-done",
              },
              { key: "all", href: path({ view: "all" }), label: t("filter.all"), testId: "view-all" },
            ]}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
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
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconWrench}
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredBody") : t("empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? path({}) : ownerPath(locale, "/service-requests")}>
                {filtered ? t("empty.clear") : t("empty.requests")}
              </a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="work-order-table"
          stackOnPhones
          minWidth="56rem"
          columns={[
            { key: "title", header: t("col.title"), phone: "title" },
            { key: "assignee", header: t("col.assignee"), phone: "meta", className: "md:w-48" },
            { key: "visit", header: t("col.visit"), phone: "meta", className: "md:w-44" },
            { key: "status", header: t("col.status"), phone: "status", className: "md:w-36" },
            { key: "cost", header: t("col.cost"), align: "end", phone: "figure", className: "md:w-32" },
          ]}
          rows={list.data.map((workOrder) => ({
            key: workOrder.id,
            href: ownerPath(locale, `/work-orders/${workOrder.id}`),
            testId: "work-order-row",
            data: { status: workOrder.status },
            cells: {
              title: (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="line-clamp-2">{workOrder.title}</span>
                  <span className="text-muted text-sm font-normal">
                    {kinds(workOrder.kind)} ·{" "}
                    {workOrder.unitNo ? <span className="font-mono">{workOrder.unitNo}</span> : t("commonArea")}
                  </span>
                </span>
              ),
              assignee: workOrder.assignee ? (
                <span className="flex flex-col">
                  <span>{workOrder.assignee.displayName}</span>
                  <span className="text-muted text-sm max-md:hidden">
                    {t(`assigneeType.${workOrder.assignee.type}`)}
                  </span>
                </span>
              ) : (
                <span className="text-muted">{t("unassigned")}</span>
              ),
              visit: workOrder.scheduledAt ? (
                <span className="whitespace-nowrap tabular-nums">{formatDateTime(workOrder.scheduledAt, locale)}</span>
              ) : (
                <span className="text-muted">{t("noVisit")}</span>
              ),
              status: <StatusBadgeOf map={WORK_ORDER_STATUS} value={workOrder.status} size="sm" />,
              cost: <span className="whitespace-nowrap tabular-nums">{formatTHB(workOrder.costTotal, locale)}</span>,
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
