import { getTranslations } from "next-intl/server";

import { FilterBar } from "@/features/shared/console/FilterBar";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { formatDate, formatIsoDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { FilterLinks, ListToolbar } from "@/ui/components/ListToolbar";
import { Paper, PaperFoot, PaperHead, PaperSection } from "@/ui/components/Paper";
import { PeriodStatement } from "@/ui/components/PeriodStatement";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Statement } from "@/ui/components/Statement";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconWarning } from "@/ui/icons/glyphs/warning";

import { ownerPath, withQuery } from "../../shared/links";
import { focusedBuilding, ownerCan, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { BackPostButton, LedgerExport } from "./LedgerActions";
import { isZero } from "./money";
import { AccountingNav, CheckStatus } from "./parts";
import {
  GRANULARITIES,
  parseGranularity,
  parseYear,
  periodColumn,
  readerYear,
  statementFigure,
  statementRange,
  statementRows,
  yearOptions,
  type Granularity,
} from "./statement";

type SearchParams = Record<string, string | string[] | undefined>;
type View = "income" | "balance" | "trial";
const VIEWS: readonly View[] = ["income", "balance", "trial"];

/**
 * The books of a juristic office (JW2a, J2.1 §6): the income / expense statement by month, quarter or year, the
 * balance sheet and the trial balance — each the API's figures from the journals, set as paper. The building is the
 * rail's building switcher (all buildings when none is chosen). The ledger-vs-receivables check sits under the
 * statement: the GL receivable against what the bills say is still owed.
 */
export async function StatementsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.accounting.statements");
  const { locale, me } = context;
  const view = (VIEWS as readonly string[]).includes(param(searchParams.view) ?? "")
    ? (param(searchParams.view) as View)
    : "income";
  const today = formatIsoDate(currentTime());
  const building = focusedBuilding(context);
  const year = parseYear(param(searchParams.year), today);
  const granularity = parseGranularity(param(searchParams.by));
  const range = statementRange(year, granularity);
  const asOf = /^\d{4}-\d{2}-\d{2}$/.test(param(searchParams.asOf) ?? "") ? param(searchParams.asOf)! : today;
  const canManage = !readOnly(me) && ownerCan(me, "juristic.accounting.manage");
  const base = ownerPath(locale, "/juristic/accounting");
  const keep = { year: param(searchParams.year), by: param(searchParams.by), asOf: param(searchParams.asOf) };

  return (
    <OwnerPage testId="juristic-accounting">
      <PageHeader
        title={t("title")}
        description={t("lede", { building: building?.name ?? t("allBuildings") })}
        actions={
          canManage ? (
            <>
              <LedgerExport from={range.from} to={range.to} buildingId={building?.id ?? null} />
              <BackPostButton />
            </>
          ) : undefined
        }
      />
      <AccountingNav current="statements" locale={locale} />
      <ListToolbar
        tabs={
          <FilterLinks
            label={t("views")}
            current={view}
            links={VIEWS.map((key) => ({
              key,
              href: withQuery(base, { ...keep, view: key === "income" ? undefined : key }),
              label: t(`view.${key}`),
              testId: `statement-view-${key}`,
            }))}
          />
        }
        filters={
          view === "income" ? (
            <FilterBar
              variant="toolbar"
              fields={[
                {
                  name: "year",
                  label: t("year"),
                  type: "select",
                  fallback: String(year),
                  options: yearOptions(today).map((value) => ({
                    value: String(value),
                    label: t("yearOption", { year: readerYear(value, locale) }),
                  })),
                },
                {
                  name: "by",
                  label: t("by"),
                  type: "select",
                  fallback: granularity,
                  options: GRANULARITIES.map((value) => ({ value, label: t(`granularity.${value}`) })),
                },
              ]}
            />
          ) : (
            <FilterBar variant="toolbar" fields={[{ name: "asOf", label: t("asOf"), type: "date" }]} />
          )
        }
      />
      {view === "income" ? (
        <IncomeStatement
          context={context}
          year={year}
          granularity={granularity}
          range={range}
          buildingName={building?.name ?? t("allBuildings")}
        />
      ) : view === "balance" ? (
        <BalanceSheet context={context} asOf={asOf} buildingName={building?.name ?? t("allBuildings")} />
      ) : (
        <TrialBalance context={context} asOf={asOf} buildingName={building?.name ?? t("allBuildings")} />
      )}
      {view === "income" ? <LedgerReceivablesCard context={context} canManage={canManage} /> : null}
    </OwnerPage>
  );
}

