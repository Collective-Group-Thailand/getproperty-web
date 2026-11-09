import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { MANAGEMENT_CONTRACT_STATUS } from "@/domain/status";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { bangkokToday } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatPercent, formatPeriodKey, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { FilterLinks, ViewTabs } from "@/ui/components/ListToolbar";
import { ProgressLine } from "@/ui/components/ProgressLine";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { StatusText } from "@/ui/components/StatusText";
import { Icon } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconContract } from "@/ui/icons/glyphs/contract";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconSend } from "@/ui/icons/glyphs/send";
import { IconStaff } from "@/ui/icons/glyphs/staff";

import { ownerPath, withQuery } from "../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../shared/server";
import { ContractRecordView, feeLine } from "./ContractRecord";
import { AssignStaffButton, EndAssignmentButton, type AssignableBuilding } from "./PmActions";
import {
  assignableMembers,
  assignmentWindow,
  boardBuildings,
  budgetTone,
  CONTRACT_TAB_STATE,
  CONTRACT_TABS,
  contractEndingSoon,
  contractTab,
  shareOfPct,
} from "./pm";

type SearchParams = Record<string, string | string[] | undefined>;
type Row = Schemas["PmPortfolioBuildingDto"];
type T = Awaited<ReturnType<typeof getTranslations<"owner.pm">>>;

const pct = (value: string | null, locale: Locale) => (value === null ? "—" : formatPercent(value, locale));

/** Collection in a cell: the 12-month rate with a thin line, the last cycle under it. */
function CollectionCell({ row, t, locale }: { row: Row; t: T; locale: Locale }) {
  const c = row.kpis.collection;
  return (
    <span className="flex min-w-36 flex-col gap-1">
      <span className="font-medium tabular-nums">{pct(c.collectionRatePct, locale)}</span>
      <ProgressLine
        share={shareOfPct(c.collectionRatePct)}
        label={t("kpi.collectedLabel", { rate: pct(c.collectionRatePct, locale) })}
      />
      {c.lastCycle ? (
        <span className="text-muted text-xs whitespace-nowrap">
          {t("kpi.lastCycle", {
            period: formatPeriodKey(c.lastCycle.periodKey, locale),
            rate: pct(c.lastCycle.collectionRatePct, locale),
          })}
        </span>
      ) : null}
    </span>
  );
}

function BudgetCell({ row, t, locale }: { row: Row; t: T; locale: Locale }) {
  const b = row.kpis.budget;
  if (!b) return <span className="text-muted text-sm">{t("kpi.noBudget")}</span>;
  return (
    <span className="flex min-w-36 flex-col gap-1">
      <span className="tabular-nums">
        {budgetTone(b.usedPct) === "warning" ? (
          <StatusText tone="warning" icon={IconAlert} size="sm">
            {t("kpi.budgetUsed", { pct: pct(b.usedPct, locale) })}
          </StatusText>
        ) : (
          t("kpi.budgetUsed", { pct: pct(b.usedPct, locale) })
        )}
      </span>
      <ProgressLine
        share={shareOfPct(b.usedPct)}
        label={t("kpi.budgetUsed", { pct: pct(b.usedPct, locale) })}
        tone="neutral"
      />
      <span className="text-muted text-xs whitespace-nowrap">
        {t("kpi.budgetOf", {
          year: b.fiscalYear + (locale === "th" ? 543 : 0),
          amount: formatTHB(b.budgetedExpense, locale),
        })}
      </span>
    </span>
  );
}

function WorkCell({ row, t }: { row: Row; t: T }) {
  const w = row.kpis.work;
  return (
    <span className="flex flex-col text-sm whitespace-nowrap">
      <span>{t("kpi.requests", { count: w.openRequests })}</span>
      {w.slaBreachedRequests > 0 ? (
        <StatusText tone="warning" icon={IconAlert} size="sm">
          {t("kpi.slaBreached", { count: w.slaBreachedRequests })}
        </StatusText>
      ) : (
        <span className="text-muted">{t("kpi.slaOk")}</span>
      )}
      <span className="text-muted">{t("kpi.workOrders", { count: w.openWorkOrders })}</span>
    </span>
  );
}

function ContractEndCell({ row, t, locale }: { row: Row; t: T; locale: Locale }) {
  const soon = contractEndingSoon(row.contract.daysLeft, row.kpis.expiring.withinDays);
  return (
    <span className="flex min-w-32 flex-col gap-1 text-sm">
      <span className="whitespace-nowrap">{formatDate(row.contract.terminatedOn ?? row.contract.endsOn, locale)}</span>
      {soon ? (
        <Badge tone="warning" size="sm" icon={IconCalendar}>
          {t("kpi.daysLeft", { count: row.contract.daysLeft })}
        </Badge>
      ) : (
        <span className="text-muted">{t("kpi.daysLeft", { count: row.contract.daysLeft })}</span>
      )}
      {row.kpis.expiring.vendorContracts > 0 ? (
        <span className="text-muted">{t("kpi.vendorExpiring", { count: row.kpis.expiring.vendorContracts })}</span>
      ) : null}
    </span>
  );
}

