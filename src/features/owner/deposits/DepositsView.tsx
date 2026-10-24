import { getTranslations } from "next-intl/server";

import { DEPOSIT_STATUS, DEPOSIT_VALUES } from "@/domain/status/deposit";
import { SETTLEMENT_STATUS } from "@/domain/status/settlement";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Stat } from "@/ui/components/Stat";
import { Icon } from "@/ui/icons";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ownerPath } from "../shared/links";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { focusedBuilding, pageParam, param, section, type OwnerContext } from "../shared/server";

type SearchParams = Record<string, string | string[] | undefined>;
const DAY = 86_400_000;

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
  const late = param(searchParams.late) === "1";
  const [list, summary] = await Promise.all([
    unwrap(
      api.GET("/v1/owner/deposits", {
        params: {
          query: {
            page: pageParam(searchParams.page),
            perPage: 25,
            q: param(searchParams.q),
            status: DEPOSIT_VALUES.includes(statusParam as Schemas["DepositStatus"])
              ? (statusParam as Schemas["DepositStatus"])
              : undefined,
            late: late || undefined,
            buildingId: building?.id,
          },
        },
      }),
    ),
    section(unwrap(api.GET("/v1/owner/deposits/summary"))),
  ]);
  return (
    <OwnerPage testId="deposits">
      <PageHeader title={t("title")} description={t("description")} />
      {summary.data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="deposit-summary">
          <Stat label={t("summary.held")} value={formatNumber(summary.data.byStatus.held, locale)} />
          <Stat
            label={t("summary.settling")}
            value={formatNumber(summary.data.byStatus.settling + summary.data.byStatus.disputed, locale)}
          />
          <Stat label={t("summary.dueSoon")} value={formatNumber(summary.data.settlementsDueSoon, locale)} />
          <Stat
            label={t("summary.late")}
            value={
              <span data-testid="deposit-late-count">
                {formatNumber(summary.data.settlementsOverdue + summary.data.lateRefunds, locale)}
              </span>
            }
          />
        </div>
      ) : null}
      <FilterBar
        fields={[
          { name: "q", label: t("filter.search"), type: "search", placeholder: t("filter.searchPlaceholder") },
          {
            name: "status",
            label: t("filter.status"),
            type: "select",
            placeholder: t("filter.allStatuses"),
            options: DEPOSIT_VALUES.map((value) => ({ value, label: statusT(value) })),
          },
          {
            name: "late",
            label: t("filter.late"),
            type: "select",
            placeholder: t("filter.any"),
            options: [{ value: "1", label: t("filter.lateOnly") }],
          },
        ]}
      />
      {list.data.length === 0 ? (
        <Card>
          <EmptyState icon={IconWallet} title={t("empty.title")} description={t("empty.body")} />
        </Card>
      ) : (
        <ul className="divide-border border-border bg-surface rounded-card divide-y border" data-testid="deposit-list">
          {list.data.map((deposit) => {
            const settlement = deposit.settlement;
            const open = settlement && !settlement.refundedAt;
            const days = open ? daysUntil(settlement.deadlineAt) : null;
            return (
              <li key={deposit.id}>
                <a
                  href={ownerPath(locale, `/deposits/${deposit.id}`)}
                  className="hover:bg-bg-subtle flex flex-wrap items-center gap-3 px-4 py-3"
                  data-testid="deposit-row"
                  data-late={settlement?.isLate ? "true" : undefined}
                >
                  <span className="w-20 font-mono font-semibold">{deposit.unitNo}</span>
                  <span className="flex min-w-40 flex-1 flex-col">
                    <span className="font-medium">{deposit.lesseeName ?? "—"}</span>
                    <span className="text-muted text-sm">{deposit.leaseNumber ?? ""}</span>
                  </span>
                  <span className="tabular-nums">{formatTHB(deposit.amountSecurity, locale)}</span>
                  {settlement ? <StatusBadgeOf map={SETTLEMENT_STATUS} value={settlement.status} size="sm" /> : null}
                  <StatusBadgeOf map={DEPOSIT_STATUS} value={deposit.status} size="sm" />
                  {days !== null ? (
                    <span data-testid="deposit-countdown">
                      <Badge
                        tone={settlement?.isLate || days < 0 ? "danger" : days <= 2 ? "warning" : "neutral"}
                        size="sm"
                        icon={IconClock}
                      >
                        {days < 0
                          ? t("overdueBy", { days: -days })
                          : t("daysLeft", { days, date: formatDate(settlement!.deadlineAt, locale) })}
                      </Badge>
                    </span>
                  ) : null}
                  <Icon icon={IconChevronRight} className="text-muted ms-auto" />
                </a>
              </li>
            );
          })}
        </ul>
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