const plain = (locale: Locale) => (value: string) => formatTHB(value, locale, { withSymbol: false });

async function IncomeStatement({
  context,
  year,
  granularity,
  range,
  buildingName,
}: {
  context: OwnerContext;
  year: number;
  granularity: Granularity;
  range: { from: string; to: string };
  buildingName: string;
}) {
  const t = await getTranslations("owner.accounting.statements");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const statement = await section(
    unwrap(
      api.GET("/v1/owner/juristic/reports/income-statement", {
        params: { query: { ...range, granularity, ...(building ? { buildingId: building.id } : {}) } },
      }),
    ),
  );
  if (!statement.data) return <SectionError error={statement.error} />;
  const data = statement.data;
  const rows = statementRows(
    data,
    {
      income: t("income"),
      incomeTotal: t("incomeTotal"),
      expense: t("expense"),
      expenseTotal: t("expenseTotal"),
      surplus: t("surplus"),
    },
    locale,
    plain(locale),
  );
  const empty = data.income.accounts.length === 0 && data.expense.accounts.length === 0;
  const span =
    granularity === "year"
      ? t("spanYears", { from: readerYear(year - 2, locale), to: readerYear(year, locale) })
      : t("spanYear", { year: readerYear(year, locale) });
  return (
    <Paper label={t("incomeTitle")} testId="income-statement">
      <PaperHead
        kind={t("incomeKind")}
        number={<span className="font-sans">{span}</span>}
        facts={[
          { key: "building", label: t("building"), value: buildingName },
          {
            key: "range",
            label: t("range"),
            value: `${formatDate(data.from, locale)} – ${formatDate(data.to, locale)}`,
          },
          { key: "unit", label: t("unit"), value: t("baht") },
        ]}
      />
      {empty ? (
        <p className="text-muted m-0" data-testid="income-statement-empty">
          {t("emptyIncome")}
        </p>
      ) : (
        <PeriodStatement
          caption={t("incomeTitle")}
          accountHeader={t("account")}
          periods={data.periods.map((key) => periodColumn(key, locale))}
          totalHeader={t("total")}
          rows={rows.map((row) => ({ ...row, testId: `statement-row-${row.kind}` }))}
          testId="income-statement-table"
        />
      )}
      <PaperFoot>
        <span>{t("foot")}</span>
        <span>{t("surplusNote")}</span>
      </PaperFoot>
    </Paper>
  );
}