/**
 * `/portfolio` for a PM company (JW3b, D-334): every building it manages today — collection, arrears, budget use, work,
 * staff and its own contract's end — as aggregates the API computed in each juristic office; offers waiting first.
 */
export async function PmPortfolioView({ context }: { context: OwnerContext }) {
  const t = await getTranslations("owner.pm");
  const { api, locale, me } = context;
  const [portfolio, offers] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/pm/portfolio"))),
    ownerCan(me, "pm.contract.read")
      ? unwrap(api.GET("/v1/owner/pm/management-contracts", { params: { query: { state: "offered", perPage: 1 } } }))
          .then((answer) => answer.meta.total)
          .catch(() => 0)
      : Promise.resolve(0),
  ]);
  const contractsHref = ownerPath(locale, "/portfolio/contracts");
  const data = portfolio.data;
  return (
    <OwnerPage testId="pm-portfolio">
      <PageHeader
        title={t("portfolio.title")}
        description={data ? t("portfolio.lede", { date: formatDate(data.asOf, locale) }) : t("portfolio.ledeNoDate")}
      />
      {offers > 0 ? (
        <div data-testid="pm-offers-waiting">
          <Callout
            tone="info"
            icon={IconSend}
            title={t("portfolio.offers", { count: offers })}
            action={
              <a className="text-primary font-medium underline-offset-4 hover:underline" href={contractsHref}>
                {t("portfolio.offersOpen")}
              </a>
            }
          >
            {t("portfolio.offersBody")}
          </Callout>
        </div>
      ) : null}
      {!data ? (
        <SectionError error={portfolio.error} />
      ) : data.buildings.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconBuilding}
          title={t("portfolio.empty.title")}
          description={t(ownerCan(me, "pm.contract.read") ? "portfolio.empty.body" : "portfolio.empty.bodyStaff")}
          action={
            ownerCan(me, "pm.contract.read") ? (
              <a className="text-primary font-medium underline-offset-4 hover:underline" href={contractsHref}>
                {t("portfolio.empty.action")}
              </a>
            ) : undefined
          }
        />
      ) : (
        <>
          <StatsRow
            label={t("portfolio.figures")}
            highlight="overdue"
            figures={[
              {
                key: "buildings",
                label: t("figure.buildings"),
                value: formatNumber(data.totals.buildings, locale),
                hint: t("figure.units", { count: data.totals.units }),
              },
              {
                key: "collected",
                label: t("figure.collected"),
                value: pct(data.totals.collectionRatePct, locale),
                hint: t("figure.collectedHint", { amount: formatTHB(data.totals.collected, locale) }),
              },
              {
                key: "overdue",
                label: t("figure.overdue"),
                value: formatTHB(data.totals.overdueAmount, locale),
                hint: t("figure.overdueHint"),
              },
              {
                key: "requests",
                label: t("figure.requests"),
                value: formatNumber(data.totals.openRequests, locale),
                hint: t("figure.slaBreached", { count: data.totals.slaBreachedRequests }),
              },
              {
                key: "expiring",
                label: t("figure.expiring"),
                value: formatNumber(data.totals.expiringContracts, locale),
                hint: t("figure.expiringHint"),
              },
            ]}
          />
          <SimpleTable
            caption={t("portfolio.title")}
            testId="pm-buildings"
            stackOnPhones
            minWidth="72rem"
            columns={[
              { key: "building", header: t("col.building"), phone: "title" },
              { key: "collection", header: t("col.collection"), phone: "meta" },
              { key: "arrears", header: t("col.arrears"), align: "end", phone: "figure" },
              { key: "budget", header: t("col.budget"), phone: "meta" },
              { key: "work", header: t("col.work"), phone: "meta" },
              { key: "staff", header: t("col.staff"), phone: "meta" },
              { key: "contract", header: t("col.contract"), phone: "status" },
            ]}
            rows={data.buildings.map((row) => ({
              key: row.buildingId,
              href: ownerPath(locale, `/portfolio/buildings/${row.buildingId}`),
              testId: "pm-building",
              data: { building: row.buildingName },
              cells: {
                building: (
                  <span className="flex min-w-44 flex-col">
                    <span className="font-medium">{row.buildingName}</span>
                    <span className="text-muted text-sm">{row.juristicName}</span>
                    <span className="text-muted text-sm">{t("kpi.units", { count: row.kpis.units })}</span>
                  </span>
                ),
                collection: <CollectionCell row={row} t={t} locale={locale} />,
                arrears: (
                  <span className="flex flex-col items-end">
                    <span>{formatTHB(row.kpis.arrears.overdueAmount, locale)}</span>
                    <span className="text-muted text-xs whitespace-nowrap">
                      {t("kpi.accounts", { count: row.kpis.arrears.overdueAccounts })}
                    </span>
                    <span className="text-muted text-xs whitespace-nowrap">
                      {t("kpi.over90", { amount: formatTHB(row.kpis.arrears.over90Amount, locale) })}
                    </span>
                  </span>
                ),
                budget: <BudgetCell row={row} t={t} locale={locale} />,
                work: <WorkCell row={row} t={t} />,
                staff:
                  row.staffToday.length === 0 ? (
                    <StatusText tone="warning" icon={IconAlert} size="sm">
                      {t("kpi.noStaff")}
                    </StatusText>
                  ) : (
                    <span className="flex flex-col text-sm">
                      {row.staffToday.slice(0, 2).map((staff) => (
                        <span key={staff.userId} className="whitespace-nowrap">
                          {staff.displayName}
                        </span>
                      ))}
                      {row.staffToday.length > 2 ? (
                        <span className="text-muted">{t("kpi.moreStaff", { count: row.staffToday.length - 2 })}</span>
                      ) : null}
                    </span>
                  ),
                contract: <ContractEndCell row={row} t={t} locale={locale} />,
              },
            }))}
          />
          <p className="text-muted m-0 flex items-start gap-2 text-sm" data-testid="pm-privacy">
            <Icon icon={IconLock} size={16} className="text-subtle mt-0.5 shrink-0" />
            {t("privacy")}
          </p>
        </>
      )}
    </OwnerPage>
  );
}

