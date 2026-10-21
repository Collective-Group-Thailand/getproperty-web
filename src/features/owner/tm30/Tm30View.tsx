import { getTranslations } from "next-intl/server";

import { TM30_STATUS, TM30_VALUES } from "@/domain/status/tm30";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatRelativeTime } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { Icon } from "@/ui/icons";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { currentTime } from "@/features/shared/console/time";
import { linkRequestsPending, openTm30 } from "../parties/counts";
import { PartiesNav } from "../parties/PartiesNav";
import { ownerPath } from "../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, type OwnerContext } from "../shared/server";
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
        <Card>
          <EmptyState title={t("noPermission")} />
        </Card>
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
  const [list, open, pending] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/tm30-exports", {
        params: {
          query: {
            building: building?.id,
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
  ]);
  const now = currentTime();
  const canAct = !readOnly(me);
  // One upload file per building with pending notifications (the API generates per building).
  const pendingByBuilding = new Map<string, number>();
  for (const row of open) pendingByBuilding.set(row.buildingId, (pendingByBuilding.get(row.buildingId) ?? 0) + 1);
  const overdue = open.filter((row) => row.overdue).length;

  return (
    <OwnerPage testId="tm30" wide>
      <PageHeader title={t("title")} description={t("description")} />
      <PartiesNav
        context={context}
        current="/tm30"
        counts={{ "/parties/link-requests": pending, "/tm30": open.length }}
      />
      <Callout tone={overdue ? "warning" : "info"} title={t("ruleTitle")} legalRef={t("legalRef")}>
        <p>{t("ruleBody")}</p>
        {overdue ? (
          <p className="mt-1 font-medium" data-testid="tm30-overdue-count">
            {t("overdueCount", { count: overdue })}
          </p>
        ) : null}
      </Callout>

      {canAct && pendingByBuilding.size > 0 ? (
        <section aria-labelledby="tm30-files" className="flex flex-col gap-2" data-testid="tm30-files">
          <h2 id="tm30-files" className="text-lg font-semibold">
            {t("filesTitle")}
          </h2>
          <p className="text-muted text-sm">{t("filesHint")}</p>
          <ul className="flex flex-wrap gap-2">
            {[...pendingByBuilding].map(([buildingId, count]) => {
              const name = context.buildings.find((candidate) => candidate.id === buildingId)?.name ?? buildingId;
              return (
                <li key={buildingId} data-testid="tm30-building" data-building={buildingId}>
                  <GenerateTm30 buildingId={buildingId} buildingName={name} count={count} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <FilterBar
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

      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconCheckCircle} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="tm30-list"
          minWidth="56rem"
          columns={[
            { key: "person", header: t("col.person") },
            { key: "unit", header: t("col.unit") },
            { key: "movedIn", header: t("col.movedIn") },
            { key: "deadline", header: t("col.deadline") },
            { key: "status", header: t("col.status") },
            { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
          ]}
          rows={list.data.map((row) => {
            const deadline = tm30Deadline(row, now);
            const missing = missingFields(row.missing);
            return {
              key: row.id,
              testId: "tm30-row",
              tone: deadline.overdue ? "warning" : "default",
              data: { id: row.id, status: row.status, overdue: deadline.overdue },
              cells: {
                person: (
                  <span className="flex flex-col">
                    <span className="font-medium">{row.name}</span>
                    <span className="text-muted text-xs">
                      {[
                        row.nationality ? t("nationality", { code: row.nationality }) : t("noNationality"),
                        row.arrivalDate ? t("arrived", { date: formatDate(row.arrivalDate, locale) }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    {missing.length ? (
                      <span className="text-sm" data-testid="tm30-missing">
                        {t("missing", { fields: missing.map((field) => t(`field.${field}` as never)).join(", ") })}
                      </span>
                    ) : null}
                  </span>
                ),
                unit: (
                  <a
                    className="font-mono underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/leases/${row.leaseId}`)}
                  >
                    {row.unitNo}
                  </a>
                ),
                movedIn: formatDateTime(row.movedInAt, locale),
                deadline: deadline.open ? (
                  <span className="flex flex-col" data-testid="tm30-deadline">
                    <span>{formatDateTime(row.dueAt, locale)}</span>
                    <span>
                      {deadline.overdue ? (
                        <Badge tone="danger" size="sm">
                          {t("overdue", { since: formatRelativeTime(row.dueAt, locale, now) })}
                        </Badge>
                      ) : (
                        <Badge tone={deadline.soon ? "warning" : "neutral"} size="sm">
                          {t("dueIn", { hours: deadline.hoursLeft })}
                        </Badge>
                      )}
                    </span>
                  </span>
                ) : row.submittedAt ? (
                  <span className="flex flex-col text-sm">
                    <span>{t("submittedOn", { date: formatDateTime(row.submittedAt, locale) })}</span>
                    {row.submissionRef ? <span className="font-mono text-xs">{row.submissionRef}</span> : null}
                  </span>
                ) : (
                  <span className="text-muted text-sm">{row.cancelReason ?? "—"}</span>
                ),
                status: <StatusBadgeOf map={TM30_STATUS} value={row.status} size="sm" />,
                actions: (
                  <span className="flex flex-wrap items-center gap-2">
                    {row.fileDocumentId ? (
                      // A same-origin POST (review L4): the download is audited and marks the notifications.
                      <form method="post" action={`/bff/tm30-exports/${row.id}/download`} className="contents">
                        <button
                          type="submit"
                          className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
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
