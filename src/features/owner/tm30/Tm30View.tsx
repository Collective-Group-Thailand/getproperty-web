import { getTranslations } from "next-intl/server";

import { TM30_STATUS, TM30_VALUES } from "@/domain/status/tm30";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatDuration, formatNumber } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { StatusText } from "@/ui/components/StatusText";
import { cn } from "@/ui/lib/cn";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconTimer } from "@/ui/icons/glyphs/timer";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { Icon } from "@/ui/icons";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { currentTime } from "@/features/shared/console/time";
import { linkRequestsPending, openTm30 } from "../parties/counts";
import { PartiesNav } from "../parties/PartiesNav";
import { ownerPath } from "../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../shared/server";
import { missingFields, tm30Deadline } from "./deadline";
import { GenerateTm30, Tm30RowActions } from "./Tm30Actions";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * TM30 notifications (D-052, D-216, Immigration Act B.E. 2522 s.38 — `tm30.manage`): every foreign occupant who
 * moved in, with the 24-hour deadline the API set, the data the Immigration Bureau still needs, the upload file
 * per building (generated here, downloaded through this zone's BFF) and the recorded manual submission. Lists
 * carry names, units and nationality only — passport numbers exist only inside the generated file (D-148).
 */
export async function Tm30View({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.tm30");
  const states = await getTranslations("status.tm30");
  const { api, locale, me } = context;
  if (!ownerCan(me, "tm30.manage")) {
    return (
      <OwnerPage testId="tm30">
        <PageHeader title={t("title")} description={t("description")} />
        <EmptyState
          variant="card"
          icon={IconShield}
          title={t("noPermission")}
          action={
            <Button asChild variant="secondary">
              <a href={ownerPath(locale, "/parties")}>{t("goParties")}</a>
            </Button>
          }
        />
      </OwnerPage>
    );
  }
  const focused = focusedBuilding(context);
  const buildingParam = param(searchParams.building) ?? focused?.id;
  const building = context.buildings.find((candidate) => candidate.id === buildingParam);
  const statusParam = param(searchParams.status);
  const status = TM30_VALUES.includes(statusParam as Schemas["Tm30Status"])
    ? (statusParam as Schemas["Tm30Status"])
    : undefined;
  // G8 (D-299): the foreign workers of one employer agreement (`?employer=`, from the employer housing page).
  const employerParam = param(searchParams.employer);
  const employerId = employerParam && /^[0-9a-f-]{36}$/i.test(employerParam) ? employerParam : undefined;
  const [list, open, pending, employer] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/tm30-exports", {
        params: {
          query: {
            building: building?.id,
            employerAgreementId: employerId,
            status,
            q: param(searchParams.q),
            page: pageParam(searchParams.page),
            perPage: 25,
          },
        },
      }),
    ),
    openTm30(api),
    linkRequestsPending(api),
    employerId
      ? section(
          unwrap(
            api.GET("/v1/owner/employer-agreements/{agreementId}", { params: { path: { agreementId: employerId } } }),
          ),
        )
      : null,
  ]);
  const now = currentTime();
  const canAct = !readOnly(me);
  // One upload file per building with pending notifications (the API generates per building).
  const pendingByBuilding = new Map<string, number>();
  for (const row of open) pendingByBuilding.set(row.buildingId, (pendingByBuilding.get(row.buildingId) ?? 0) + 1);
  const overdue = open.filter((row) => row.overdue).length;

  const incomplete = open.filter((row) => row.missing.length > 0).length;
  // Soonest deadline first, done rows after — only when the page holds every row (needs API: `sort=dueAt`).
  const whole = list.meta.total <= list.data.length;
  const rows = whole
    ? [...list.data].sort(
        (a, b) =>
          Number(!tm30Deadline(a, now).open) - Number(!tm30Deadline(b, now).open) || a.dueAt.localeCompare(b.dueAt),
      )
    : list.data;
  const filtered = Boolean(param(searchParams.q) || status || param(searchParams.building));

  return (
    <OwnerPage testId="tm30" wide>
      <PageHeader title={t("title")} description={t("description")} />
      <StatsRow
        label={t("figures.label")}
        highlight={overdue ? "overdue" : open.length ? "open" : undefined}
        figures={[
          {
            key: "overdue",
            label: t("figures.overdue"),
            value: (
              <span data-testid={overdue ? "tm30-overdue-count" : undefined}>{formatNumber(overdue, locale)}</span>
            ),
          },
          { key: "open", label: t("figures.open"), value: formatNumber(open.length, locale) },
          { key: "incomplete", label: t("figures.incomplete"), value: formatNumber(incomplete, locale) },
        ]}
      />

      {employerId ? (
        <div data-testid="tm30-employer-filter">
          <Callout
            tone="neutral"
            title={t("employerFilter", { name: employer?.data?.employer.displayName ?? "—" })}
            action={
              <Button asChild size="sm" variant="secondary">
                <a href={ownerPath(locale, "/tm30")}>{t("employerClear")}</a>
              </Button>
            }
          >
            {t("employerFilterBody")}
          </Callout>
        </div>
      ) : null}

      <Card as="section" aria-labelledby="tm30-files" className="flex flex-col gap-4" data-testid="tm30-files">
        <div className="flex flex-col gap-1">
          <h2 id="tm30-files" className="text-lg font-semibold">
            {t("filesTitle")}
          </h2>
          <p className="text-muted text-sm">
            {t("ruleBody")} {t("filesHint")}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {canAct && pendingByBuilding.size > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {[...pendingByBuilding].map(([buildingId, count]) => {
                const name = context.buildings.find((candidate) => candidate.id === buildingId)?.name ?? "";
                return (
                  <li key={buildingId} data-testid="tm30-building" data-building={buildingId}>
                    <GenerateTm30 buildingId={buildingId} buildingName={name} count={count} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted text-sm">{t("nothingToFile")}</p>
          )}
          <p className="text-muted text-sm">{t("legalRef")}</p>
        </div>
      </Card>

      <ListToolbar
        tabs={
          <PartiesNav
            context={context}
            current="/tm30"
            counts={{ "/parties/link-requests": pending, "/tm30": open.length }}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
              {
                name: "building",
                label: t("filter.building"),
                type: "select",
                placeholder: t("filter.allBuildings"),
                options: context.buildings.map((candidate) => ({ value: candidate.id, label: candidate.name })),
              },
              {
                name: "status",
                label: t("filter.status"),
                type: "select",
                placeholder: t("filter.allStatuses"),
                options: TM30_VALUES.map((value) => ({ value, label: states(value) })),
              },
            ]}
          />
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCheckCircle}
          title={filtered ? t("empty.filteredTitle") : t("empty.title")}
          description={filtered ? t("empty.filteredBody") : t("empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={filtered ? ownerPath(locale, "/tm30") : ownerPath(locale, "/leases")}>
                {filtered ? t("empty.clear") : t("empty.leases")}
              </a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="tm30-list"
          stackOnPhones
          minWidth="60rem"
          columns={[
            { key: "person", header: t("col.person"), phone: "title" },
            { key: "unit", header: t("col.unit"), phone: "figure", className: "md:w-24" },
            { key: "deadline", header: t("col.deadline"), phone: "meta", className: "md:w-52" },
            { key: "movedIn", header: t("col.movedIn"), phone: "hidden", className: "md:w-44" },
            { key: "status", header: t("col.status"), phone: "status", className: "md:w-36" },
            {
              key: "actions",
              header: <span className="sr-only">{t("col.actions")}</span>,
              phone: "meta",
              className: "md:w-56",
            },
          ]}
          rows={rows.map((row) => {
            const deadline = tm30Deadline(row, now);
            const missing = missingFields(row.missing);
            const span = formatDuration(Date.parse(row.dueAt) - now, locale);
            return {
              key: row.id,
              testId: "tm30-row",
              data: { id: row.id, status: row.status, overdue: deadline.overdue },
              cells: {
                person: (
                  <span className={cn("flex flex-col gap-0.5", !deadline.open && "text-muted")}>
                    <span className="font-medium">{row.name}</span>
                    <span className="text-muted text-sm">
                      {[
                        row.nationality ? t("nationality", { code: row.nationality }) : t("noNationality"),
                        row.arrivalDate ? t("arrived", { date: formatDate(row.arrivalDate, locale) }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {missing.length ? (
                      <StatusText tone="warning" icon={IconWarning} testId="tm30-missing">
                        {t("missing", { fields: missing.map((field) => t(`field.${field}` as never)).join(", ") })}
                      </StatusText>
                    ) : null}
                  </span>
                ),
                unit: (
                  <a
                    className="relative z-1 font-mono whitespace-nowrap underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/leases/${row.leaseId}`)}
                  >
                    {row.unitNo}
                  </a>
                ),
                movedIn: (
                  <span className="text-muted text-sm whitespace-nowrap tabular-nums">
                    {formatDateTime(row.movedInAt, locale)}
                  </span>
                ),
                deadline: deadline.open ? (
                  <StatusText
                    tone={deadline.overdue ? "danger" : deadline.soon ? "warning" : "neutral"}
                    icon={deadline.overdue ? IconAlert : IconTimer}
                    detail={formatDateTime(row.dueAt, locale)}
                    testId="tm30-deadline"
                    className="whitespace-nowrap"
                  >
                    {deadline.overdue ? t("overdueBy", { span }) : t("leftFor", { span })}
                  </StatusText>
                ) : row.submittedAt ? (
                  <span className="text-muted flex flex-col text-sm">
                    <span className="whitespace-nowrap">
                      {t("submittedOn", { date: formatDateTime(row.submittedAt, locale) })}
                    </span>
                    {row.submissionRef ? <span className="font-mono">{row.submissionRef}</span> : null}
                  </span>
                ) : (
                  <span className="text-muted text-sm">{row.cancelReason ?? "—"}</span>
                ),
                status: <StatusBadgeOf map={TM30_STATUS} value={row.status} size="sm" />,
                actions: (
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    {row.fileDocumentId ? (
                      // A same-origin POST (review L4): the download is audited and marks the notifications.
                      <form method="post" action={`/bff/tm30-exports/${row.id}/download`} className="contents">
                        <button
                          type="submit"
                          className="text-primary inline-flex min-h-9 items-center gap-1 text-sm font-medium hover:underline"
                          data-testid="tm30-download"
                        >
                          <Icon icon={IconDownload} />
                          {t("download")}
                        </button>
                      </form>
                    ) : null}
                    {canAct ? <Tm30RowActions row={row} /> : null}
                  </span>
                ),
              },
            };
          })}
        />
      )}
      <ListPagination meta={list.meta} path={ownerPath(locale, "/tm30")} searchParams={searchParams} locale={locale} />
    </OwnerPage>
  );
}