async function BalanceSheet({
  context,
  asOf,
  buildingName,
}: {
  context: OwnerContext;
  asOf: string;
  buildingName: string;
}) {
  const t = await getTranslations("owner.accounting.statements");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const sheet = await section(
    unwrap(
      api.GET("/v1/owner/juristic/reports/balance-sheet", {
        params: { query: { asOf, ...(building ? { buildingId: building.id } : {}) } },
      }),
    ),
  );
  if (!sheet.data) return <SectionError error={sheet.error} />;
  const data = sheet.data;
  const money = (value: string) => statementFigure(value, plain(locale), { zero: "figure" });
  const name = (account: { nameTh: string; nameEn: string }) => (locale === "th" ? account.nameTh : account.nameEn);
  const accountLines = (key: string, accounts: Schemas["BalanceAccountDto"][]) =>
    accounts.map((account) => ({
      key: `${key}-${account.accountId}`,
      label: (
        <span className="flex items-baseline gap-2">
          <span className="text-muted font-mono text-xs">{account.code}</span>
          {name(account)}
        </span>
      ),
      value: money(account.balance),
      level: 1 as const,
    }));
  return (
    <Paper label={t("balanceTitle")} testId="balance-sheet" className="max-w-4xl">
      <PaperHead
        kind={t("balanceKind")}
        number={<span className="font-sans">{t("asOfDate", { date: formatDate(data.asOf, locale) })}</span>}
        status={<BalancedBadge balanced={data.balanced} labels={{ yes: t("balanced"), no: t("unbalanced") }} />}
        facts={[
          { key: "building", label: t("building"), value: buildingName },
          { key: "unit", label: t("unit"), value: t("baht") },
        ]}
      />
      <Statement
        caption={t("balanceTitle")}
        lines={[
          { key: "assets", label: t("assets"), kind: "heading" },
          ...accountLines("a", data.assets.accounts),
          { key: "assets-total", label: t("assetsTotal"), value: money(data.assets.total), kind: "result" },
          { key: "liabilities", label: t("liabilities"), kind: "heading" },
          ...accountLines("l", data.liabilities.accounts),
          {
            key: "liabilities-total",
            label: t("liabilitiesTotal"),
            value: money(data.liabilities.total),
            kind: "subtotal",
          },
          { key: "equity", label: t("equity"), kind: "heading" },
          ...accountLines("e", data.equity.accounts),
          { key: "surplus", label: t("surplusToDate"), value: money(data.equity.surplusToDate), level: 1 },
          { key: "equity-total", label: t("equityTotal"), value: money(data.equity.total), kind: "subtotal" },
          {
            key: "both",
            label: t("liabilitiesAndEquity"),
            value: data.balanced ? money(data.assets.total) : "—",
            kind: "result",
            testId: "balance-total",
          },
        ]}
      />
      <PaperFoot>
        <span>{t("balanceFoot")}</span>
      </PaperFoot>
    </Paper>
  );
}

function BalancedBadge({ balanced, labels }: { balanced: boolean; labels: { yes: string; no: string } }) {
  return balanced ? (
    <Badge tone="success" icon={IconCheckCircle}>
      {labels.yes}
    </Badge>
  ) : (
    <Badge tone="danger" icon={IconWarning}>
      {labels.no}
    </Badge>
  );
}

async function TrialBalance({
  context,
  asOf,
  buildingName,
}: {
  context: OwnerContext;
  asOf: string;
  buildingName: string;
}) {
  const t = await getTranslations("owner.accounting.statements");
  const types = await getTranslations("owner.accounting.accountType");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const trial = await section(
    unwrap(
      api.GET("/v1/owner/juristic/reports/trial-balance", {
        params: { query: { asOf, ...(building ? { buildingId: building.id } : {}) } },
      }),
    ),
  );
  if (!trial.data) return <SectionError error={trial.error} />;
  const data = trial.data;
  const money = (value: string) => statementFigure(value, plain(locale));
  return (
    <Paper label={t("trialTitle")} testId="trial-balance">
      <PaperHead
        kind={t("trialKind")}
        number={<span className="font-sans">{t("asOfDate", { date: formatDate(data.asOf, locale) })}</span>}
        status={<BalancedBadge balanced={data.balanced} labels={{ yes: t("balanced"), no: t("unbalanced") }} />}
        facts={[
          { key: "building", label: t("building"), value: buildingName },
          { key: "unit", label: t("unit"), value: t("baht") },
        ]}
      />
      <PaperSection>
        <SimpleTable
          caption={t("trialTitle")}
          minWidth="48rem"
          testId="trial-balance-table"
          columns={[
            { key: "code", header: t("code") },
            { key: "name", header: t("account") },
            { key: "type", header: t("type") },
            { key: "debit", header: t("debit"), align: "end" },
            { key: "credit", header: t("credit"), align: "end" },
            { key: "balance", header: t("balance"), align: "end" },
          ]}
          rows={data.accounts.map((account) => ({
            key: account.accountId,
            cells: {
              code: <span className="font-mono text-sm">{account.code}</span>,
              name: locale === "th" ? account.nameTh : account.nameEn,
              type: <span className="text-muted text-sm">{types(account.type)}</span>,
              debit: <span className="tabular-nums">{money(account.debit)}</span>,
              credit: <span className="tabular-nums">{money(account.credit)}</span>,
              balance: <span className="font-medium tabular-nums">{money(account.balance)}</span>,
            },
          }))}
          footer={{
            code: t("total"),
            debit: <span data-testid="trial-total-debit">{money(data.totalDebit)}</span>,
            credit: <span data-testid="trial-total-credit">{money(data.totalCredit)}</span>,
          }}
        />
      </PaperSection>
      <PaperFoot>
        <span>{t("trialFoot")}</span>
      </PaperFoot>
    </Paper>
  );
}

