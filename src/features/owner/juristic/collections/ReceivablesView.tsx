import { getTranslations } from "next-intl/server";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { formatDate, formatNumber, formatPercent, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { AgingStrip } from "@/ui/components/AgingStrip";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { StatsRow, type Figure } from "@/ui/components/StatsRow";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconLetter } from "@/ui/icons/glyphs/letter";

import { ownerPath, withQuery } from "../../shared/links";
import { ownerCan, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { agingTiles } from "./aging";
import { ReceivablesExport } from "./ReceivablesExport";
import { ReceivablesTable, type ReceivableRow } from "./ReceivablesTable";
import { ariaSort, PER_PAGE, RECEIVABLE_TABS, receivablesQuery, sortLink } from "./receivables";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Receivables of the juristic office (JW1b, J-DESIGN §3, Stitch `receivables-desktop`): who still owes what and what
 * happens next. Figures (outstanding highlighted), the aging strip, underline tabs with counts, search and sort, the
 * table with the owner's context line and the next ladder step, selection with the bulk bar, CSV through the export
 * worker. Every figure is the API's; the page never sums.
 */
export async function ReceivablesView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.collections.receivables");
  const { api, locale, me } = context;
  const state = receivablesQuery(searchParams);
  const buildingId = param(searchParams.building);
  const base = ownerPath(locale, "/juristic/receivables");
  const scope = { ...(buildingId ? { buildingId } : {}) };
  // The figures read the whole book (no search): its totals and `counts` (J-CR); the tabs count the list's own search.
  const [list, all, aging, rate, settings] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/juristic/receivables", {
          params: {
            query: {
              ...scope,
              tab: state.tab,
              sort: state.sort,
              order: state.order,
              page: state.page,
              perPage: PER_PAGE,
              ...(state.q ? { q: state.q } : {}),
            },
          },
        }),
      ),
    ),
    section(
      unwrap(api.GET("/v1/owner/juristic/receivables", { params: { query: { ...scope, tab: "all", perPage: 1 } } })),
    ),
    section(unwrap(api.GET("/v1/owner/juristic/reports/aging", { params: { query: scope } }))),
    section(unwrap(api.GET("/v1/owner/juristic/reports/collection-rate", { params: { query: scope } }))),
    section(unwrap(api.GET("/v1/owner/settings", { params: { query: {} } }))),
  ]);
  const writable = !readOnly(me);
  const canManage = writable && ownerCan(me, "juristic.collections.manage");
  const money = (value: string) => formatTHB(value, locale);
  const n = (value: number) => formatNumber(value, locale);
  const maxInstalments = settings.data?.find((setting) => setting.key === "juristic.plan_max_instalments")?.value;

  const figures: Figure[] = [];
  if (rate.data) {
    figures.push({
      key: "billed",
      label: t("figures.billed"),
      value: money(rate.data.total.billed),
      hint: t("figures.billedHint", {
        from: formatDate(rate.data.from, locale, { style: "month" }),
        to: formatDate(rate.data.to, locale, { style: "month" }),
      }),
    });
    figures.push({
      key: "collected",
      label: t("figures.collected"),
      value: rate.data.total.collectionRatePct ? formatPercent(rate.data.total.collectionRatePct, locale) : "—",
      hint: rate.data.total.withinDaysRatePct
        ? t("figures.collectedHint", {
            days: n(rate.data.kpiDays),
            pct: formatPercent(rate.data.total.withinDaysRatePct, locale),
          })
        : undefined,
    });
  }
  if (all.data) {
    figures.push({
      key: "outstanding",
      label: t("figures.outstanding"),
      value: money(all.data.totals.outstanding),
      hint: t("figures.outstandingHint", { surcharge: money(all.data.totals.surcharge) }),
      testId: "receivables-outstanding",
    });
    figures.push({
      key: "accounts",
      label: t("figures.accounts"),
      value: n(all.data.counts.all),
      hint: t("figures.accountsHint"),
    });
    figures.push({
      key: "plans",
      label: t("figures.plans"),
      value: n(all.data.counts.plan),
      hint: t("figures.plansHint"),
      href: withQuery(base, { tab: "plan" }),
    });
  }

  const tiles = aging.data
    ? agingTiles(aging.data.overall.buckets, {
        range: (from, to) => t("aging.range", { from: n(from), to: n(to) }),
        over: (from) => t("aging.over", { days: n(from) }),
        accounts: (value) => t("aging.accounts", { count: value }),
        money,
        oldest: t("aging.oldest"),
        href: () => withQuery(base, { sort: "age", order: "desc" }),
      })
    : [];

  const tabCounts = list.data?.counts;
  const counts: Record<(typeof RECEIVABLE_TABS)[number], number | undefined> = {
    all: tabCounts?.all,
    at_step: tabCounts?.atStep,
    plan: tabCounts?.plan,
    dispute: tabCounts?.dispute,
  };
  const rows: ReceivableRow[] = (list.data?.data ?? []).map((row) => ({
    ...row,
    href: row.caseId ? ownerPath(locale, `/juristic/receivables/${row.caseId}`) : null,
  }));
  const filtered = Boolean(state.q) || state.tab !== "all";
  const tabHref = (tab: (typeof RECEIVABLE_TABS)[number]) =>
    withQuery(base, { tab: tab === "all" ? undefined : tab, q: state.q });
  const sortHref = (column: "amount" | "age") =>
    withQuery(base, { tab: state.tab === "all" ? undefined : state.tab, q: state.q, ...sortLink(state, column) });

  return (
    <OwnerPage testId="juristic-receivables">
      <PageHeader
        title={t("title")}
        description={t("lede", { date: formatDate(currentTime(), locale) })}
        actions={
          <>
            <Button asChild variant="secondary" iconStart={IconLetter}>
              <a href={ownerPath(locale, "/juristic/statements")}>{t("statements")}</a>
            </Button>
            {writable && ownerCan(me, "export.create") ? (
              <ReceivablesExport
                params={{ tab: state.tab, sort: state.sort, ...(state.q ? { q: state.q } : {}), ...scope }}
              />
            ) : null}
          </>
        }
      />

      {figures.length ? <StatsRow label={t("figures.label")} highlight="outstanding" figures={figures} /> : null}
      {!all.data ? <SectionError error={all.error} /> : null}

      {aging.data && tiles.length ? (
        <section aria-labelledby="aging-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="aging-title" className="text-lg font-semibold">
              {t("aging.title")}
            </h2>
            <p className="text-muted m-0 text-sm">{t("aging.asOf", { date: formatDate(aging.data.asOf, locale) })}</p>
          </div>
          <AgingStrip label={t("aging.title")} tiles={tiles} />
        </section>
      ) : null}

      <section aria-labelledby="list-title" className="flex flex-col gap-4">
        <h2 id="list-title" className="sr-only">
          {t("listTitle")}
        </h2>
        <ListToolbar
          tabs={
            <LinkTabs
              label={t("show")}
              current={tabHref(state.tab)}
              tabs={RECEIVABLE_TABS.map((tab) => ({
                href: tabHref(tab),
                label: t(`tab.${tab}`),
                count: counts[tab],
                testId: `receivables-tab-${tab}`,
              }))}
            />
          }
          filters={
            <FilterBar
              variant="toolbar"
              fields={[
                { name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") },
                {
                  name: "sort",
                  label: t("sortLabel"),
                  type: "select",
                  fallback: "amount",
                  options: [
                    { value: "amount", label: t("sort.amount") },
                    { value: "age", label: t("sort.age") },
                  ],
                },
              ]}
            />
          }
        />
        {!list.data ? (
          <SectionError error={list.error} />
        ) : rows.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconCheckCircle}
            title={filtered ? t("empty.filteredTitle") : t("empty.title")}
            description={filtered ? t("empty.filtered") : t("empty.body")}
            action={
              <Button asChild variant="secondary">
                <a href={filtered ? base : ownerPath(locale, "/juristic")}>
                  {filtered ? t("empty.clear") : t("empty.overview")}
                </a>
              </Button>
            }
          />
        ) : (
          <ReceivablesTable
            rows={rows}
            canManage={canManage}
            maxInstalments={typeof maxInstalments === "number" ? maxInstalments : null}
            sort={{
              amount: { href: sortHref("amount"), aria: ariaSort(state, "amount") },
              age: { href: sortHref("age"), aria: ariaSort(state, "age") },
            }}
          />
        )}
        {list.data && list.data.meta.total > list.data.meta.perPage ? (
          <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
        ) : null}
      </section>
    </OwnerPage>
  );
}
