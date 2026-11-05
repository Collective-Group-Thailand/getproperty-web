import { getTranslations } from "next-intl/server";

import { BILLING_CYCLE_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatPercent, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { AgingStrip } from "@/ui/components/AgingStrip";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { RowList, type RowListItem } from "@/ui/components/RowList";
import { Stepper } from "@/ui/components/Stepper";
import { StatsRow, type Figure } from "@/ui/components/StatsRow";
import { IconBook } from "@/ui/icons/glyphs/book";
import { IconCalculator } from "@/ui/icons/glyphs/calculator";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";
import { IconRules } from "@/ui/icons/glyphs/rules";

import { ownerPath, withQuery } from "../shared/links";
import { agingTiles } from "./collections/aging";
import { ownerCan, section, type OwnerContext } from "../shared/server";
import { currentTime } from "@/features/shared/console/time";

/** This cycle's rail (J-DESIGN §JW1): open → computed → issued → collecting; a closed cycle has passed every stage. */
const RAIL = ["open", "computed", "issued", "collecting"] as const;
const RAIL_INDEX: Record<Schemas["BillingCycleStatus"], number> = {
  open: 0,
  readings_pending: 0,
  computed: 1,
  // An issued cycle is being collected: its bills are out, the money is coming in.
  issued: 3,
  closed: 4,
  cancelled: 0,
};

/**
 * The juristic office's morning (JW1a, J-DESIGN §1.1 "money first, calmly"): what was billed and collected, the
 * money still owed (the one figure that needs attention), how old it is, where this cycle stands, and the few things
 * waiting for someone. Every figure is the API's (`reports/collection-rate`, `reports/aging`, list totals); the
 * outstanding figure and the aging tiles open the receivables (JW1b).
 */
export async function OverviewView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.juristic.overview");
  const { api, locale, me } = context;
  const can = (permission: string) => ownerCan(me, permission);
  const collections = can("juristic.collections.read");
  const total = (read: Promise<{ meta: { total: number } }>) => section(read.then((page) => page.meta.total));
  const [rate, aging, plans, clearances, disputes, budgets, resolutions, incomplete, cycles] = await Promise.all([
    collections || can("report.read")
      ? section(unwrap(api.GET("/v1/owner/juristic/reports/collection-rate", { params: { query: {} } })))
      : Promise.resolve(null),
    collections
      ? section(unwrap(api.GET("/v1/owner/juristic/reports/aging", { params: { query: {} } })))
      : Promise.resolve(null),
    collections
      ? total(
          unwrap(api.GET("/v1/owner/juristic/payment-plans", { params: { query: { state: "active", perPage: 1 } } })),
        )
      : Promise.resolve(null),
    collections
      ? total(
          unwrap(
            api.GET("/v1/owner/juristic/debt-clearances", { params: { query: { state: "requested", perPage: 1 } } }),
          ),
        )
      : Promise.resolve(null),
    collections
      ? total(unwrap(api.GET("/v1/owner/juristic/receivables", { params: { query: { tab: "dispute", perPage: 1 } } })))
      : Promise.resolve(null),
    can("juristic.budget.read")
      ? total(unwrap(api.GET("/v1/owner/juristic/budgets", { params: { query: { state: "draft", perPage: 1 } } })))
      : Promise.resolve(null),
    can("juristic.resolution.read")
      ? total(unwrap(api.GET("/v1/owner/juristic/resolutions", { params: { query: { state: "draft", perPage: 1 } } })))
      : Promise.resolve(null),
    can("juristic.register.read")
      ? total(unwrap(api.GET("/v1/owner/juristic/register", { params: { query: { incomplete: true, perPage: 1 } } })))
      : Promise.resolve(null),
    can("invoice.read")
      ? section(unwrap(api.GET("/v1/owner/billing-cycles", { params: { query: { perPage: 20 } } })))
      : Promise.resolve(null),
  ]);

  const money = (value: string) => formatTHB(value, locale);
  const count = (value: number) => formatNumber(value, locale);
  const figures: Figure[] = [];
  if (rate?.data) {
    figures.push({
      key: "billed",
      label: t("figures.billed"),
      value: money(rate.data.total.billed),
      hint: t("figures.billedHint", {
        from: formatDate(rate.data.from, locale, { style: "month" }),
        to: formatDate(rate.data.to, locale, { style: "month" }),
      }),
      testId: "figure-billed",
    });
    figures.push({
      key: "collected",
      label: t("figures.collected"),
      value: rate.data.total.collectionRatePct ? `${formatPercent(rate.data.total.collectionRatePct, locale)}` : "—",
      hint: rate.data.total.withinDaysRatePct
        ? t("figures.collectedHint", {
            days: count(rate.data.kpiDays),
            pct: formatPercent(rate.data.total.withinDaysRatePct, locale),
          })
        : undefined,
      testId: "figure-collected",
    });
  }
  if (aging?.data) {
    figures.push({
      key: "outstanding",
      label: t("figures.outstanding"),
      value: money(aging.data.overall.overdue.amount),
      hint: t("figures.outstandingHint"),
      testId: "figure-outstanding",
      href: collections ? ownerPath(locale, "/juristic/receivables") : undefined,
    });
    figures.push({
      key: "accounts",
      label: t("figures.accounts"),
      value: count(aging.data.overall.overdue.accounts),
      hint: t("figures.accountsHint"),
      testId: "figure-accounts",
    });
  }
  if (plans?.data !== undefined && plans?.data !== null) {
    figures.push({
      key: "plans",
      label: t("figures.plans"),
      value: count(plans.data),
      hint: t("figures.plansHint"),
      testId: "figure-plans",
      href: ownerPath(locale, withQuery("/juristic/plans", { state: "active" })),
    });
  }

  const buckets = aging?.data?.overall.buckets ?? [];
  const tiles = agingTiles(buckets, {
    range: (from, to) => t("aging.range", { from: count(from), to: count(to) }),
    over: (from) => t("aging.over", { days: count(from) }),
    accounts: (value) => t("aging.accounts", { count: value }),
    money,
    oldest: t("aging.oldest"),
    href: collections
      ? () => ownerPath(locale, withQuery("/juristic/receivables", { sort: "age", order: "desc" }))
      : undefined,
  });

  // This cycle per property: the newest cycle that is not closed, else the newest one.
  const byProperty = new Map<string, Schemas["BillingCycleDto"]>();
  for (const cycle of [...(cycles?.data?.data ?? [])].sort((a, b) => b.periodStart.localeCompare(a.periodStart))) {
    const known = byProperty.get(cycle.propertyId);
    if (!known || (known.status === "closed" && cycle.status !== "closed" && cycle.status !== "cancelled"))
      byProperty.set(cycle.propertyId, cycle);
  }
  const rails = [...byProperty.values()].filter((cycle) => cycle.status !== "cancelled");

  const tasks: (RowListItem & { count: number })[] = [
    {
      key: "budgets",
      icon: IconCalculator,
      title: t("tasks.budgets"),
      meta: t("tasks.budgetsHint"),
      count: budgets?.data ?? 0,
      href: ownerPath(locale, withQuery("/juristic/budgets", { state: "draft" })),
    },
    {
      key: "resolutions",
      icon: IconRules,
      title: t("tasks.resolutions"),
      meta: t("tasks.resolutionsHint"),
      count: resolutions?.data ?? 0,
      href: ownerPath(locale, withQuery("/juristic/resolutions", { state: "draft" })),
    },
    {
      key: "register",
      icon: IconBook,
      title: t("tasks.register"),
      meta: t("tasks.registerHint"),
      count: incomplete?.data ?? 0,
      href: ownerPath(locale, withQuery("/juristic/register", { view: "incomplete" })),
    },
    // Debt clearance requests and disputes are worked on the collection pages (JW1b).
    {
      key: "clearances",
      icon: IconReceipt,
      title: t("tasks.clearances"),
      meta: t("tasks.clearancesHint"),
      count: clearances?.data ?? 0,
      href: ownerPath(locale, withQuery("/juristic/debt-clearance", { state: "requested" })),
    },
    {
      key: "disputes",
      icon: IconFlag,
      title: t("tasks.disputes"),
      meta: t("tasks.disputesHint"),
      count: disputes?.data ?? 0,
      href: ownerPath(locale, withQuery("/juristic/receivables", { tab: "dispute" })),
    },
  ].filter((task) => task.count > 0);

  return (
    <OwnerPage testId="juristic-overview">
      <PageHeader
        title={t("title")}
        description={t("lede", { name: me.currentTenant?.displayName ?? "", date: formatDate(currentTime(), locale) })}
        actions={
          can("juristic.register.read") ? (
            <Button asChild variant="secondary" iconStart={IconBook}>
              <a href={ownerPath(locale, "/juristic/register")}>{t("openRegister")}</a>
            </Button>
          ) : undefined
        }
      />

      {figures.length ? (
        <StatsRow label={t("figures.label")} highlight={aging?.data ? "outstanding" : undefined} figures={figures} />
      ) : rate && !rate.data ? (
        <SectionError error={rate.error} />
      ) : null}

      {aging ? (
        aging.data ? (
          <section aria-labelledby="aging-title" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="aging-title" className="text-lg font-semibold">
                {t("aging.title")}
              </h2>
              <p className="text-muted m-0 text-sm">{t("aging.asOf", { date: formatDate(aging.data.asOf, locale) })}</p>
            </div>
            {tiles.length ? (
              <AgingStrip label={t("aging.title")} tiles={tiles} />
            ) : (
              <p className="text-muted m-0 text-sm">{t("aging.none")}</p>
            )}
          </section>
        ) : (
          <SectionError error={aging.error} />
        )
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card as="section" aria-labelledby="cycle-rail-title" className="flex flex-col gap-5" data-testid="cycle-rail">
          <CardHeader
            title={<span id="cycle-rail-title">{t("cycle.title")}</span>}
            description={t("cycle.hint")}
            action={
              <a
                className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                href={ownerPath(locale, "/juristic/cycles")}
              >
                {t("cycle.all")}
              </a>
            }
          />
          {rails.length === 0 ? (
            <EmptyState
              variant="plain"
              icon={IconCalendar}
              title={t("cycle.noneTitle")}
              description={t("cycle.none")}
              action={
                <Button asChild variant="secondary">
                  <a href={ownerPath(locale, "/billing/rate-plans")}>{t("cycle.noneAction")}</a>
                </Button>
              }
            />
          ) : (
            rails.map((cycle) => (
              <div key={cycle.id} className="flex flex-col gap-3" data-testid="cycle-rail-item">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a
                    className="font-medium underline-offset-4 hover:underline"
                    href={ownerPath(
                      locale,
                      withQuery("/juristic/cycles", { property: cycle.propertyId, cycle: cycle.id }),
                    )}
                  >
                    {t("cycle.name", {
                      property: cycle.propertyName,
                      period: formatPeriodKey(cycle.periodKey, locale),
                    })}
                  </a>
                  <StatusBadgeOf map={BILLING_CYCLE_STATUS} value={cycle.status} size="sm" />
                </div>
                <Stepper
                  labelled
                  label={t("cycle.stages")}
                  current={Math.min(RAIL_INDEX[cycle.status], RAIL.length - 1)}
                  progressText={t("cycle.progress", {
                    step: Math.min(RAIL_INDEX[cycle.status] + 1, RAIL.length),
                    total: RAIL.length,
                  })}
                  steps={RAIL.map((stage) => ({ id: stage, label: t(`cycle.stage.${stage}`) }))}
                />
              </div>
            ))
          )}
        </Card>

        <section aria-labelledby="tasks-title" className="flex flex-col gap-3" data-testid="juristic-tasks">
          <h2 id="tasks-title" className="text-lg font-semibold">
            {t("tasks.title")}
          </h2>
          {tasks.length === 0 ? (
            <EmptyState
              variant="card"
              icon={IconCheckCircle}
              title={t("tasks.noneTitle")}
              description={t("tasks.none")}
              action={
                <Button asChild variant="secondary">
                  <a href={ownerPath(locale, "/juristic/register")}>{t("openRegister")}</a>
                </Button>
              }
            />
          ) : (
            <RowList
              label={t("tasks.title")}
              stacked
              items={tasks.map(({ count: n, ...task }) => ({
                ...task,
                testId: `task-${task.key}`,
                figure: <span className="font-semibold tabular-nums">{count(n)}</span>,
              }))}
            />
          )}
        </section>
      </div>
    </OwnerPage>
  );
}
