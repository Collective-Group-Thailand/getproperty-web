import { getTranslations } from "next-intl/server";

import { BILLING_CYCLE_STATUS } from "@/domain/status/billingCycle";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import {
  formatDate,
  formatDateTime,
  formatDecimal,
  formatNumber,
  formatPercent,
  formatPeriodKey,
  formatTHB,
} from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { EmptyState } from "@/ui/components/EmptyState";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StageRail } from "@/ui/components/StageRail";
import { StatsRow } from "@/ui/components/StatsRow";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconPayment } from "@/ui/icons/glyphs/payment";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconStaff } from "@/ui/icons/glyphs/staff";
import { IconTimer } from "@/ui/icons/glyphs/timer";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { LinkMenu } from "@/features/shared/console/LinkMenu";
import { ownerPath, withQuery } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { etaxToFix } from "../etax/counts";
import { linkRequestsPending, openTm30 } from "../parties/counts";
import { heldCount } from "../payments/counts";
import { focusedBuilding, ownerCan, section, type OwnerContext } from "../shared/server";

interface QueueItem {
  kind: string;
  count: number;
  title: string;
  detail: string;
  href: string;
  icon: IconGlyph;
  /** Amber for what has a deadline today; never red for money that is merely due (D-100). */
  urgent?: boolean;
}

/**
 * The morning dashboard (F2 2.1, D-100): first the "Today" queue — what needs the owner now, each item
 * one click from its action — then the month's figures, the billing cycle and the compliance score.
 * Every number is the API's: counts and amounts are shown as returned, never added up here.
 */
