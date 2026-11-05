import { getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";

import { FUND_TRANSFER_STATUS } from "@/domain/status";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatIsoDate, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { Paper, PaperHead, PaperParties, PaperSection } from "@/ui/components/Paper";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { Icon } from "@/ui/icons";
import { IconBank } from "@/ui/icons/glyphs/bank";
import { IconFund } from "@/ui/icons/glyphs/fund";

import { ownerPath } from "../../shared/links";
import { focusedBuilding, ownerCan, pageParam, readOnly, section, type OwnerContext } from "../../shared/server";
import { accountLabel, moneyAccounts } from "./accounts";
import { EditFundButton, NewFundButton, RequestTransferButton, TransferDecision } from "./FundActions";
import { isZero } from "./money";
import { FundsNav, memberName } from "./parts";
import { adoptedResolutions, chartOfAccounts, officeMembers } from "./shared";

type SearchParams = Record<string, string | string[] | undefined>;

async function bankOptions(context: OwnerContext) {
  const banks = await unwrap(context.api.GET("/v1/owner/bank-accounts")).catch(() => [] as Schemas["BankAccountDto"][]);
  return banks.map((bank) => ({ id: bank.id, label: `${bank.bankNameTh} ${bank.accountNoMasked}` }));
}

/**
 * The office's funds (D-311, D-329): each fund's money in the bank and its equity — contributions billed less money
 * used — side by side, the transfers waiting for a second member first. A member who may only spend petty cash
 * (staff) is taken to petty cash: the books are not theirs to read.
 */
export async function FundsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.accounting.funds");
  const kinds = await getTranslations("owner.accounting.fundKind");
  const { api, locale, me } = context;
  if (!ownerCan(me, "juristic.accounting.read")) redirect(ownerPath(locale, "/juristic/petty-cash"));
  const building = focusedBuilding(context);
  const page = pageParam(searchParams.page);
  const [funds, waiting, recent, banks, members] = await Promise.all([
    section(
      unwrap(api.GET("/v1/owner/juristic/funds", { params: { query: building ? { buildingId: building.id } : {} } })),
    ),
    section(
      unwrap(api.GET("/v1/owner/juristic/fund-transfers", { params: { query: { state: "requested", perPage: 50 } } })),
    ),
    section(unwrap(api.GET("/v1/owner/juristic/fund-transfers", { params: { query: { page, perPage: 10 } } }))),
    bankOptions(context),
    officeMembers(api),
  ]);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.fund.manage");
  const money = (value: string) => formatTHB(value, locale);
  const common = await getTranslations("owner.accounting.common");
  const transferRows = (rows: Schemas["FundTransferDto"][]) =>
    rows.map((row) => ({
      key: row.id,
      href: ownerPath(locale, `/juristic/funds/transfers/${row.id}`),
      testId: "fund-transfer-row",
      data: { state: row.state, direction: row.direction },
      cells: {
        date: <span className="whitespace-nowrap">{formatDate(row.transferOn, locale)}</span>,
        what: (
          <span className="flex flex-col">
            <span>{t(row.direction === "out" ? "rowOut" : "rowIn", { fund: row.fundName })}</span>
            <span className="text-muted text-sm">
              {t("requestedBy", { name: memberName(members, row.requestedBy, common("unknownMember")) })}
            </span>
          </span>
        ),
        amount: (
          <span className="font-medium tabular-nums">
            {row.direction === "out" ? `−${money(row.amount)}` : money(row.amount)}
          </span>
        ),
        state: <StatusBadgeOf map={FUND_TRANSFER_STATUS} value={row.state} size="sm" />,
      },
    }));
  const columns = [
    { key: "date", header: t("col.date"), phone: "meta" as const },
    { key: "what", header: t("col.what"), phone: "title" as const },
    { key: "amount", header: t("col.amount"), align: "end" as const, phone: "figure" as const },
    { key: "state", header: t("col.state"), phone: "status" as const },
  ];
  return (
    <OwnerPage testId="juristic-funds">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={
          canManage ? (
            <NewFundButton buildings={context.buildings.map((b) => ({ id: b.id, label: b.name }))} banks={banks} />
          ) : undefined
        }
      />
      <FundsNav current="funds" locale={locale} funds />
      {!funds.data ? (
        <SectionError error={funds.error} />
      ) : funds.data.data.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconFund}
          title={t("empty.title")}
          description={t("empty.body")}
          action={
            canManage ? (
              <NewFundButton buildings={context.buildings.map((b) => ({ id: b.id, label: b.name }))} banks={banks} />
            ) : (
              <Button asChild variant="secondary">
                <a href={ownerPath(locale, "/juristic/accounting")}>{t("toBooks")}</a>
              </Button>
            )
          }
        />
      ) : (
        <ul className="m-0 grid list-none gap-4 p-0 lg:grid-cols-2" data-testid="fund-cards">
          {funds.data.data.map((fund) => (
            <li key={fund.id}>
              <Card as="article" interactive className="relative flex h-full flex-col gap-4" data-testid="fund-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col">
                    <a
                      href={ownerPath(locale, `/juristic/funds/${fund.id}`)}
                      className="text-lg font-semibold after:absolute after:inset-0"
                    >
                      {fund.name}
                    </a>
                    <span className="text-muted text-sm">
                      {kinds(fund.kind)} · {fund.buildingName}
                    </span>
                  </div>
                  {fund.isActive ? null : <Badge tone="neutral">{t("inactive")}</Badge>}
                </div>
                <dl className="m-0 grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted text-sm">{t("bankBalance")}</dt>
                    <dd className="m-0 text-xl font-semibold tabular-nums" data-testid="fund-bank-balance">
                      {money(fund.bankBalance)}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <dt className="text-muted text-sm">{t("equity")}</dt>
                    <dd className="m-0 text-xl font-semibold tabular-nums">{money(fund.equityBalance)}</dd>
                  </div>
                </dl>
                <p className="text-muted m-0 mt-auto flex items-center gap-1.5 text-sm">
                  <Icon icon={IconBank} className="text-subtle" />
                  {fund.bankAccountMasked ?? t("noBank")}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {waiting.data && waiting.data.data.length ? (
        <section aria-labelledby="waiting-title" className="flex flex-col gap-3" data-testid="fund-transfers-waiting">
          <h2 id="waiting-title" className="text-lg font-semibold">
            {t("waiting", { count: waiting.data.meta.total })}
          </h2>
          <SimpleTable
            caption={t("waitingCaption")}
            stackOnPhones
            minWidth="44rem"
            columns={columns}
            rows={transferRows(waiting.data.data)}
          />
        </section>
      ) : null}
      <section aria-labelledby="recent-title" className="flex flex-col gap-3">
        <h2 id="recent-title" className="text-lg font-semibold">
          {t("recent")}
        </h2>
        {!recent.data ? (
          <SectionError error={recent.error} />
        ) : recent.data.data.length === 0 ? (
          <p className="text-muted m-0 text-sm">{t("noTransfers")}</p>
        ) : (
          <SimpleTable
            caption={t("recent")}
            stackOnPhones
            minWidth="44rem"
            columns={columns}
            rows={transferRows(recent.data.data.filter((row) => row.state !== "requested"))}
          />
        )}
        {recent.data && recent.data.meta.total > recent.data.meta.perPage ? (
          <ListPagination
            meta={recent.data.meta}
            path={ownerPath(locale, "/juristic/funds")}
            searchParams={searchParams}
            locale={locale}
          />
        ) : null}
      </section>
    </OwnerPage>
  );
}

/** One fund: the ledger of its two accounts (bank and equity), its bank account, a transfer request. */
export async function FundView({
  context,
  fundId,
  searchParams,
}: {
  context: OwnerContext;
  fundId: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.accounting.funds");
  const kinds = await getTranslations("owner.accounting.fundKind");
  const sources = await getTranslations("owner.accounting.source");
  const resolutionsT = await getTranslations("owner.accounting.journalForm");
  const { api, locale, me } = context;
  let fund: Schemas["FundDto"];
  try {
    fund = await unwrap(api.GET("/v1/owner/juristic/funds/{fundId}", { params: { path: { fundId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const page = pageParam(searchParams.page);
  const [ledger, banks, accounts, resolutions] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/juristic/funds/{fundId}/ledger", {
          params: { path: { fundId }, query: { page, perPage: 30 } },
        }),
      ),
    ),
    bankOptions(context),
    chartOfAccounts(api),
    adoptedResolutions(api, (row) => resolutionsT("resolutionOption", { number: row.number, title: row.title })),
  ]);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.fund.manage");
  const money = (value: string) => formatTHB(value, locale);
  const plain = (value: string) => (isZero(value) ? "" : formatTHB(value, locale, { withSymbol: false }));
  return (
    <OwnerPage testId="juristic-fund">
      <PageHeader
        title={fund.name}
        description={t("recordLede", { kind: kinds(fund.kind), building: fund.buildingName })}
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/funds") }}
      />
      <StatsRow
        label={t("figures")}
        highlight="bank"
        figures={[
          {
            key: "bank",
            label: t("bankBalance"),
            value: money(fund.bankBalance),
            hint: fund.bankAccountMasked ?? t("noBank"),
          },
          { key: "equity", label: t("equity"), value: money(fund.equityBalance), hint: t("equityHint") },
        ]}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="fund-panel"
            title={t("panelTitle")}
            description={t("panelBody")}
            facts={[
              { key: "bank", label: t("bankAccount"), value: fund.bankAccountMasked ?? t("noBank") },
              { key: "state", label: t("state"), value: fund.isActive ? t("active") : t("inactive") },
            ]}
            primary={
              canManage && fund.isActive ? (
                <RequestTransferButton
                  fund={fund}
                  today={formatIsoDate(currentTime())}
                  accounts={moneyAccounts(accounts).map((a) => ({ id: a.id, label: accountLabel(a, locale) }))}
                  resolutions={resolutions
                    .filter((r) => r.buildingId === fund.buildingId)
                    .map((r) => ({ id: r.id, label: r.label }))}
                />
              ) : undefined
            }
            secondary={canManage ? <EditFundButton fund={fund} banks={banks} /> : undefined}
          />
        }
      >
        <Card as="section" aria-labelledby="fund-ledger" className="flex flex-col gap-4">
          <CardHeader title={<span id="fund-ledger">{t("ledger")}</span>} description={t("ledgerHint")} />
          {!ledger.data ? (
            <SectionError error={ledger.error} />
          ) : ledger.data.data.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("noLedger")}</p>
          ) : (
            <SimpleTable
              caption={t("ledger")}
              minWidth="48rem"
              testId="fund-ledger"
              columns={[
                { key: "date", header: t("col.date") },
                { key: "memo", header: t("col.memo") },
                { key: "account", header: t("col.account") },
                { key: "debit", header: t("col.debit"), align: "end" },
                { key: "credit", header: t("col.credit"), align: "end" },
              ]}
              rows={ledger.data.data.map((line, index) => ({
                key: `${line.journalId}-${line.accountId}-${index}`,
                href: ownerPath(locale, `/juristic/accounting/journals/${line.journalId}`),
                cells: {
                  date: <span className="whitespace-nowrap">{formatDate(line.postedOn, locale)}</span>,
                  memo: (
                    <span className="flex flex-col">
                      <span>{line.memo}</span>
                      <span className="text-muted text-sm">{sources(line.sourceType)}</span>
                    </span>
                  ),
                  account: (
                    <span className="text-sm whitespace-nowrap">
                      <span className="text-muted font-mono">{line.accountCode}</span> {t(`role.${line.accountRole}`)}
                    </span>
                  ),
                  debit: <span className="tabular-nums">{plain(line.debit)}</span>,
                  credit: <span className="tabular-nums">{plain(line.credit)}</span>,
                },
              }))}
            />
          )}
          {ledger.data && ledger.data.meta.total > ledger.data.meta.perPage ? (
            <ListPagination
              meta={ledger.data.meta}
              path={ownerPath(locale, `/juristic/funds/${fund.id}`)}
              searchParams={searchParams}
              locale={locale}
            />
          ) : null}
        </Card>
      </DetailLayout>
    </OwnerPage>
  );
}

/** A fund transfer: what moves, why (the resolution), who asked and who decided; the second member decides here. */
export async function TransferView({ context, transferId }: { context: OwnerContext; transferId: string }) {
  const t = await getTranslations("owner.accounting.transferRecord");
  const common = await getTranslations("owner.accounting.common");
  const { api, locale, me } = context;
  let transfer: Schemas["FundTransferDto"];
  try {
    transfer = await unwrap(
      api.GET("/v1/owner/juristic/fund-transfers/{fundTransferId}", {
        params: { path: { fundTransferId: transferId } },
      }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [members, resolution] = await Promise.all([
    officeMembers(api),
    transfer.resolutionId
      ? unwrap(
          api.GET("/v1/owner/juristic/resolutions/{resolutionId}", {
            params: { path: { resolutionId: transfer.resolutionId } },
          }),
        ).catch(() => null)
      : Promise.resolve(null),
  ]);
  const decide = !readOnly(me) && transfer.nextActions.includes("approve");
  const mine = transfer.requestedBy === me.user.id;
  const who = (id: string | null) => memberName(members, id, common("unknownMember"));
  return (
    <OwnerPage testId="juristic-fund-transfer">
      <PageHeader
        title={t(transfer.direction === "out" ? "titleOut" : "titleIn", { fund: transfer.fundName })}
        status={<StatusBadgeOf map={FUND_TRANSFER_STATUS} value={transfer.state} />}
        description={t("lede", {
          amount: formatTHB(transfer.amount, locale),
          date: formatDate(transfer.transferOn, locale),
        })}
        back={{ label: t("back"), href: ownerPath(locale, `/juristic/funds/${transfer.fundId}`) }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="fund-transfer-panel"
            summary={
              <div className="flex flex-col gap-1">
                <span className="text-muted text-sm">{t(transfer.direction === "out" ? "amountOut" : "amountIn")}</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatTHB(transfer.amount, locale)}
                </span>
              </div>
            }
            title={t(`panel.${transfer.state}`)}
            description={
              transfer.state === "requested"
                ? decide
                  ? t("decideHint")
                  : mine
                    ? t("waitOther")
                    : t("waitApprover")
                : transfer.decisionReason
                  ? `“${transfer.decisionReason}”`
                  : undefined
            }
            facts={[
              { key: "requested", label: t("requestedBy"), value: who(transfer.requestedBy) },
              { key: "requestedAt", label: t("requestedAt"), value: formatDateTime(transfer.requestedAt, locale) },
              ...(transfer.decidedBy
                ? [
                    { key: "decided", label: t("decidedBy"), value: who(transfer.decidedBy) },
                    {
                      key: "decidedAt",
                      label: t("decidedAt"),
                      value: transfer.decidedAt ? formatDateTime(transfer.decidedAt, locale) : "—",
                    },
                  ]
                : []),
            ]}
            primary={decide ? <TransferDecision transfer={transfer} /> : undefined}
            secondary={
              transfer.journalId ? (
                <Button asChild variant="secondary" block>
                  <a href={ownerPath(locale, `/juristic/accounting/journals/${transfer.journalId}`)}>
                    {t("openJournal")}
                  </a>
                </Button>
              ) : undefined
            }
          />
        }
      >
        <Paper label={t("paper")} testId="fund-transfer-paper">
          <PaperHead
            kind={t("paper")}
            facts={[
              { key: "date", label: t("date"), value: formatDate(transfer.transferOn, locale) },
              { key: "reference", label: t("reference"), value: transfer.reference ?? "—" },
            ]}
          />
          <PaperParties
            items={[
              { key: "fund", label: t("fund"), value: transfer.fundName },
              {
                key: "counter",
                label: transfer.direction === "out" ? t("to") : t("from"),
                value: transfer.counterAccountCode,
              },
              {
                key: "resolution",
                label: t("resolution"),
                value: resolution ? (
                  <a
                    className="text-primary underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/juristic/resolutions/${resolution.id}`)}
                  >
                    {t("resolutionValue", { number: resolution.number, title: resolution.title })}
                  </a>
                ) : (
                  t("noResolution")
                ),
              },
            ]}
          />
          {transfer.note ? (
            <PaperSection title={t("note")}>
              <p className="m-0">{transfer.note}</p>
            </PaperSection>
          ) : null}
          <PaperSection title={t("rule")}>
            <p className="text-muted m-0 text-sm">{transfer.direction === "out" ? t("ruleOut") : t("ruleIn")}</p>
          </PaperSection>
        </Paper>
      </DetailLayout>
    </OwnerPage>
  );
}