/** The assignable buildings of the board (each with its contract's term) and the members. */
async function assignContext(context: OwnerContext) {
  const { api } = context;
  const [board, portfolio] = await Promise.all([
    unwrap(context.api.GET("/v1/owner/pm/staff-board")).catch(() => null),
    unwrap(api.GET("/v1/owner/pm/portfolio")).catch(() => null),
  ]);
  const buildings: AssignableBuilding[] =
    portfolio?.buildings.map((row) => ({
      contractId: row.contract.id,
      buildingName: row.buildingName,
      startsOn: row.contract.startsOn,
      endsOn: row.contract.endsOn,
    })) ?? [];
  return { board, buildings, members: board ? assignableMembers(board) : [] };
}

/**
 * `/portfolio/buildings/[buildingId]` (JW3b): one managed building's figures by subject, the service contracts that
 * end soon, the staff today; the panel is the management contract and the staffing action.
 */
export async function PmBuildingView({ context, buildingId }: { context: OwnerContext; buildingId: string }) {
  const t = await getTranslations("owner.pm");
  const roles = await getTranslations("owner.pm.role");
  const { api, locale, me } = context;
  let row: Row;
  try {
    row = await unwrap(api.GET("/v1/owner/pm/portfolio/buildings/{buildingId}", { params: { path: { buildingId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const today = bangkokToday();
  const canAssign = !readOnly(me) && ownerCan(me, "pm.staff.manage");
  const assign = canAssign ? await assignContext(context) : null;
  const k = row.kpis;
  const c = k.collection;
  const fee = await feeLine(row.contract, locale);
  const block = (id: string, title: string, children: React.ReactNode, lede?: string) => (
    <Card as="section" aria-labelledby={id} data-testid={id}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
          {lede ? <p className="text-muted m-0 text-sm">{lede}</p> : null}
        </div>
        {children}
      </div>
    </Card>
  );
  const pair = (label: string, value: React.ReactNode, key: string) => (
    <div key={key} className="flex items-baseline justify-between gap-4 py-2 first:pt-0 last:pb-0">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="m-0 text-end font-medium tabular-nums">{value}</dd>
    </div>
  );
  return (
    <OwnerPage testId="pm-building">
      <PageHeader
        title={row.buildingName}
        description={t("building.lede", {
          juristic: row.juristicName,
          form:
            row.legalForm && t.has(`legalForm.${row.legalForm}`)
              ? t(`legalForm.${row.legalForm}` as "legalForm.condo_act")
              : "—",
        })}
        back={{ label: t("building.back"), href: ownerPath(locale, "/portfolio") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="pm-building-panel"
            title={t("building.contractTitle")}
            description={
              <dl className="divide-border m-0 flex flex-col divide-y">
                {pair(t("building.fee"), fee, "fee")}
                {pair(
                  t("building.term"),
                  t("building.termValue", {
                    from: formatDate(row.contract.startsOn, locale),
                    to: formatDate(row.contract.endsOn, locale),
                  }),
                  "term",
                )}
                {pair(t("building.daysLeft"), t("kpi.daysLeft", { count: row.contract.daysLeft }), "left")}
              </dl>
            }
            primary={
              assign && assign.buildings.length > 0 ? (
                <AssignStaffButton
                  buildings={assign.buildings}
                  members={assign.members}
                  today={today}
                  defaultContractId={row.contract.id}
                />
              ) : undefined
            }
            secondary={
              ownerCan(me, "pm.contract.read") ? (
                <a
                  className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                  href={ownerPath(locale, `/portfolio/contracts/${row.contract.id}`)}
                  data-testid="pm-building-contract"
                >
                  {t("building.openContract")}
                </a>
              ) : undefined
            }
          />
        }
      >
        <div className="flex flex-col gap-6">
          <StatsRow
            label={t("portfolio.figures")}
            highlight="overdue"
            figures={[
              { key: "units", label: t("figure.unitsLabel"), value: formatNumber(k.units, locale) },
              {
                key: "collected",
                label: t("figure.collected"),
                value: pct(c.collectionRatePct, locale),
                hint: t("figure.withinDays", { days: c.kpiDays, rate: pct(c.withinDaysRatePct, locale) }),
              },
              {
                key: "overdue",
                label: t("figure.overdue"),
                value: formatTHB(k.arrears.overdueAmount, locale),
                hint: t("kpi.accounts", { count: k.arrears.overdueAccounts }),
              },
              {
                key: "requests",
                label: t("figure.requests"),
                value: formatNumber(k.work.openRequests, locale),
                hint: t("figure.slaBreached", { count: k.work.slaBreachedRequests }),
              },
            ]}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {block(
              "pm-collection",
              t("building.collection"),
              <dl className="divide-border m-0 flex flex-col divide-y">
                {pair(t("building.billed"), formatTHB(c.billed, locale), "billed")}
                {pair(t("building.collected"), formatTHB(c.collected, locale), "collected")}
                {pair(t("building.rate"), pct(c.collectionRatePct, locale), "rate")}
                {pair(t("building.within", { days: c.kpiDays }), pct(c.withinDaysRatePct, locale), "within")}
                {c.lastCycle
                  ? pair(
                      t("building.lastCycle", { period: formatPeriodKey(c.lastCycle.periodKey, locale) }),
                      `${formatTHB(c.lastCycle.billed, locale)} · ${pct(c.lastCycle.collectionRatePct, locale)}`,
                      "last",
                    )
                  : null}
              </dl>,
              t("building.collectionLede", { from: formatDate(c.from, locale), to: formatDate(c.to, locale) }),
            )}
            {block(
              "pm-arrears",
              t("building.arrears"),
              <dl className="divide-border m-0 flex flex-col divide-y">
                {pair(t("building.overdue"), formatTHB(k.arrears.overdueAmount, locale), "overdue")}
                {pair(t("building.over90"), formatTHB(k.arrears.over90Amount, locale), "over90")}
                {pair(t("building.invoices"), formatNumber(k.arrears.overdueInvoices, locale), "invoices")}
                {pair(t("building.accounts"), formatNumber(k.arrears.overdueAccounts, locale), "accounts")}
              </dl>,
            )}
            {block(
              "pm-budget",
              t("building.budget"),
              k.budget ? (
                <div className="flex flex-col gap-3">
                  <ProgressLine
                    share={shareOfPct(k.budget.usedPct)}
                    label={t("kpi.budgetUsed", { pct: pct(k.budget.usedPct, locale) })}
                    tone="neutral"
                  />
                  <dl className="divide-border m-0 flex flex-col divide-y">
                    {pair(t("building.budgeted"), formatTHB(k.budget.budgetedExpense, locale), "budgeted")}
                    {pair(t("building.actual"), formatTHB(k.budget.actualExpense, locale), "actual")}
                    {pair(t("building.used"), pct(k.budget.usedPct, locale), "used")}
                  </dl>
                </div>
              ) : (
                <p className="text-muted m-0 text-sm">{t("kpi.noBudgetLong")}</p>
              ),
              k.budget
                ? t("building.budgetLede", { year: k.budget.fiscalYear + (locale === "th" ? 543 : 0) })
                : undefined,
            )}
            {block(
              "pm-work",
              t("building.work"),
              <dl className="divide-border m-0 flex flex-col divide-y">
                {pair(t("building.openRequests"), formatNumber(k.work.openRequests, locale), "open")}
                {pair(
                  t("building.slaBreached"),
                  k.work.slaBreachedRequests > 0 ? (
                    <StatusText tone="warning" icon={IconAlert} size="sm">
                      {formatNumber(k.work.slaBreachedRequests, locale)}
                    </StatusText>
                  ) : (
                    "0"
                  ),
                  "sla",
                )}
                {pair(t("building.workOrders"), formatNumber(k.work.openWorkOrders, locale), "wo")}
              </dl>,
            )}
          </div>
          <section aria-labelledby="pm-expiring" className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 id="pm-expiring" className="text-lg font-semibold">
                {t("building.expiring")}
              </h2>
              <p className="text-muted m-0 text-sm">{t("building.expiringLede", { days: k.expiring.withinDays })}</p>
            </div>
            {k.expiring.items.length === 0 ? (
              <p className="text-muted m-0 flex items-center gap-2 text-sm" data-testid="pm-expiring-none">
                <Icon icon={IconContract} size={16} className="text-subtle shrink-0" />
                {t("building.expiringNone")}
              </p>
            ) : (
              <SimpleTable
                caption={t("building.expiring")}
                testId="pm-expiring"
                stackOnPhones
                columns={[
                  { key: "title", header: t("building.col.contract"), phone: "title" },
                  { key: "vendor", header: t("building.col.vendor"), phone: "meta" },
                  { key: "ends", header: t("building.col.ends"), phone: "meta" },
                  { key: "left", header: t("building.col.left"), phone: "status" },
                ]}
                rows={k.expiring.items.map((item) => ({
                  key: item.vendorContractId,
                  cells: {
                    title: item.title,
                    vendor: item.vendorName,
                    ends: formatDate(item.endsOn, locale),
                    left: (
                      <Badge tone="warning" size="sm" icon={IconCalendar}>
                        {t("kpi.daysLeft", { count: item.daysLeft })}
                      </Badge>
                    ),
                  },
                }))}
              />
            )}
          </section>
          <section aria-labelledby="pm-staff-today" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="pm-staff-today" className="text-lg font-semibold">
                {t("building.staff")}
              </h2>
              {ownerCan(me, "pm.staff.read") ? (
                <a
                  className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                  href={ownerPath(locale, "/portfolio/staff")}
                >
                  {t("building.toBoard")}
                </a>
              ) : null}
            </div>
            {row.staffToday.length === 0 ? (
              <EmptyState
                variant="card"
                icon={IconStaff}
                title={t("building.noStaff")}
                description={t("building.noStaffBody")}
                action={
                  <a
                    className="text-primary font-medium underline-offset-4 hover:underline"
                    href={ownerPath(locale, "/portfolio/staff")}
                  >
                    {t("building.toBoard")}
                  </a>
                }
              />
            ) : (
              <Card padding="none">
                <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
                  {row.staffToday.map((staff) => (
                    <li key={`${staff.userId}-${staff.role}`} className="flex items-center gap-3 px-4 py-3">
                      <Initials name={staff.displayName} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{staff.displayName}</span>
                        <span className="text-muted text-sm">
                          {roles(staff.role)}
                          {staff.shift ? ` · ${staff.shift}` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </section>
          <p className="text-muted m-0 flex items-start gap-2 text-sm">
            <Icon icon={IconLock} size={16} className="text-subtle mt-0.5 shrink-0" />
            {t("privacy")}
          </p>
        </div>
      </DetailLayout>
    </OwnerPage>
  );
}

/** A person's initials in a round tile (no photos on the board). */
function Initials({ name }: { name: string }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
  return (
    <span
      aria-hidden
      className="bg-primary-subtle text-primary-subtle-fg grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold"
    >
      {letters}
    </span>
  );
}

const STAFF_VIEWS = ["board", "history"] as const;

/**
 * `/portfolio/staff` (JW3b): today's board — one card per managed building with its people (end an assignment),
 * members without a building (assign) — and the history of assignments (in force · all).
 */
export async function StaffBoardView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.pm");
  const roles = await getTranslations("owner.pm.role");
  const { api, locale, me } = context;
  const today = bangkokToday();
  const view = (STAFF_VIEWS as readonly string[]).includes(param(searchParams.view) ?? "")
    ? (param(searchParams.view) as (typeof STAFF_VIEWS)[number])
    : "board";
  const canManage = !readOnly(me) && ownerCan(me, "pm.staff.manage");
  const base = ownerPath(locale, "/portfolio/staff");
  const assign = await assignContext(context);
  const assignButton = (
    variant: "primary" | "secondary",
    extra: { contractId?: string; userId?: string; label?: string; testId?: string } = {},
  ) =>
    canManage && assign.buildings.length > 0 ? (
      <AssignStaffButton
        buildings={assign.buildings}
        members={assign.members}
        today={today}
        defaultContractId={extra.contractId}
        defaultUserId={extra.userId}
        variant={variant}
        label={extra.label}
        testId={extra.testId}
      />
    ) : undefined;

  let content: React.ReactNode;
  if (view === "board") {
    const board = assign.board;
    if (!board) content = <SectionError error={null} />;
    else if (board.buildings.length === 0)
      content = (
        <EmptyState
          variant="card"
          icon={IconStaff}
          title={t("staff.emptyTitle")}
          description={t("staff.emptyBody")}
          action={
            <a
              className="text-primary font-medium underline-offset-4 hover:underline"
              href={ownerPath(locale, "/portfolio/contracts")}
            >
              {t("portfolio.empty.action")}
            </a>
          }
        />
      );
    else
      content = (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-2" data-testid="staff-board">
            {boardBuildings(board).map((building) => (
              <Card
                key={building.buildingId}
                as="section"
                aria-labelledby={`b-${building.buildingId}`}
                padding="none"
                data-testid="staff-building"
              >
                <div className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
                  <div className="flex min-w-0 flex-col">
                    <h2 id={`b-${building.buildingId}`} className="text-base font-semibold">
                      <a
                        className="hover:underline"
                        href={ownerPath(locale, `/portfolio/buildings/${building.buildingId}`)}
                      >
                        {building.buildingName}
                      </a>
                    </h2>
                    <span className="text-muted truncate text-sm">{building.juristicName}</span>
                  </div>
                  <span className="text-muted shrink-0 text-sm tabular-nums">
                    {t("staff.count", { count: building.people.length })}
                  </span>
                </div>
                {building.people.length === 0 ? (
                  <div className="flex flex-col items-start gap-2 px-4 py-4">
                    <StatusText tone="warning" icon={IconAlert} size="sm">
                      {t("kpi.noStaff")}
                    </StatusText>
                    {assignButton("secondary", {
                      contractId: building.contractId,
                      label: t("staff.assignHere"),
                      testId: "staff-assign-here",
                    })}
                  </div>
                ) : (
                  <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
                    {building.people.map((person) => (
                      <li
                        key={`${person.userId}-${person.role}`}
                        className="flex items-center gap-3 px-4 py-3"
                        data-testid="staff-person"
                      >
                        <Initials name={person.displayName} />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="font-medium">{person.displayName}</span>
                          <span className="text-muted text-sm">
                            {roles(person.role)}
                            {person.shift ? ` · ${person.shift}` : ""}
                          </span>
                          {person.endsOn ? (
                            <span className="text-muted text-xs">
                              {t("staff.until", { date: formatDate(person.endsOn, locale) })}
                            </span>
                          ) : null}
                        </span>
                        {canManage && person.assignmentId ? (
                          <EndAssignmentButton
                            assignmentId={person.assignmentId}
                            name={person.displayName}
                            building={building.buildingName}
                            today={today}
                          />
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            ))}
          </div>
          {board.unassigned.length > 0 ? (
            <section aria-labelledby="staff-unassigned" className="flex flex-col gap-3" data-testid="staff-unassigned">
              <div className="flex flex-col gap-0.5">
                <h2 id="staff-unassigned" className="text-lg font-semibold">
                  {t("staff.unassigned")}
                </h2>
                <p className="text-muted m-0 text-sm">{t("staff.unassignedLede")}</p>
              </div>
              <Card padding="none">
                <ul className="divide-border m-0 flex list-none flex-col divide-y p-0">
                  {board.unassigned.map((member) => (
                    <li key={member.userId} className="flex items-center gap-3 px-4 py-3">
                      <Initials name={member.displayName} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-medium">{member.displayName}</span>
                        <span className="text-muted text-sm">
                          {t.has(`tenantRole.${member.tenantRole}`)
                            ? t(`tenantRole.${member.tenantRole}` as "tenantRole.staff")
                            : member.tenantRole}
                        </span>
                      </span>
                      {assignButton("secondary", {
                        userId: member.userId,
                        label: t("staff.assignPerson"),
                        testId: "staff-assign-person",
                      })}
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          ) : null}
        </div>
      );
  } else {
    const current = param(searchParams.current) !== "all";
    const page = pageParam(searchParams.page);
    const list = await section(
      unwrap(
        api.GET("/v1/owner/pm/staff-assignments", {
          params: { query: { page, perPage: 25, ...(current ? { current: true } : {}) } },
        }),
      ),
    );
    content = (
      <div className="flex flex-col gap-4">
        <FilterLinks
          label={t("staff.historyFilter")}
          current={current ? "current" : "all"}
          links={[
            { key: "current", href: withQuery(base, { view: "history" }), label: t("staff.inForce") },
            {
              key: "all",
              href: withQuery(base, { view: "history", current: "all" }),
              label: t("staff.allAssignments"),
            },
          ]}
        />
        {!list.data ? (
          <SectionError error={list.error} />
        ) : list.data.data.length === 0 ? (
          <EmptyState
            variant="card"
            icon={IconStaff}
            title={t("staff.historyEmpty")}
            action={
              <a className="text-primary font-medium underline-offset-4 hover:underline" href={base}>
                {t("staff.toBoard")}
              </a>
            }
          />
        ) : (
          <SimpleTable
            caption={t("staff.history")}
            testId="staff-history"
            stackOnPhones
            minWidth="56rem"
            columns={[
              { key: "name", header: t("staff.col.name"), phone: "title" },
              { key: "building", header: t("staff.col.building"), phone: "meta" },
              { key: "role", header: t("staff.col.role"), phone: "meta" },
              { key: "dates", header: t("staff.col.dates"), phone: "meta" },
              { key: "state", header: t("staff.col.state"), phone: "status" },
              { key: "action", header: <span className="sr-only">{t("staff.col.action")}</span>, phone: "hidden" },
            ]}
            rows={list.data.data.map((entry) => {
              const window = assignmentWindow(entry, today);
              return {
                key: entry.id,
                testId: "staff-assignment",
                data: { state: window },
                cells: {
                  name: entry.displayName,
                  building: entry.buildingName,
                  role: (
                    <span className="flex flex-col">
                      <span>{roles(entry.role)}</span>
                      {entry.shift ? <span className="text-muted text-sm">{entry.shift}</span> : null}
                    </span>
                  ),
                  dates: (
                    <span className="text-sm whitespace-nowrap">
                      {entry.endsOn
                        ? t("staff.range", {
                            from: formatDate(entry.startsOn, locale),
                            to: formatDate(entry.endsOn, locale),
                          })
                        : t("staff.since", { from: formatDate(entry.startsOn, locale) })}
                    </span>
                  ),
                  state: (
                    <Badge
                      tone={window === "current" ? "success" : window === "scheduled" ? "info" : "neutral"}
                      size="sm"
                    >
                      {t(`staff.window.${window}`)}
                    </Badge>
                  ),
                  action:
                    canManage && window !== "ended" ? (
                      <EndAssignmentButton
                        assignmentId={entry.id}
                        name={entry.displayName}
                        building={entry.buildingName}
                        today={today}
                      />
                    ) : null,
                },
              };
            })}
          />
        )}
        {list.data && list.data.meta.total > list.data.meta.perPage ? (
          <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
        ) : null}
      </div>
    );
  }

  return (
    <OwnerPage testId="pm-staff">
      <PageHeader
        title={t("staff.title")}
        description={
          assign.board ? t("staff.lede", { date: formatDate(assign.board.asOf, locale) }) : t("staff.ledeNoDate")
        }
        actions={assignButton("primary")}
      />
      <ViewTabs
        label={t("staff.views")}
        current={view}
        tabs={STAFF_VIEWS.map((key) => ({
          key,
          href: withQuery(base, { view: key === "board" ? undefined : key }),
          label: t(`staff.view.${key}`),
          testId: `staff-view-${key}`,
        }))}
      />
      {content}
    </OwnerPage>
  );
}

/** `/portfolio/contracts` (JW3b): offers waiting for an answer first, then running contracts, then all. */
export async function PmContractsView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.pm");
  const { api, locale } = context;
  const count = (state: Schemas["ManagementContractState"] | undefined) =>
    unwrap(
      api.GET("/v1/owner/pm/management-contracts", { params: { query: { perPage: 1, ...(state ? { state } : {}) } } }),
    )
      .then((answer) => answer.meta.total)
      .catch(() => undefined);
  const counts = await Promise.all(CONTRACT_TABS.map((tab) => count(CONTRACT_TAB_STATE[tab])));
  const tab = contractTab(param(searchParams.tab), counts[0] ?? 0);
  const state = CONTRACT_TAB_STATE[tab];
  const page = pageParam(searchParams.page);
  const list = await section(
    unwrap(
      api.GET("/v1/owner/pm/management-contracts", {
        params: { query: { page, perPage: 25, ...(state ? { state } : {}) } },
      }),
    ),
  );
  const base = ownerPath(locale, "/portfolio/contracts");
  return (
    <OwnerPage testId="pm-contracts">
      <PageHeader title={t("contracts.title")} description={t("contracts.lede")} />
      <ViewTabs
        label={t("contracts.tabs")}
        current={tab}
        tabs={CONTRACT_TABS.map((which, index) => ({
          key: which,
          href: withQuery(base, { tab: which }),
          label: t(`contracts.tab.${which}`),
          count: counts[index],
          testId: `pm-contracts-tab-${which}`,
        }))}
      />
      <ContractList context={context} side="pm" list={list} tab={tab} />
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

/** The rows of a management contract list, from either side (counterpart, building, fee in words, term, state). */
export async function ContractList({
  context,
  side,
  list,
  tab,
}: {
  context: OwnerContext;
  side: "pm" | "juristic";
  list: Awaited<ReturnType<typeof section<{ data: Schemas["ManagementContractDto"][]; meta: Schemas["PageMeta"] }>>>;
  tab: string;
}) {
  const allHref =
    tab === "all"
      ? ownerPath(context.locale, side === "pm" ? "/portfolio" : "/juristic/contracts")
      : ownerPath(
          context.locale,
          side === "pm" ? "/portfolio/contracts?tab=all" : "/juristic/management-contracts?tab=all",
        );
  const t = await getTranslations("owner.pm");
  const { locale } = context;
  if (!list.data) return <SectionError error={list.error} />;
  if (list.data.data.length === 0)
    return (
      <EmptyState
        variant="card"
        icon={IconContract}
        title={t(`contracts.empty.${side}.title`)}
        description={t(`contracts.empty.${side}.body`, {
          tab: t(`contracts.tabName.${tab}` as "contracts.tabName.all"),
        })}
        action={
          <a className="text-primary font-medium underline-offset-4 hover:underline" href={allHref}>
            {t(tab === "all" ? `contracts.empty.${side}.home` : "contracts.empty.toAll")}
          </a>
        }
      />
    );
  const fees = await Promise.all(list.data.data.map((contract) => feeLine(contract, locale)));
  return (
    <SimpleTable
      caption={t("contracts.title")}
      testId="management-contracts"
      stackOnPhones
      minWidth="60rem"
      columns={[
        { key: "title", header: t("contracts.col.title"), phone: "title" },
        { key: "building", header: t("contracts.col.building"), phone: "meta" },
        { key: "fee", header: t("contracts.col.fee"), phone: "meta" },
        { key: "term", header: t("contracts.col.term"), phone: "meta" },
        { key: "state", header: t("contracts.col.state"), phone: "status" },
      ]}
      rows={list.data.data.map((contract, index) => ({
        key: contract.id,
        href: ownerPath(
          locale,
          side === "pm" ? `/portfolio/contracts/${contract.id}` : `/juristic/management-contracts/${contract.id}`,
        ),
        testId: "management-contract-row",
        data: { state: contract.state, building: contract.buildingName },
        cells: {
          title: (
            <span className="flex min-w-0 flex-col">
              <span className="font-medium">{contract.title}</span>
              <span className="text-muted text-sm">{side === "pm" ? contract.juristicName : contract.pmName}</span>
            </span>
          ),
          building: contract.buildingName,
          fee: <span className="text-sm">{fees[index]}</span>,
          term: (
            <span className="text-sm whitespace-nowrap">
              {t("contracts.term", {
                from: formatDate(contract.startsOn, locale),
                to: formatDate(contract.endsOn, locale),
              })}
            </span>
          ),
          state: (
            <span className="flex flex-col items-start gap-1">
              <StatusBadgeOf map={MANAGEMENT_CONTRACT_STATUS} value={contract.state} size="sm" />
              {contract.state === "active" ? (
                <span className="text-muted flex items-center gap-1 text-xs">
                  <Icon icon={contract.access.active ? IconInfo : IconLock} size={12} />
                  {t(contract.access.active ? "contracts.accessOn" : "contracts.accessOff")}
                </span>
              ) : null}
            </span>
          ),
        },
      }))}
    />
  );
}

async function loadContract<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

/** `/portfolio/contracts/[contractId]` (JW3b): the shared record from the PM company's side. */
export async function PmContractView({ context, contractId }: { context: OwnerContext; contractId: string }) {
  const { api } = context;
  const contract = await loadContract(() =>
    unwrap(api.GET("/v1/owner/pm/management-contracts/{contractId}", { params: { path: { contractId } } })),
  );
  const charges = ["active", "ended", "terminated"].includes(contract.state)
    ? await unwrap(
        api.GET("/v1/owner/pm/management-contracts/{contractId}/charges", { params: { path: { contractId } } }),
      ).catch(() => [])
    : null;
  return <ContractRecordView context={context} contract={contract} side="pm" charges={charges} staff={null} />;
}

export { loadContract };
