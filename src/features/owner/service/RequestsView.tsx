import { getTranslations } from "next-intl/server";

import { SERVICE_REQUEST_STATUS, SERVICE_REQUEST_VALUES } from "@/domain/status/serviceRequest";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { enumParam } from "@/features/shared/console/params";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDateTime, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconShield } from "@/ui/icons/glyphs/shield";

import { ownerPath, withQuery } from "../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, type OwnerContext } from "../shared/server";
import { viewCounts } from "../shared/views";
import { NewRequestButton } from "./RequestActions";
import { buildingUnits, categoryName, serviceCategories } from "./server";
import { slaState, SlaTimer } from "./SlaTimer";

type SearchParams = Record<string, string | string[] | undefined>;
type View = "open" | "breached" | "all";
type Request = Schemas["ServiceRequestDto"];

const URGENCY = { breached: 0, warning: 1, ok: 2, none: 3 } as const;

/**
 * The requests in the order a caretaker works them: past their SLA first (the longest overdue on top), then the
 * nearest due, requests without a clock last. Only when the page holds every request of the view — a partial page is
 * left in the API's order (needs API: `sort=slaDueAt` on `GET /v1/owner/service-requests`).
 */
function byUrgency(requests: Request[], now: number): Request[] {
  const due = (request: Request) => (request.slaDueAt ? Date.parse(request.slaDueAt) : Number.POSITIVE_INFINITY);
  return [...requests].sort((a, b) => URGENCY[slaState(a, now)] - URGENCY[slaState(b, now)] || due(a) - due(b));
}

/**
 * The service requests queue (F2 2.7, D-072, D-159; G4): the focused building's requests as a work queue — figures
 * from the API (open, past SLA, waiting for triage, waiting for parts), one toolbar (open · past SLA · all, search,
 * status, category, warranty) and rows that open the request, the SLA as icon + words.
 */