/**
 * The GL receivable against the bills (J2.1 §6): per building, the ledger's receivable account and what the
 * receivables say is owed (open invoices − payers' credit + plan amounts not yet billed). A difference means
 * documents the ledger has not posted yet — back-post is the way out, offered right here.
 */
async function LedgerReceivablesCard({ context, canManage }: { context: OwnerContext; canManage: boolean }) {
  const t = await getTranslations("owner.accounting.receivablesCheck");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const check = await section(
    unwrap(
      api.GET("/v1/owner/juristic/reports/ledger-receivables", {
        params: { query: building ? { buildingId: building.id } : {} },
      }),
    ),
  );
  const money = (value: string) => formatTHB(value, locale);
  const differs = check.data ? !isZero(check.data.total.difference) : false;
  return (
    <Card as="section" aria-labelledby="ledger-check-title" className="flex flex-col gap-4" data-testid="ledger-check">
      <CardHeader
        title={<span id="ledger-check-title">{t("title")}</span>}
        description={check.data ? t("hint", { date: formatDate(check.data.asOf, locale) }) : undefined}
        action={
          check.data ? (
            <CheckStatus difference={check.data.total.difference} locale={locale} testId="ledger-check-status" />
          ) : undefined
        }
      />
      {!check.data ? (
        <SectionError error={check.error} />
      ) : (
        <>
          <SimpleTable
            caption={t("title")}
            minWidth="56rem"
            columns={[
              { key: "name", header: t("building") },
              { key: "ledger", header: t("ledger"), align: "end" },
              { key: "open", header: t("openInvoices"), align: "end" },
              { key: "credit", header: t("payerCredit"), align: "end" },
              { key: "plan", header: t("planNotInvoiced"), align: "end" },
              { key: "expected", header: t("expected"), align: "end" },
              { key: "difference", header: t("difference"), align: "end" },
            ]}
            rows={check.data.perBuilding.map((row) => ({
              key: row.buildingId,
              testId: "ledger-check-row",
              cells: {
                name: row.name,
                ledger: <span className="font-medium tabular-nums">{money(row.ledgerReceivable)}</span>,
                open: <span className="tabular-nums">{money(row.openInvoices)}</span>,
                credit: <span className="tabular-nums">{money(row.payerCredit)}</span>,
                plan: <span className="tabular-nums">{money(row.planNotInvoiced)}</span>,
                expected: <span className="tabular-nums">{money(row.expected)}</span>,
                difference: <CheckStatus difference={row.difference} locale={locale} />,
              },
            }))}
          />
          {differs ? (
            <Callout tone="warning" action={canManage ? <BackPostButton size="sm" /> : undefined}>
              {t("differsHint")}
            </Callout>
          ) : null}
        </>
      )}
    </Card>
  );
}