export async function DashboardView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.dashboard");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const buildingId = building?.id;
  const canTm30 = ownerCan(context.me, "tm30.manage");
  const [dashboard, rounds, deposits, score, board, count, held, linkRequests, tm30, etax] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/dashboard", { params: { query: { buildingId } } }))),
    section(unwrap(api.GET("/v1/owner/reading-rounds/current", { params: { query: { buildingId } } }))),
    section(unwrap(api.GET("/v1/owner/deposits/summary"))),
    section(unwrap(api.GET("/v1/owner/compliance/score", { params: { query: {} } }))),
    building
      ? section(
          unwrap(api.GET("/v1/owner/buildings/{buildingId}/board", { params: { path: { buildingId: building.id } } })),
        )
      : Promise.resolve({ data: null, error: null }),
    building ? Promise.resolve({ data: null, error: null }) : section(unwrap(api.GET("/v1/owner/units/count"))),
    // Release fixes and B6.2 (no counts in `DashboardDto` yet — CONTRACT-REQUEST in docs/contract-requests.md):
    // held payments (D-220), phone sign-ins waiting for the Owner (D-226), open TM30 duties (D-216), e-Tax to fix.
    ownerCan(context.me, "payment.read") ? heldCount(api, buildingId) : Promise.resolve(undefined),
    context.me.menu.includes("parties") ? linkRequestsPending(api) : Promise.resolve(undefined),
    canTm30 ? openTm30(api, buildingId).catch(() => null) : Promise.resolve(null),
    ownerCan(context.me, "payment.read") ? etaxToFix(api) : Promise.resolve(undefined),
  ]);
  const href = (path: string, query: Record<string, string | undefined> = {}) =>
    ownerPath(locale, withQuery(path, query));

  const d = dashboard.data;
  const roundList = rounds.data ?? [];
  const readingsLeft = roundList.reduce((sum, round) => sum + round.remaining, 0);
  const staleMeters = roundList.flatMap((round) =>
    round.floors.flatMap((floor) => floor.items.filter((item) => item.iot && item.health !== "ok")),
  ).length;
  const nextCutoff = roundList.map((round) => round.cutoffAt).sort()[0];

  const queue: QueueItem[] = [];
  if (readingsLeft > 0)
    queue.push({
      kind: "readings",
      count: readingsLeft,
      title: t("queue.readings.title", { count: readingsLeft }),
      detail: nextCutoff ? t("queue.readings.detail", { cutoff: formatDateTime(nextCutoff, locale) }) : "",
      href: href("/billing"),
      icon: IconMeter,
      urgent: true,
    });
  if (d && d.attention.draftsToReview > 0)
    queue.push({
      kind: "drafts",
      count: d.attention.draftsToReview,
      title: t("queue.drafts.title", { count: d.attention.draftsToReview }),
      detail: t("queue.drafts.detail"),
      href: href("/billing"),
      icon: IconBill,
    });
  if (d && d.attention.slipsToReview > 0)
    queue.push({
      kind: "slips",
      count: d.attention.slipsToReview,
      title: t("queue.slips.title", { count: d.attention.slipsToReview }),
      detail: t("queue.slips.detail"),
      href: href("/payments/slips"),
      icon: IconPayment,
      urgent: true,
    });
  const depositsDue = (deposits.data?.settlementsDueSoon ?? 0) + (deposits.data?.settlementsOverdue ?? 0);
  if (deposits.data && depositsDue > 0)
    queue.push({
      kind: "deposits",
      count: depositsDue,
      title: t("queue.deposits.title", { count: depositsDue }),
      detail: deposits.data.settlementsOverdue
        ? t("queue.deposits.overdue", { count: deposits.data.settlementsOverdue })
        : t("queue.deposits.detail"),
      href: href("/deposits", { status: "settling" }),
      icon: IconWallet,
      urgent: true,
    });
  if (staleMeters > 0)
    queue.push({
      kind: "meters",
      count: staleMeters,
      title: t("queue.meters.title", { count: staleMeters }),
      detail: t("queue.meters.detail"),
      href: href("/meters"),
      icon: IconMeter,
    });
  if (d && d.arrears.parties > 0)
    queue.push({
      kind: "overdue",
      count: d.arrears.parties,
      title: t("queue.overdue.title", { count: d.arrears.parties }),
      detail: t("queue.overdue.detail", { amount: formatTHB(d.arrears.balance, locale), invoices: d.arrears.invoices }),
      href: href("/arrears"),
      icon: IconResidents,
    });
  if (d && d.dueToday.invoices > 0)
    queue.push({
      kind: "dueToday",
      count: d.dueToday.invoices,
      title: t("queue.dueToday.title", { count: d.dueToday.invoices }),
      detail: t("queue.dueToday.detail", { amount: formatTHB(d.dueToday.balance, locale) }),
      href: href("/invoices", { status: "issued" }),
      icon: IconClock,
    });
  // R2 (F2 2.7): overdue service requests (the API's SLA, D-159) and parcels waiting at the desk — both counted
  // by the API for the focused building or all (`DashboardAttentionDto`); shown only where the menu has them.
  const overdueRequests = d?.attention.serviceRequestsOverdue ?? 0;
  if (overdueRequests > 0 && context.me.menu.includes("service_requests"))
    queue.push({
      kind: "serviceRequests",
      count: overdueRequests,
      title: t("queue.serviceRequests.title", { count: overdueRequests }),
      detail: t("queue.serviceRequests.detail"),
      href: href("/service-requests", { sla: "breached" }),
      icon: IconStaff,
      urgent: true,
    });
  const parcelsWaiting = d?.attention.parcelsWaiting ?? 0;
  if (parcelsWaiting > 0 && context.me.menu.includes("parcels"))
    queue.push({
      kind: "parcels",
      count: parcelsWaiting,
      title: t("queue.parcels.title", { count: parcelsWaiting }),
      detail: t("queue.parcels.detail"),
      href: href("/parcels"),
      icon: IconParcel,
    });

  if (tm30 && tm30.length > 0) {
    const overdue = tm30.filter((row) => row.overdue).length;
    const next = tm30.find((row) => !row.overdue);
    queue.push({
      kind: "tm30",
      count: tm30.length,
      title: t("queue.tm30.title", { count: tm30.length }),
      detail: overdue
        ? t("queue.tm30.overdue", { count: overdue })
        : next
          ? t("queue.tm30.detail", { due: formatDateTime(next.dueAt, locale) })
          : "",
      href: href("/tm30"),
      icon: IconTimer,
      urgent: true,
    });
  }
  if (held && held > 0)
    queue.push({
      kind: "heldPayments",
      count: held,
      title: t("queue.heldPayments.title", { count: held }),
      detail: t("queue.heldPayments.detail"),
      href: href("/payments/held"),
      icon: IconPayment,
    });
  if (linkRequests && linkRequests > 0)
    queue.push({
      kind: "linkRequests",
      count: linkRequests,
      title: t("queue.linkRequests.title", { count: linkRequests }),
      detail: t("queue.linkRequests.detail"),
      href: href("/parties/link-requests"),
      icon: IconLink,
    });
  if (etax && etax > 0)
    queue.push({
      kind: "etax",
      count: etax,
      title: t("queue.etax.title", { count: etax }),
      detail: t("queue.etax.detail"),
      href: href("/reports/etax", { status: "rejected" }),
      icon: IconReceipt,
    });

  // What has a deadline today first; otherwise the order the office works in (stable sort).
  queue.sort((a, b) => Number(Boolean(b.urgent)) - Number(Boolean(a.urgent)));
  const scope = building
    ? building.name
    : context.buildings.length > 1
      ? t("allBuildings")
      : (context.buildings[0]?.name ?? "");
  const cycle = d?.cycles[0];
  const cycleStatus = cycle && isCycleStatus(cycle.status) ? cycle.status : null;
  const stageIndex = cycleStatus ? CYCLE_STAGES.indexOf(cycleStatus as (typeof CYCLE_STAGES)[number]) : -1;
  const occupancy = board.data
    ? {
        value: formatPercent(board.data.summary.occupancyPct, locale, 1),
        hint: t("kpi.occupancyHint", { occupied: board.data.summary.occupied, total: board.data.summary.total }),
      }
    : count.data
      ? {
          value: `${formatNumber(count.data.byStatus.occupied, locale)} / ${formatNumber(count.data.billable, locale)}`,
          hint: t("kpi.occupancyAllHint", { vacant: count.data.byStatus.vacant }),
        }
      : { value: "—", hint: undefined };
  const electric = d?.loss.find((row) => row.utility === "electric") ?? d?.loss[0];
  const canPay = ownerCan(context.me, "payment.record");

  return (
    <OwnerPage testId="owner-dashboard">
      <PageHeader
        title={t("title")}
        testId="dashboard-title"
        description={
          <span data-testid="dashboard-scope">
            {d ? formatDate(d.today, locale, { style: "long" }) : null}
            {scope ? ` · ${scope}` : null}
          </span>
        }
        actions={
          <>
            {canPay ? (
              // The everyday task leads (Stitch revision): one filled "record a payment", the others outlined.
              <Button asChild iconStart={IconPayment}>
                <a href={href("/payments/new")}>{t("quick.recordPayment")}</a>
              </Button>
            ) : null}
            <Button asChild variant="secondary" iconStart={IconLease}>
              <a href={href("/leases/new")}>{t("quick.newLease")}</a>
            </Button>
            <LinkMenu
              label={t("quick.title")}
              testId="dashboard-more"
              items={[
                { id: "party", label: t("quick.newParty"), href: href("/parties", { new: "1" }) },
                ...(building
                  ? [{ id: "import", label: t("quick.importUnits"), href: href(`/buildings/${building.id}/import`) }]
                  : []),
              ]}
            />
          </>
        }
      />
      <p className="sr-only" data-testid="dashboard-tenant">
        {context.me.currentTenant?.displayName}
      </p>

      {dashboard.error ? <Callout tone="danger">{t("unavailable")}</Callout> : null}

      <StatsRow
        label={t("kpi.title")}
        highlight={d && d.arrears.parties > 0 ? "arrears" : undefined}
        figures={[
          {
            key: "collected",
            testId: "kpi-collected",
            label: t("kpi.collected"),
            value: d?.billing.collectedPct ? formatPercent(d.billing.collectedPct, locale, 1) : "—",
            hint: d
              ? t("kpi.collectedHint", {
                  collected: formatTHB(d.billing.collected, locale),
                  billed: formatTHB(d.billing.billed, locale),
                })
              : undefined,
            href: href("/invoices"),
          },
          {
            key: "arrears",
            testId: "kpi-arrears",
            label: t("kpi.arrears"),
            value: d ? formatTHB(d.arrears.balance, locale) : "—",
            hint: d ? t("kpi.arrearsHint", { invoices: d.arrears.invoices, parties: d.arrears.parties }) : undefined,
            href: href("/arrears"),
          },
          {
            key: "occupancy",
            testId: "kpi-occupancy",
            label: t("kpi.occupancy"),
            value: occupancy.value,
            hint: occupancy.hint,
            href: href("/units"),
          },
          {
            key: "loss",
            testId: "kpi-loss",
            label: t("kpi.loss"),
            value: electric?.lossPct ? formatPercent(electric.lossPct, locale, 1) : "—",
            hint: d?.loss.length ? (
              <span className="flex flex-col">
                {d.loss.map((row) => (
                  <span key={`${row.buildingId}-${row.utility}`} data-testid="loss-row">
                    {t("kpi.lossRow", {
                      utility: t(`utility.${row.utility === "water" ? "water" : "electric"}`),
                      building: row.buildingName,
                      pct: row.lossPct ? formatPercent(row.lossPct, locale, 1) : "—",
                      thb: formatTHB(row.lossThb, locale),
                    })}
                  </span>
                ))}
              </span>
            ) : (
              t("kpi.lossNone")
            ),
            href: href("/loss"),
          },
        ]}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <section aria-labelledby="today-queue" className="flex min-w-0 flex-col gap-3" data-testid="today-queue">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="today-queue" className="text-lg font-semibold">
              {t("queue.title")}
            </h2>
            {queue.length > 0 ? (
              <span className="text-muted text-sm tabular-nums">{t("queue.count", { count: queue.length })}</span>
            ) : null}
          </div>
          {queue.length === 0 ? (
            <EmptyState
              variant="card"
              icon={IconCheckCircle}
              title={t("queue.clear.title")}
              description={t("queue.clear.body")}
              action={
                <Button asChild variant="secondary">
                  <a href={href("/invoices")}>{t("queue.clear.action")}</a>
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-5">
              {(
                [
                  ["today", queue.filter((entry) => entry.urgent)],
                  ["later", queue.filter((entry) => !entry.urgent)],
                ] as const
              ).map(([group, items]) =>
                items.length ? (
                  <div key={group} className="flex flex-col gap-2" data-group={group}>
                    <h3 className="text-muted text-sm font-medium">
                      {t(`queue.group.${group}`, { count: items.length })}
                    </h3>
                    <ul className="rounded-card border-border bg-surface shadow-card divide-border divide-y overflow-hidden border">
                      {items.map((item) => (
                        <li key={item.kind}>
                          <a
                            href={item.href}
                            className="hover:bg-bg-subtle duration-fast flex items-center gap-4 px-4 py-3.5 transition-colors md:px-5"
                            data-testid="queue-item"
                            data-kind={item.kind}
                            data-count={item.count}
                          >
                            <Icon icon={item.icon} size={20} className="text-subtle shrink-0" />
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="font-medium">{item.title}</span>
                              {item.detail ? <span className="text-muted truncate text-sm">{item.detail}</span> : null}
                            </span>
                            <Icon icon={IconChevronRight} className="text-subtle shrink-0 rtl:rotate-180" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null,
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-6">
          <section
            aria-labelledby="cycle-card-title"
            className="rounded-card border-border bg-surface shadow-card flex flex-col gap-4 border p-5"
            data-testid="cycle-card"
          >
            <div className="flex flex-col gap-1">
              <h2 id="cycle-card-title" className="text-base font-semibold">
                {t("cycle.title")}
              </h2>
              {cycle ? (
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">
                    {cycle.propertyName} · {formatPeriodKey(cycle.periodKey, locale)}
                  </span>
                  {cycleStatus ? <StatusBadgeOf map={BILLING_CYCLE_STATUS} value={cycleStatus} size="sm" /> : null}
                </p>
              ) : (
                <p className="text-muted text-sm">{t("cycle.none")}</p>
              )}
            </div>
            {cycle && stageIndex >= 0 ? (
              <StageRail
                label={t("cycle.stages")}
                current={cycleStatus === "closed" ? CYCLE_STAGES.length : stageIndex}
                stages={CYCLE_STAGES.map((stage) => ({
                  key: stage,
                  label: t(`cycle.stage.${stage}`),
                  detail:
                    stage === "readings_pending" && nextCutoff ? (
                      <span data-testid="next-cutoff">
                        {t("cycle.cutoff", { date: formatDateTime(nextCutoff, locale) })}
                      </span>
                    ) : undefined,
                }))}
              />
            ) : null}
            {nextCutoff && stageIndex !== CYCLE_STAGES.indexOf("readings_pending") ? (
              <p className="text-muted text-sm" data-testid="next-cutoff">
                {t("cycle.cutoff", { date: formatDateTime(nextCutoff, locale) })}
              </p>
            ) : null}
            {cycle?.autoIssueAt ? (
              <p className="text-muted text-sm">
                {t("cycle.autoIssue", { at: formatDateTime(cycle.autoIssueAt, locale) })}
              </p>
            ) : null}
            {cycle?.issuedAt ? (
              <p className="text-muted text-sm">
                {t("cycle.issuedAt", { at: formatDateTime(cycle.issuedAt, locale) })}
              </p>
            ) : null}
            <Button asChild variant="secondary">
              <a href={href("/billing")} data-testid="cycle-open">
                {t("cycle.open")}
              </a>
            </Button>
          </section>

          <section
            aria-labelledby="compliance-title"
            className="rounded-card border-border bg-surface shadow-card flex flex-col gap-3 border p-5"
            data-testid="compliance-score"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 id="compliance-title" className="text-base font-semibold">
                  {t("compliance.title")}
                </h2>
                <p className="text-muted text-sm">{t("compliance.description")}</p>
              </div>
              {d ? (
                <p className="flex shrink-0 items-baseline gap-1">
                  <span className="text-2xl font-semibold tabular-nums" data-testid="compliance-value">
                    {formatDecimal(d.compliance.score, locale, 0)}
                  </span>
                  <span className="text-muted text-sm">{t("compliance.outOf")}</span>
                </p>
              ) : null}
            </div>
            {score.data ? (
              <ul className="divide-border flex flex-col divide-y text-sm">
                {score.data.components.map((component) => (
                  <li
                    key={component.key}
                    className="flex justify-between gap-3 py-1.5"
                    data-testid="compliance-component"
                  >
                    <span>{t(`compliance.component.${component.key}`)}</span>
                    <span className="text-muted shrink-0 tabular-nums">
                      {component.ratio === null
                        ? t("compliance.notJudged")
                        : t("compliance.ratio", {
                            numerator: component.numerator,
                            denominator: component.denominator,
                          })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            {d && d.compliance.linesAboveCap > 0 ? (
              <Callout tone="warning">
                {t("compliance.aboveCap", {
                  lines: d.compliance.linesAboveCap,
                  acknowledged: d.compliance.linesAboveCapAcknowledged,
                })}
              </Callout>
            ) : null}
          </section>
        </div>
      </div>

      {!building && context.buildings.length > 1 ? (
        <section aria-labelledby="all-buildings" className="flex flex-col gap-3" data-testid="all-buildings">
          <h2 id="all-buildings" className="text-lg font-semibold">
            {t("summary.title")}
          </h2>
          <SimpleTable
            caption={t("summary.title")}
            stackOnPhones
            minWidth="36rem"
            columns={[
              { key: "building", header: t("summary.building"), phone: "title" },
              { key: "units", header: t("summary.units"), align: "end", phone: "figure" },
              { key: "readings", header: t("summary.readings"), align: "end", phone: "meta" },
              { key: "loss", header: t("summary.loss"), align: "end", phone: "meta" },
            ]}
            rows={context.buildings.map((row) => {
              const round = roundList.find((candidate) => candidate.buildingId === row.id);
              const loss = d?.loss.filter((candidate) => candidate.buildingId === row.id) ?? [];
              return {
                key: row.id,
                href: href(`/buildings/${row.id}`),
                testId: "summary-row",
                cells: {
                  building: row.name,
                  units: (
                    <span>
                      {formatNumber(row.unitCount, locale)}
                      <span className="text-muted md:hidden"> {t("summary.units")}</span>
                    </span>
                  ),
                  readings: (
                    <span>
                      <span className="text-muted md:hidden">{t("summary.readings")} </span>
                      {round ? formatNumber(round.remaining, locale) : "—"}
                    </span>
                  ),
                  loss: loss.length
                    ? loss
                        .map(
                          (l) =>
                            `${t(`utility.${l.utility === "water" ? "water" : "electric"}`)} ${l.lossPct ? formatPercent(l.lossPct, locale, 1) : "—"}`,
                        )
                        .join(" · ")
                    : "—",
                },
              };
            })}
          />
        </section>
      ) : null}
    </OwnerPage>
  );
}

const CYCLE_STAGES = ["open", "readings_pending", "computed", "issued", "closed"] as const;
const CYCLE_VALUES = new Set(Object.keys(BILLING_CYCLE_STATUS));
function isCycleStatus(value: string): value is Schemas["BillingCycleStatus"] {
  return CYCLE_VALUES.has(value);
}
