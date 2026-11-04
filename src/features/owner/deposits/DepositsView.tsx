import { getTranslations } from "next-intl/server";

import { DEPOSIT_STATUS, DEPOSIT_VALUES } from "@/domain/status/deposit";
import { SETTLEMENT_STATUS } from "@/domain/status/settlement";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath, withQuery } from "../shared/links";
import { viewCounts } from "../shared/views";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, pageParam, param, section, type OwnerContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;
const DAY = 86_400_000;
const VIEWS = ["all", "held", "settling", "disputed", "refunded", "late"] as const;

/** Whole days from now to a deadline (negative once it has passed) — a date, not money. */
export function daysUntil(deadline: string, now = Date.now()): number {
  return Math.ceil((Date.parse(deadline) - now) / DAY);
}

/**
 * Deposits (F2 2.2): what is held, settling and refunded, with the refund deadline of each settlement
 * counted down (D-023: the deadline comes from the API) and late refunds singled out.
 */
export async function DepositsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.deposits");
  const statusT = await getTranslations("status.deposit");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const statusParam = param(searchParams.status);
  const status = DEPOSIT_VALUES.includes(statusParam as Schemas["DepositStatus"])
    ? (statusParam as Schemas["DepositStatus"])
    : undefined;
  const late = param(searchParams.late) === "1";
  const q = param(searchParams.q);
  const view = late ? "late" : (status ?? "all");
  const query = (extra: { status?: Schemas["DepositStatus"]; late?: boolean }) => ({
    perPage: 1,
    q,
    buildingId: building?.id,
    ...extra,
  });
  const [list, summary, counts] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/deposits", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            q,
            status,
            late: late || undefined,
            buildingId: building?.id,
          },
        },
      }),
    ),
    section(unwrap(api.GET("/v1/owner/deposits/summary"))),
    viewCounts(VIEWS, (key) =>
      unwrap(
        api.GET("/v1/owner/deposits", {
          params: {
            query: key === "all" ? query({}) : key === "late" ? query({ late: true }) : query({ status: key }),
          },
        }),
      ),
    ),
  ]);
  const href = (key: (typeof VIEWS)[number]) =>
    ownerPath(
      locale,
      withQuery("/deposits", {
        q,
        status: key === "all" || key === "late" ? undefined : key,
        late: key === "late" ? "1" : undefined,
      }),
    );
  const lateCount = summary.data ? summary.data.settlementsOverdue + summary.data.lateRefunds : 0;

  return (
    <OwnerPage testId="deposits">
      <PageHeader title={t("title")} description={t("description")} />
      {summary.data ? (
        <StatsRow
          label={t("summary.label")}
          highlight={lateCount > 0 ? "late" : summary.data.settlementsDueSoon > 0 ? "dueSoon" : undefined}
          figures={[
            {
              key: "held",
              label: t("summary.held"),
              value: formatNumber(summary.data.byStatus.held, locale),
              href: href("held"),
            },
            {
              key: "settling",
              label: t("summary.settling"),
              value: formatNumber(summary.data.byStatus.settling, locale),
              hint: summary.data.byStatus.disputed
                ? t("summary.disputed", { count: summary.data.byStatus.disputed })
                : undefined,
              href: href("settling"),
            },
            {
              key: "dueSoon",
              label: t("summary.dueSoon"),
              value: formatNumber(summary.data.settlementsDueSoon, locale),
            },
            {
              key: "late",
              label: t("summary.late"),
              value: <span data-testid="deposit-late-count">{formatNumber(lateCount, locale)}</span>,
              href: href("late"),
            },
          ]}
        />
      ) : null}
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("views.label")}
            current={view}
            tabs={VIEWS.map((key) => ({
              key,
              href: href(key),
              label: key === "all" ? t("views.all") : key === "late" ? t("views.late") : statusT(key),
              count: counts[key],
              testId: `deposit-view-${key}`,
            }))}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[
              { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
            ]}
          />
        }
      />
      {list.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconWallet}
          title={view === "all" && !q ? t("empty.title") : t("empty.filteredTitle")}
          description={view === "all" && !q ? t("empty.body") : t("empty.filteredBody")}
          action={
            view === "all" && !q ? (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/leases/new")}>{t("empty.newLease")}</a>
              </Button>
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/deposits")}>{t("empty.clear")}</a>
              </Button>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="deposit-list"
          stackOnPhones
          minWidth="56rem"
          columns={[
            { key: "unit", header: t("column.unit"), phone: "meta", className: "w-24" },
            { key: "lessee", header: t("column.lessee"), phone: "title" },
            { key: "deadline", header: t("column.deadline"), phone: "meta" },
            { key: "status", header: t("column.status"), phone: "status" },
            { key: "amount", header: t("column.amount"), align: "end", phone: "figure" },
          ]}
          rows={list.data.map((deposit) => {
            const settlement = deposit.settlement;
            const open = settlement && !settlement.refundedAt;
            const days = open ? daysUntil(settlement.deadlineAt) : null;
            const urgent = Boolean(settlement?.isLate || (days !== null && days < 0));
            return {
              key: deposit.id,
              href: ownerPath(locale, `/deposits/${deposit.id}`),
              testId: "deposit-row",
              data: { late: settlement?.isLate ? "true" : undefined },
              cells: {
                unit: <span className="font-mono">{deposit.unitNo}</span>,
                lessee: (
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{deposit.lesseeName ?? "—"}</span>
                    {deposit.leaseNumber ? (
                      <span className="text-muted truncate text-sm font-normal max-md:hidden">
                        {deposit.leaseNumber}
                      </span>
                    ) : null}
                  </span>
                ),
                deadline:
                  days !== null ? (
                    <span data-testid="deposit-countdown">
                      <Badge tone={urgent ? "danger" : days <= 2 ? "warning" : "neutral"} size="sm" icon={IconClock}>
                        {days < 0
                          ? t("overdueBy", { days: -days })
                          : t("daysLeft", { days, date: formatDate(settlement!.deadlineAt, locale) })}
                      </Badge>
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
                status: (
                  <span className="flex flex-wrap items-center gap-1.5 md:flex-nowrap">
                    <StatusBadgeOf map={DEPOSIT_STATUS} value={deposit.status} size="sm" />
                    {settlement ? <StatusBadgeOf map={SETTLEMENT_STATUS} value={settlement.status} size="sm" /> : null}
                  </span>
                ),
                amount: (
                  <span className="font-medium whitespace-nowrap">{formatTHB(deposit.amountSecurity, locale)}</span>
                ),
              },
            };
          })}
        />
      )}
      <ListPagination
        meta={list.meta}
        path={ownerPath(locale, "/deposits")}
        searchParams={searchParams}
        locale={locale}
      />
    </OwnerPage>
  );
}