export async function RequestsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.service.list");
  const reporter = await getTranslations("owner.service.reporter");
  const statuses = await getTranslations("status.serviceRequest");
  const priorities = await getTranslations("status.priority");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const status = enumParam(searchParams.status, SERVICE_REQUEST_VALUES);
  const view: View =
    enumParam(searchParams.sla, ["breached"] as const) === "breached"
      ? "breached"
      : param(searchParams.view) === "all"
        ? "all"
        : "open";
  const now = currentTime();
  const base = { buildingId: building?.id };
  const count = (query: Record<string, unknown>) =>
    unwrap(api.GET("/v1/owner/service-requests", { params: { query: { ...base, ...query, perPage: 1 } } }));
  const [list, categories, units, counts] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/service-requests", {
        params: {
          query: {
            ...base,
            page: pageParam(searchParams.page),
            perPage: 25,
            status,
            open: !status && view !== "all" ? true : undefined,
            slaBreached: view === "breached" ? true : undefined,
            categoryId: param(searchParams.category),
            inWarranty: param(searchParams.warranty) === "true" ? true : undefined,
            q: param(searchParams.q),
          },
        },
      }),
    ),
    serviceCategories(api),
    building ? buildingUnits(api, building.id) : Promise.resolve([]),
    viewCounts(["open", "breached", "new", "waiting"] as const, (key) =>
      key === "open"
        ? count({ open: true })
        : key === "breached"
          ? count({ open: true, slaBreached: true })
          : count({ status: key === "new" ? "new" : "waiting_parts" }),
    ),
  ]);
  const canHandle = ownerCan(me, "service_request.handle") && !readOnly(me);
  const filtered = Boolean(
    param(searchParams.q) || status || param(searchParams.category) || param(searchParams.warranty),
  );
  const whole = list.meta.total <= list.data.length;
  const rows = view !== "all" && whole ? byUrgency(list.data, now) : list.data;
  const path = (query: Record<string, string | undefined>) => ownerPath(locale, withQuery("/service-requests", query));
  const figure = (value: number | undefined) => (value === undefined ? "—" : formatNumber(value, locale));

  return (
    <OwnerPage testId="service-requests">
      <PageHeader
        title={t("title")}
        description={building ? t("descriptionBuilding", { building: building.name }) : t("description")}
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
      <StatsRow
        label={t("figures.label")}
        highlight={counts.breached ? "breached" : undefined}
        figures={[
          { key: "open", label: t("figures.open"), value: figure(counts.open), href: path({}) },
          {
            key: "breached",
            label: t("figures.breached"),
            value: figure(counts.breached),
            href: path({ sla: "breached" }),
          },
          { key: "new", label: t("figures.new"), value: figure(counts.new), href: path({ status: "new" }) },
          {
            key: "waiting",
            label: t("figures.waiting"),
            value: figure(counts.waiting),
            href: path({ status: "waiting_parts" }),
          },
        ]}
      />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("filter.view")}
            current={view}
            tabs={[
              { key: "open", href: path({}), label: t("filter.open"), count: counts.open, testId: "view-open" },
              {
                key: "breached",
                href: path({ sla: "breached" }),
                label: t("filter.slaBreached"),
                count: counts.breached,
                testId: "view-breached",
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
                name: "warranty",
                label: t("filter.warranty"),
                type: "select",
                placeholder: t("filter.anyWarranty"),
                options: [{ value: "true", label: t("filter.inWarranty") }],
              },
            ]}
          />
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCheckCircle}
          title={
            filtered ? t("empty.filteredTitle") : view === "breached" ? t("empty.breachedTitle") : t("empty.title")
          }
          description={filtered ? t("empty.filteredBody") : t("empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered || view !== "open" ? path({}) : path({ view: "all" })}>
                {filtered || view !== "open" ? t("empty.clear") : t("empty.all")}
              </a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="request-table"
          stackOnPhones
          minWidth="58rem"
          columns={[
            { key: "problem", header: t("col.problem"), phone: "title" },
            { key: "place", header: t("col.place"), phone: "figure", className: "md:w-24" },
            { key: "reported", header: t("col.reported"), phone: "hidden", className: "md:w-40" },
            { key: "status", header: t("col.status"), phone: "status", className: "md:w-36" },
            { key: "sla", header: t("col.sla"), phone: "meta", className: "md:w-56" },
          ]}
          rows={rows.map((request) => ({
            key: request.id,
            href: ownerPath(locale, `/service-requests/${request.id}`),
            testId: "request-row",
            data: { status: request.status, breached: request.slaBreached, ref: request.ref },
            cells: {
              problem: (
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="line-clamp-2">{request.description}</span>
                  <span className="text-muted flex flex-wrap items-center gap-x-1.5 text-sm font-normal">
                    <span className="font-mono">{request.ref}</span>
                    <span aria-hidden>·</span>
                    <span>{categoryName(request.category, locale)}</span>
                    {request.priority !== "normal" ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>{priorities(request.priority)}</span>
                      </>
                    ) : null}
                    <span aria-hidden className="max-md:hidden">
                      ·
                    </span>
                    <span className="max-md:hidden">
                      {request.reporterKind === "system" && request.autoReason
                        ? t("auto", {
                            reason: t.has(`autoReason.${request.autoReason}`)
                              ? t(`autoReason.${request.autoReason}`)
                              : t("autoReason.other"),
                          })
                        : reporter(request.reporterKind, { name: request.requesterName ?? "" })}
                    </span>
                  </span>
                </span>
              ),
              place: request.unitNo ? (
                <span className="font-mono">{request.unitNo}</span>
              ) : (
                <span className="text-muted">{t("commonArea")}</span>
              ),
              reported: (
                <span className="text-muted text-sm whitespace-nowrap tabular-nums">
                  {formatDateTime(request.createdAt, locale)}
                </span>
              ),
              status: (
                <span className="flex flex-wrap items-center gap-1.5">
                  <StatusBadgeOf map={SERVICE_REQUEST_STATUS} value={request.status} size="sm" />
                  {request.inWarranty ? (
                    <Badge tone="info" size="sm" icon={IconShield}>
                      {t("warranty")}
                    </Badge>
                  ) : null}
                </span>
              ),
              sla: <SlaTimer request={request} locale={locale} now={now} />,
            },
          }))}
        />
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/service-requests")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
