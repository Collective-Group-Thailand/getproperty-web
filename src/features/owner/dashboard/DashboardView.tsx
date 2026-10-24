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
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { Stat } from "@/ui/components/Stat";
import { Icon, type IconGlyph } from "@/ui/icons";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconLease } from "@/ui/icons/glyphs/lease";
import { IconLink } from "@/ui/icons/glyphs/link";
import { IconLoss } from "@/ui/icons/glyphs/loss";
import { IconMeter } from "@/ui/icons/glyphs/meter";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { IconPayment } from "@/ui/icons/glyphs/payment";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconRoom } from "@/ui/icons/glyphs/room";
import { IconShield } from "@/ui/icons/glyphs/shield";
import { IconStaff } from "@/ui/icons/glyphs/staff";
import { IconTimer } from "@/ui/icons/glyphs/timer";
import { IconUpload } from "@/ui/icons/glyphs/upload";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

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

  const scope = building
    ? building.name
    : context.buildings.length > 1
      ? t("allBuildings")
      : (context.buildings[0]?.name ?? "");
  const cycle = d?.cycles[0];

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
      />
      <p className="sr-only" data-testid="dashboard-tenant">
        {context.me.currentTenant?.displayName}
      </p>

      {dashboard.error ? <Callout tone="danger">{t("unavailable")}</Callout> : null}

      <section aria-labelledby="today-queue" className="flex flex-col gap-3" data-testid="today-queue">
        <h2 id="today-queue" className="text-lg font-semibold">
          {t("queue.title")}
        </h2>
        {queue.length === 0 ? (
          <Card>
            <EmptyState icon={IconCheckCircle} title={t("queue.clear.title")} description={t("queue.clear.body")} />
          </Card>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {queue.map((item) => (
              <li key={item.kind}>
                <a
                  href={item.href}
                  className="rounded-card border-border bg-surface shadow-card hover:shadow-raised flex min-h-20 items-center gap-4 border p-4 transition-shadow"
                  data-testid="queue-item"
                  data-kind={item.kind}
                  data-count={item.count}
                >
                  <span className="rounded-control bg-primary-subtle text-primary-subtle-fg flex size-11 shrink-0 items-center justify-center">
                    <Icon icon={item.icon} size={22} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-center gap-2 font-semibold">
                      {item.title}
                      {item.urgent ? (
                        <Badge tone="warning" size="sm">
                          {t("queue.today")}
                        </Badge>
                      ) : null}
                    </span>
                    {item.detail ? <span className="text-muted text-sm">{item.detail}</span> : null}
                  </span>
                  <Icon icon={IconChevronRight} className="text-muted shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="kpis" className="flex flex-col gap-3">
        <h2 id="kpis" className="sr-only">
          {t("kpi.title")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div data-testid="kpi-collected">
            <Stat
              label={t("kpi.collected")}
              icon={IconPayment}
              value={d?.billing.collectedPct ? formatPercent(d.billing.collectedPct, locale, 1) : "—"}
              hint={
                d
                  ? t("kpi.collectedHint", {
                      collected: formatTHB(d.billing.collected, locale),
                      billed: formatTHB(d.billing.billed, locale),
                    })
                  : undefined
              }
            />
          </div>
          <div data-testid="kpi-arrears">
            <Stat
              label={t("kpi.arrears")}
              icon={IconClock}
              value={d ? formatTHB(d.arrears.balance, locale) : "—"}
              hint={d ? t("kpi.arrearsHint", { invoices: d.arrears.invoices, parties: d.arrears.parties }) : undefined}
            />
          </div>
          <div data-testid="kpi-occupancy">
            <Stat
              label={t("kpi.occupancy")}
              icon={IconRoom}
              value={
                board.data
                  ? formatPercent(board.data.summary.occupancyPct, locale, 1)
                  : count.data
                    ? `${formatNumber(count.data.byStatus.occupied, locale)} / ${formatNumber(count.data.billable, locale)}`
                    : "—"
              }
              hint={
                board.data
                  ? t("kpi.occupancyHint", { occupied: board.data.summary.occupied, total: board.data.summary.total })
                  : count.data
                    ? t("kpi.occupancyAllHint", { vacant: count.data.byStatus.vacant })
                    : undefined
              }
            />
          </div>
          <div data-testid="kpi-loss">
            <LossStat loss={d?.loss ?? []} locale={locale} label={t("kpi.loss")} t={t} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" aria-labelledby="cycle-card-title" data-testid="cycle-card">
          <CardHeader
            title={<span id="cycle-card-title">{t("cycle.title")}</span>}
            action={
              <Button asChild size="sm" variant="secondary">
                <a href={href("/billing")}>{t("cycle.open")}</a>
              </Button>
            }
          />
          {cycle ? (
            <div className="flex flex-col gap-2">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{cycle.propertyName}</span>
                <span className="text-muted">{formatPeriodKey(cycle.periodKey, locale)}</span>
                {isCycleStatus(cycle.status) ? (
                  <StatusBadgeOf map={BILLING_CYCLE_STATUS} value={cycle.status} size="sm" />
                ) : null}
              </p>
              {nextCutoff ? (
                <p className="text-muted text-sm" data-testid="next-cutoff">
                  {t("cycle.cutoff", { date: formatDateTime(nextCutoff, locale) })}
                </p>
              ) : null}
              {cycle.autoIssueAt ? (
                <Callout tone="info">{t("cycle.autoIssue", { at: formatDateTime(cycle.autoIssueAt, locale) })}</Callout>
              ) : null}
              {cycle.issuedAt ? (
                <p className="text-muted text-sm">
                  {t("cycle.issuedAt", { at: formatDateTime(cycle.issuedAt, locale) })}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted text-sm">{t("cycle.none")}</p>
          )}
        </Card>

        <Card as="section" aria-labelledby="compliance-title" data-testid="compliance-score">
          <CardHeader
            title={<span id="compliance-title">{t("compliance.title")}</span>}
            description={t("compliance.description")}
          />
          {d ? (
            <div className="flex flex-col gap-3">
              <p className="flex items-baseline gap-2">
                <Icon icon={IconShield} className="text-primary self-center" size={22} />
                <span className="font-display text-3xl font-semibold tabular-nums" data-testid="compliance-value">
                  {formatDecimal(d.compliance.score, locale, 0)}
                </span>
                <span className="text-muted text-sm">{t("compliance.outOf")}</span>
              </p>
              {score.data ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {score.data.components.map((component) => (
                    <li key={component.key} className="flex justify-between gap-3" data-testid="compliance-component">
                      <span>{t(`compliance.component.${component.key}`)}</span>
                      <span className="text-muted tabular-nums">
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
              {d.compliance.linesAboveCap > 0 ? (
                <Badge tone="warning" icon={IconLoss}>
                  {t("compliance.aboveCap", {
                    lines: d.compliance.linesAboveCap,
                    acknowledged: d.compliance.linesAboveCapAcknowledged,
                  })}
                </Badge>
              ) : null}
            </div>
          ) : null}
        </Card>
      </div>

      <section aria-labelledby="quick-actions" className="flex flex-col gap-3">
        <h2 id="quick-actions" className="text-lg font-semibold">
          {t("quick.title")}
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" iconStart={IconPayment}>
            <a href={href("/payments/new")}>{t("quick.recordPayment")}</a>
          </Button>
          <Button asChild variant="secondary" iconStart={IconLease}>
            <a href={href("/leases/new")}>{t("quick.newLease")}</a>
          </Button>
          <Button asChild variant="secondary" iconStart={IconBill}>
            <a href={href("/billing")}>{t("quick.billing")}</a>
          </Button>
          <Button asChild variant="secondary" iconStart={IconAdd}>
            <a href={href("/parties", { new: "1" })}>{t("quick.newParty")}</a>
          </Button>
          {building ? (
            <Button asChild variant="secondary" iconStart={IconUpload}>
              <a href={href(`/buildings/${building.id}/import`)}>{t("quick.importUnits")}</a>
            </Button>
          ) : null}
        </div>
      </section>

      {!building && context.buildings.length > 1 ? (
        <section aria-labelledby="all-buildings" className="flex flex-col gap-3" data-testid="all-buildings">
          <h2 id="all-buildings" className="text-lg font-semibold">
            {t("summary.title")}
          </h2>
          <div className="border-border bg-surface rounded-card relative overflow-x-auto border">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("summary.title")}</caption>
              <thead className="bg-bg-subtle text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 text-start font-medium">
                    {t("summary.building")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-end font-medium">
                    {t("summary.units")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-end font-medium">
                    {t("summary.readings")}
                  </th>
                  <th scope="col" className="px-4 py-2 text-end font-medium">
                    {t("summary.loss")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {context.buildings.map((row) => {
                  const round = roundList.find((candidate) => candidate.buildingId === row.id);
                  const loss = d?.loss.filter((candidate) => candidate.buildingId === row.id) ?? [];
                  return (
                    <tr key={row.id} className="border-border border-t" data-testid="summary-row">
                      <th scope="row" className="px-4 py-2 text-start font-medium">
                        <a
                          className="text-primary underline-offset-4 hover:underline"
                          href={href(`/buildings/${row.id}`)}
                        >
                          {row.name}
                        </a>
                      </th>
                      <td className="px-4 py-2 text-end tabular-nums">{formatNumber(row.unitCount, locale)}</td>
                      <td className="px-4 py-2 text-end tabular-nums">
                        {round ? formatNumber(round.remaining, locale) : "—"}
                      </td>
                      <td className="px-4 py-2 text-end tabular-nums">
                        {loss.length
                          ? loss
                              .map(
                                (l) =>
                                  `${t(`utility.${l.utility === "water" ? "water" : "electric"}`)} ${l.lossPct ? formatPercent(l.lossPct, locale, 1) : "—"}`,
                              )
                              .join(" · ")
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </OwnerPage>
  );
}

const CYCLE_VALUES = new Set(Object.keys(BILLING_CYCLE_STATUS));
function isCycleStatus(value: string): value is Schemas["BillingCycleStatus"] {
  return CYCLE_VALUES.has(value);
}

function LossStat({
  loss,
  locale,
  label,
  t,
}: {
  loss: Schemas["DashboardLossDto"][];
  locale: OwnerContext["locale"];
  label: string;
  t: Awaited<ReturnType<typeof getTranslations<"owner.dashboard">>>;
}) {
  const electric = loss.find((row) => row.utility === "electric");
  const first = electric ?? loss[0];
  return (
    <Stat
      label={label}
      icon={IconLoss}
      value={first?.lossPct ? formatPercent(first.lossPct, locale, 1) : "—"}
      hint={
        loss.length ? (
          <span className="flex flex-col">
            {loss.map((row) => (
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
        )
      }
    />
  );
}
