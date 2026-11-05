import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { EXPENSE_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
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
import { Callout } from "@/ui/components/Callout";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { Paper, PaperFoot, PaperHead, PaperParties, PaperSection, PaperTotals } from "@/ui/components/Paper";
import { ProgressLine } from "@/ui/components/ProgressLine";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Statement } from "@/ui/components/Statement";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCertificate } from "@/ui/icons/glyphs/certificate";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconExpense } from "@/ui/icons/glyphs/expense";

import { DocumentButton } from "../../shared/DocumentButton";
import { ownerPath, withQuery } from "../../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { accountLabel, expenseAccounts, moneyAccounts } from "./accounts";
import { ApprovalBandPanel } from "./ApprovalBand";
import { approvalProgress, parseBands } from "./bands";
import {
  ApproveExpenseButton,
  AttachExpenseButton,
  PayExpenseButton,
  ReasonExpenseButton,
  SubmitExpenseButton,
} from "./ExpenseActions";
import { isZero } from "./money";
import { ExpensesNav, memberName } from "./parts";
import { ExpenseForm } from "./ExpenseForm";
import { adoptedResolutions, chartOfAccounts, officeMembers } from "./shared";
import { lineWht, parseWhtRates, percentText } from "./wht";

type SearchParams = Record<string, string | string[] | undefined>;
type Tab = "mine" | "all" | "draft" | "submitted" | "approved" | "paid";
const TABS: readonly Tab[] = ["mine", "all", "draft", "submitted", "approved", "paid"];

/** The settings an expense page reads (bands, WHT rates) — from the API's settings list, never a default here. */
export async function expenseSettings(context: OwnerContext) {
  const settings = await unwrap(context.api.GET("/v1/owner/settings", { params: { query: {} } })).catch(() => []);
  const value = (key: string) => settings.find((setting) => setting.key === key)?.value;
  return {
    bands: parseBands(value("juristic.approval_bands")),
    rates: parseWhtRates(value("juristic.wht_rates")),
    settings,
  };
}

/**
 * Expense requests (D-311, D-329): what waits for the viewer first ("รออนุมัติจากฉัน" — the API's `awaitingMe`), then
 * every request by state. Each row: number, title and payee, building, approvals given of required, the amount with
 * the tax withheld, the state.
 */
export async function ExpensesView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.accounting.expenses");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const canApprove = ownerCan(me, "juristic.expense.approve");
  const requested = TABS.find((tab) => tab === param(searchParams.tab));
  const tab: Tab = requested ?? (canApprove ? "mine" : "all");
  const q = param(searchParams.q);
  const page = pageParam(searchParams.page);
  const scope = { ...(building ? { buildingId: building.id } : {}) };
  const queryOf = (which: Tab) =>
    which === "mine" ? { awaitingMe: true } : which === "all" ? {} : { state: which as Schemas["ExpenseState"] };
  const visibleTabs = TABS.filter((which) => which !== "mine" || canApprove);
  const [list, ...counts] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/juristic/expense-requests", {
          params: { query: { page, perPage: 25, ...scope, ...queryOf(tab), ...(q ? { q } : {}) } },
        }),
      ),
    ),
    ...visibleTabs.map((which) =>
      unwrap(
        api.GET("/v1/owner/juristic/expense-requests", {
          params: { query: { page: 1, perPage: 1, ...scope, ...queryOf(which) } },
        }),
      )
        .then((answer) => answer.meta.total)
        .catch(() => undefined),
    ),
  ]);
  const canRequest = !readOnly(me) && ownerCan(me, "juristic.expense.request");
  const base = ownerPath(locale, "/juristic/expenses");
  const rows = list.data?.data ?? [];
  return (
    <OwnerPage testId="juristic-expenses">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={
          canRequest ? (
            <Button asChild iconStart={IconAdd} data-testid="expense-new">
              <a href={ownerPath(locale, "/juristic/expenses/new")}>{t("new")}</a>
            </Button>
          ) : undefined
        }
      />
      <ExpensesNav current="expenses" locale={locale} />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("tabs")}
            current={tab}
            tabs={visibleTabs.map((which, index) => ({
              key: which,
              href: withQuery(base, { tab: which, q }),
              label: t(`tab.${which}`),
              count: counts[index],
              testId: `expenses-tab-${which}`,
            }))}
          />
        }
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconExpense}
          title={t(`empty.${tab}.title`)}
          description={t(`empty.${tab}.body`)}
          action={
            tab === "mine" ? (
              <Button asChild variant="secondary">
                <a href={withQuery(base, { tab: "all" })}>{t("empty.toAll")}</a>
              </Button>
            ) : canRequest ? (
              <Button asChild variant="secondary" iconStart={IconAdd}>
                <a href={ownerPath(locale, "/juristic/expenses/new")}>{t("new")}</a>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="expense-rows"
          stackOnPhones
          minWidth="60rem"
          columns={[
            { key: "number", header: t("col.number"), phone: "meta" },
            { key: "title", header: t("col.title"), phone: "title" },
            { key: "approvals", header: t("col.approvals"), phone: "hidden" },
            { key: "amount", header: t("col.amount"), align: "end", phone: "figure" },
            { key: "state", header: t("col.state"), phone: "status" },
          ]}
          rows={rows.map((expense) => {
            const progress = approvalProgress(expense);
            return {
              key: expense.id,
              href: ownerPath(locale, `/juristic/expenses/${expense.id}`),
              testId: "expense-row",
              data: { state: expense.state, number: expense.number ?? "" },
              cells: {
                number: (
                  <span className="flex flex-col">
                    <span className="font-mono text-sm whitespace-nowrap">{expense.number ?? t("draftNumber")}</span>
                    <span className="text-muted text-sm whitespace-nowrap">
                      {formatDate(expense.createdAt, locale)}
                    </span>
                  </span>
                ),
                title: (
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{expense.title}</span>
                    <span className="text-muted text-sm">
                      {expense.payeeName}
                      {building ? "" : ` · ${expense.buildingName}`}
                      {expense.kind === "petty_cash_top_up" ? ` · ${t("topUp")}` : ""}
                    </span>
                  </span>
                ),
                approvals:
                  expense.state === "draft" || progress.required === 0 ? (
                    <span className="text-muted text-sm">—</span>
                  ) : (
                    <span className="flex w-28 flex-col gap-1">
                      <span className="text-sm tabular-nums">
                        {t("approvals", { given: progress.given, required: progress.required })}
                      </span>
                      <ProgressLine
                        share={progress.share}
                        tone={expense.state === "submitted" ? "primary" : "neutral"}
                        label={t("approvals", { given: progress.given, required: progress.required })}
                      />
                    </span>
                  ),
                amount: (
                  <span className="flex flex-col items-end">
                    <span className="font-medium tabular-nums">{formatTHB(expense.amount, locale)}</span>
                    {isZero(expense.whtAmount) ? null : (
                      <span className="text-muted text-sm tabular-nums">
                        {t("whtShort", { amount: formatTHB(expense.whtAmount, locale) })}
                      </span>
                    )}
                  </span>
                ),
                state: <StatusBadgeOf map={EXPENSE_STATUS} value={expense.state} size="sm" />,
              },
            };
          })}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

/**
 * One expense request as paper (J2.1 §3): payee, requester and where the money comes from; the lines by account with
 * VAT and withholding (the snapshotted rate, "อัตรารอยืนยัน" while O-041 is open); the API's amount, tax withheld and
 * net payable on a double rule; attachments; the payment once recorded. The panel explains the approval band and offers
 * exactly the API's `nextActions`.
 */
export async function ExpenseView({ context, expenseId }: { context: OwnerContext; expenseId: string }) {
  const t = await getTranslations("owner.accounting.expense");
  const kinds = await getTranslations("owner.accounting.attachmentKind");
  const methods = await getTranslations("owner.accounting.pay.methods");
  const common = await getTranslations("owner.accounting.common");
  const { api, locale, me } = context;
  let expense: Schemas["ExpenseRequestDto"];
  try {
    expense = await unwrap(
      api.GET("/v1/owner/juristic/expense-requests/{expenseRequestId}", {
        params: { path: { expenseRequestId: expenseId } },
      }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [{ bands, rates }, members, accounts, fund] = await Promise.all([
    expenseSettings(context),
    officeMembers(api),
    expense.nextActions.includes("pay") ? chartOfAccounts(api) : Promise.resolve([]),
    expense.fundId
      ? unwrap(api.GET("/v1/owner/juristic/funds/{fundId}", { params: { path: { fundId: expense.fundId } } })).catch(
          () => null,
        )
      : Promise.resolve(null),
  ]);
  const money = (value: string) => formatTHB(value, locale);
  const plain = (value: string) => formatTHB(value, locale, { withSymbol: false });
  const wht = expense.lines.map((line) => lineWht(line, rates));
  const unverified = wht.some((entry) => entry && !entry.verified);
  const can = (action: string) => !readOnly(me) && expense.nextActions.includes(action);
  const viewer = { userId: me.user.id, roles: me.roles, canApprove: ownerCan(me, "juristic.expense.approve") };
  const number = expense.number ?? t("draft");
  const today = formatIsoDate(currentTime());

  const primary = can("submit") ? (
    <SubmitExpenseButton expense={expense} />
  ) : can("approve") ? (
    <ApproveExpenseButton expense={expense} />
  ) : can("pay") ? (
    <PayExpenseButton
      expense={expense}
      today={today}
      accounts={moneyAccounts(accounts).map((account) => ({ id: account.id, label: accountLabel(account, locale) }))}
    />
  ) : expense.certificate ? (
    <Button asChild block iconStart={IconCertificate}>
      <a
        href={ownerPath(locale, `/juristic/expenses/certificates/${expense.certificate.id}`)}
        data-testid="expense-certificate"
      >
        {t("certificate", { number: expense.certificate.number })}
      </a>
    </Button>
  ) : undefined;

  return (
    <OwnerPage testId="juristic-expense">
      <PageHeader
        title={expense.title}
        status={<StatusBadgeOf map={EXPENSE_STATUS} value={expense.state} />}
        description={t("lede", { number, payee: expense.payeeName })}
        back={{ label: t("back"), href: ownerPath(locale, "/juristic/expenses") }}
      />
      <DetailLayout
        panelFirstOnPhones
        panel={
          <ActionPanel
            testId="expense-panel"
            summary={
              <div className="flex flex-col gap-1">
                <span className="text-muted text-sm">{expense.state === "paid" ? t("paidNet") : t("net")}</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums" data-testid="expense-net">
                  {money(expense.netAmount)}
                </span>
                {isZero(expense.whtAmount) ? null : (
                  <span className="text-muted text-sm">
                    {t("netHint", { amount: money(expense.amount), wht: money(expense.whtAmount) })}
                  </span>
                )}
              </div>
            }
            title={t(`panel.${expense.state}`)}
            description={
              <ApprovalBandPanel request={expense} bands={bands} members={members} viewer={viewer} locale={locale} />
            }
            primary={primary}
            secondary={
              <>
                {can("approve") ? <ReasonExpenseButton expense={expense} action="reject" /> : null}
                {can("edit") ? (
                  <Button asChild variant="secondary" block iconStart={IconEdit}>
                    <a href={ownerPath(locale, `/juristic/expenses/${expense.id}/edit`)} data-testid="expense-edit">
                      {t("edit")}
                    </a>
                  </Button>
                ) : null}
                {can("attach") ? <AttachExpenseButton expense={expense} /> : null}
                {expense.certificate && (can("submit") || can("approve") || can("pay")) ? (
                  <Button asChild variant="secondary" block iconStart={IconCertificate}>
                    <a href={ownerPath(locale, `/juristic/expenses/certificates/${expense.certificate.id}`)}>
                      {t("certificate", { number: expense.certificate.number })}
                    </a>
                  </Button>
                ) : null}
              </>
            }
            destructive={can("cancel") ? <ReasonExpenseButton expense={expense} action="cancel" /> : undefined}
          />
        }
      >
        {unverified ? (
          <div data-testid="wht-unverified">
            <Callout tone="warning" title={t("unverifiedTitle")}>
              {t("unverifiedBody")}
            </Callout>
          </div>
        ) : null}
        <Paper label={t("paperLabel", { number })} testId="expense-paper">
          <PaperHead
            kind={expense.kind === "petty_cash_top_up" ? t("kindTopUp") : t("kind")}
            number={number}
            facts={[
              { key: "created", label: t("createdAt"), value: formatDate(expense.createdAt, locale) },
              ...(expense.submittedAt
                ? [{ key: "submitted", label: t("submittedAt"), value: formatDate(expense.submittedAt, locale) }]
                : []),
              ...(expense.paidOn
                ? [{ key: "paid", label: t("paidOn"), value: formatDate(expense.paidOn, locale) }]
                : []),
            ]}
          />
          <PaperParties
            items={[
              {
                key: "payee",
                label: t("payee"),
                value: expense.payeeName,
                detail: expense.payeePartyId ? t("payeeParty") : t("payeeName"),
              },
              {
                key: "requester",
                label: t("requester"),
                value: memberName(members, expense.requestedBy, common("unknownMember")),
                detail: expense.buildingName,
              },
              {
                key: "source",
                label: t("source"),
                value: fund ? fund.name : t("operating"),
                detail: fund ? t("fundNote") : undefined,
              },
            ]}
          />
          <PaperSection title={t("lines")}>
            <SimpleTable
              caption={t("lines")}
              minWidth="34rem"
              stackOnPhones
              testId="expense-lines"
              columns={[
                { key: "description", header: t("col.description"), phone: "title" },
                { key: "amount", header: t("col.amount"), align: "end", phone: "figure" },
                { key: "wht", header: t("col.wht"), align: "end", phone: "status" },
              ]}
              rows={expense.lines.map((line, index) => {
                const entry = wht[index];
                return {
                  key: String(line.lineNo),
                  testId: "expense-line",
                  cells: {
                    description: (
                      <span className="flex min-w-0 flex-col">
                        <span>{line.description}</span>
                        <span className="text-muted text-sm">
                          <span className="font-mono">{line.accountCode}</span> {line.accountName}
                        </span>
                      </span>
                    ),
                    amount: (
                      <span className="flex flex-col items-end">
                        <span className="tabular-nums">{plain(line.amount)}</span>
                        {isZero(line.vatAmount) ? null : (
                          <span className="text-muted text-sm whitespace-nowrap tabular-nums">
                            {t("vatIncluded", { amount: plain(line.vatAmount) })}
                          </span>
                        )}
                      </span>
                    ),
                    wht: entry ? (
                      <span className="flex flex-col items-end gap-0.5" data-testid="expense-line-wht">
                        <span className="tabular-nums">{plain(line.whtAmount)}</span>
                        <span className="text-muted text-sm whitespace-nowrap">
                          {t("whtRate", {
                            rate: percentText(entry.ratePct),
                            type: entry.incomeType ?? "",
                          })}
                        </span>
                        {entry.verified ? null : (
                          <Badge size="sm" tone="warning">
                            {t("unverified")}
                          </Badge>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    ),
                  },
                };
              })}
            />
          </PaperSection>
          <PaperTotals testId="expense-totals">
            <Statement
              caption={t("totals")}
              lines={[
                { key: "amount", label: t("amount"), value: money(expense.amount) },
                { key: "wht", label: t("whtTotal"), value: `(${plain(expense.whtAmount)})`, level: 1 },
                { key: "net", label: t("net"), value: money(expense.netAmount), kind: "result" },
              ]}
            />
          </PaperTotals>
          {expense.note ? (
            <PaperSection title={t("note")}>
              <p className="m-0 whitespace-pre-line">{expense.note}</p>
            </PaperSection>
          ) : null}
          <PaperSection title={t("attachments")}>
            {expense.attachments.length === 0 ? (
              <p className="text-muted m-0 text-sm">{t("noAttachments")}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="expense-attachments">
                {expense.attachments.map((attachment, index) => (
                  <li
                    key={`${attachment.documentId}-${index}`}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <span className="flex flex-col">
                      <span className="font-medium">{kinds(attachment.kind)}</span>
                      <span className="text-muted text-sm">{formatDateTime(attachment.createdAt, locale)}</span>
                    </span>
                    <DocumentButton
                      document={{ kind: "file", id: attachment.documentId }}
                      label={t("open")}
                      title={kinds(attachment.kind)}
                      size="sm"
                    />
                  </li>
                ))}
              </ul>
            )}
          </PaperSection>
          {expense.state === "paid" ? (
            <PaperSection title={t("payment")}>
              <dl className="m-0 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2" data-testid="expense-payment">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("method")}</dt>
                  <dd className="m-0">{expense.paymentMethod ? methods(expense.paymentMethod) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("paidOn")}</dt>
                  <dd className="m-0">{expense.paidOn ? formatDate(expense.paidOn, locale) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">{t("reference")}</dt>
                  <dd className="m-0 font-mono">{expense.paymentReference ?? "—"}</dd>
                </div>
                {expense.journalId ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">{t("journal")}</dt>
                    <dd className="m-0">
                      <a
                        className="text-primary underline-offset-4 hover:underline"
                        href={ownerPath(locale, `/juristic/accounting/journals/${expense.journalId}`)}
                      >
                        {t("openJournal")}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
            </PaperSection>
          ) : null}
          {expense.decisionReason || expense.cancelReason ? (
            <PaperSection title={expense.state === "cancelled" ? t("cancelled") : t("rejected")}>
              <p className="m-0">{expense.cancelReason ?? expense.decisionReason}</p>
            </PaperSection>
          ) : null}
          <PaperFoot>
            <span>{t("foot")}</span>
          </PaperFoot>
        </Paper>
      </DetailLayout>
    </OwnerPage>
  );
}

/** The pickers of the request form: active expense accounts, the WHT rates, payees, funds and adopted resolutions. */
async function formChoices(context: OwnerContext) {
  const t = await getTranslations("owner.accounting.expenseForm");
  const { api, locale } = context;
  const [settings, accounts, parties, funds, resolutions] = await Promise.all([
    expenseSettings(context),
    chartOfAccounts(api),
    unwrap(api.GET("/v1/owner/parties", { params: { query: { perPage: 100 } } }))
      .then((list) => list.data)
      .catch(() => [] as Schemas["PartyDto"][]),
    unwrap(api.GET("/v1/owner/juristic/funds", { params: { query: {} } }))
      .then((list) => list.data)
      .catch(() => [] as Schemas["FundDto"][]),
    adoptedResolutions(api, (row) => t("resolutionOption", { number: row.number, title: row.title })),
  ]);
  return {
    accounts: expenseAccounts(accounts).map((account) => ({ id: account.id, label: accountLabel(account, locale) })),
    chartReadable: accounts.length > 0,
    rates: settings.rates,
    bands: settings.bands,
    payees: parties
      .filter((party) => !party.anonymised)
      .sort(
        (a, b) =>
          Number(b.type === "company") - Number(a.type === "company") ||
          a.displayName.localeCompare(b.displayName, "th"),
      )
      .map((party) => ({
        id: party.id,
        name: party.displayName,
        taxId: Boolean(party.taxId),
        company: party.type === "company",
      })),
    funds: funds
      .filter((fund) => fund.isActive)
      .map((fund) => ({ id: fund.id, buildingId: fund.buildingId, name: fund.name })),
    resolutions,
  };
}

/** The new-request page (anyone who may request: owner, manager, staff, accountant). */
export async function ExpenseNewView({ context, draftId }: { context: OwnerContext; draftId?: string }) {
  const t = await getTranslations("owner.accounting.expenseForm");
  const { api, locale, me } = context;
  let draft: Schemas["ExpenseRequestDto"] | undefined;
  if (draftId) {
    try {
      draft = await unwrap(
        api.GET("/v1/owner/juristic/expense-requests/{expenseRequestId}", {
          params: { path: { expenseRequestId: draftId } },
        }),
      );
    } catch (error) {
      if (isApiError(error) && error.status === 404) notFound();
      throw error;
    }
  }
  const choices = await formChoices(context);
  const canRequest = !readOnly(me) && ownerCan(me, "juristic.expense.request");
  const editable = !draft || draft.nextActions.includes("edit");
  const back = draft ? ownerPath(locale, `/juristic/expenses/${draft.id}`) : ownerPath(locale, "/juristic/expenses");
  return (
    <OwnerPage testId={draft ? "juristic-expense-edit" : "juristic-expense-new"}>
      <PageHeader
        title={draft ? t("editTitle", { title: draft.title }) : t("title")}
        description={t("lede")}
        back={{ label: draft ? t("backToRequest") : t("back"), href: back }}
      />
      {!canRequest || !editable ? (
        <EmptyState
          variant="card"
          icon={IconExpense}
          title={t("blockedTitle")}
          description={!canRequest ? t("forbidden") : t("notDraft")}
          action={
            <Button asChild variant="secondary">
              <a href={back}>{draft ? t("backToRequest") : t("back")}</a>
            </Button>
          }
        />
      ) : !choices.chartReadable ? (
        <EmptyState
          variant="card"
          icon={IconExpense}
          title={t("noChartTitle")}
          description={t("noChart")}
          action={
            <Button asChild variant="secondary">
              <a href={back}>{t("back")}</a>
            </Button>
          }
        />
      ) : (
        <ExpenseForm
          buildings={context.buildings.map((building) => ({ id: building.id, name: building.name }))}
          accounts={choices.accounts}
          rates={choices.rates}
          bands={choices.bands}
          payees={choices.payees}
          funds={choices.funds}
          resolutions={choices.resolutions}
          defaultBuildingId={focusedBuilding(context)?.id}
          draft={draft}
        />
      )}
    </OwnerPage>
  );
}

/** 50 ทวิ certificates issued when an expense with withholding tax was paid (series WHT, gapless). */
export async function CertificatesView({
  context,
  searchParams,
}: {
  context: OwnerContext;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.accounting.certificates");
  const { api, locale } = context;
  const building = focusedBuilding(context);
  const q = param(searchParams.q);
  const page = pageParam(searchParams.page);
  const list = await section(
    unwrap(
      api.GET("/v1/owner/juristic/withholding-certificates", {
        params: { query: { page, perPage: 25, ...(q ? { q } : {}), ...(building ? { buildingId: building.id } : {}) } },
      }),
    ),
  );
  const base = ownerPath(locale, "/juristic/expenses/certificates");
  const rows = list.data?.data ?? [];
  return (
    <OwnerPage testId="juristic-certificates">
      <PageHeader title={t("title")} description={t("lede")} />
      <ExpensesNav current="certificates" locale={locale} />
      <ListToolbar
        filters={
          <FilterBar
            variant="toolbar"
            fields={[{ name: "q", label: t("search"), type: "search", placeholder: t("searchPlaceholder") }]}
          />
        }
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconCertificate}
          title={q ? t("empty.filteredTitle") : t("empty.title")}
          description={q ? t("empty.filtered") : t("empty.body")}
          action={
            <Button asChild variant="secondary">
              <a href={q ? base : ownerPath(locale, "/juristic/expenses")}>
                {q ? t("empty.clear") : t("empty.action")}
              </a>
            </Button>
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="certificate-rows"
          stackOnPhones
          minWidth="52rem"
          columns={[
            { key: "number", header: t("col.number"), phone: "meta" },
            { key: "payee", header: t("col.payee"), phone: "title" },
            { key: "form", header: t("col.form"), phone: "status" },
            { key: "base", header: t("col.base"), align: "end", phone: "hidden" },
            { key: "tax", header: t("col.tax"), align: "end", phone: "figure" },
          ]}
          rows={rows.map((row) => ({
            key: row.id,
            href: ownerPath(locale, `/juristic/expenses/certificates/${row.id}`),
            testId: "certificate-row",
            cells: {
              number: (
                <span className="flex flex-col">
                  <span className="font-mono text-sm whitespace-nowrap">{row.number}</span>
                  <span className="text-muted text-sm">{formatDate(row.paidOn, locale)}</span>
                </span>
              ),
              payee: (
                <span className="flex flex-col">
                  <span>{row.payeeName}</span>
                  <span className="text-muted text-sm">{t("taxIdHint", { last: row.payeeTaxIdHint })}</span>
                </span>
              ),
              form: (
                <Badge size="sm" tone="neutral">
                  {t(`form.${row.form}`)}
                </Badge>
              ),
              base: <span className="tabular-nums">{formatTHB(row.base, locale)}</span>,
              tax: <span className="font-medium tabular-nums">{formatTHB(row.tax, locale)}</span>,
            },
          }))}
        />
      )}
      {list.data && list.data.meta.total > list.data.meta.perPage ? (
        <ListPagination meta={list.data.meta} path={base} searchParams={searchParams} locale={locale} />
      ) : null}
    </OwnerPage>
  );
}

/**
 * One 50 ทวิ as paper: payer (the office), payee with the last four of the tax id (the PDF prints it in full), the
 * form, items by income type and rate, totals; the PDF the worker built (with its draft notice while O-041 is open).
 */
export async function CertificateView({ context, certificateId }: { context: OwnerContext; certificateId: string }) {
  const t = await getTranslations("owner.accounting.certificates");
  const { api, locale, me } = context;
  let certificate: Schemas["WhtCertificateDto"];
  try {
    certificate = await unwrap(
      api.GET("/v1/owner/juristic/withholding-certificates/{certificateId}", { params: { path: { certificateId } } }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const money = (value: string) => formatTHB(value, locale);
  const building = context.buildings.find((candidate) => candidate.id === certificate.buildingId);
  return (
    <OwnerPage testId="juristic-certificate">
      <PageHeader
        title={t("recordTitle", { number: certificate.number })}
        description={t("recordLede", { payee: certificate.payeeName })}
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/expenses/certificates") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="certificate-panel"
            summary={
              <div className="flex flex-col gap-1">
                <span className="text-muted text-sm">{t("taxTotal")}</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{money(certificate.tax)}</span>
              </div>
            }
            title={t("panelTitle")}
            description={certificate.documentId ? t("panelReady") : t("panelPending")}
            facts={[
              { key: "form", label: t("col.form"), value: t(`form.${certificate.form}`) },
              { key: "paid", label: t("paidOn"), value: formatDate(certificate.paidOn, locale) },
              { key: "issued", label: t("issuedAt"), value: formatDateTime(certificate.issuedAt, locale) },
            ]}
            primary={
              certificate.documentId ? (
                <DocumentButton
                  document={{ kind: "whtCertificate", id: certificate.id }}
                  label={t("pdf")}
                  title={t("recordTitle", { number: certificate.number })}
                  variant="primary"
                  size="md"
                  testId="certificate-pdf"
                />
              ) : undefined
            }
            secondary={
              <Button asChild variant="secondary" block>
                <a href={ownerPath(locale, `/juristic/expenses/${certificate.expenseRequestId}`)}>{t("openRequest")}</a>
              </Button>
            }
          />
        }
      >
        <Paper label={t("recordTitle", { number: certificate.number })} testId="certificate-paper">
          <PaperHead
            kind={t("paperKind")}
            number={certificate.number}
            facts={[
              { key: "form", label: t("col.form"), value: t(`form.${certificate.form}`) },
              { key: "paid", label: t("paidOn"), value: formatDate(certificate.paidOn, locale) },
            ]}
          />
          <PaperParties
            items={[
              {
                key: "payer",
                label: t("payer"),
                value: me.currentTenant?.displayName ?? "",
                detail: building?.name,
              },
              {
                key: "payee",
                label: t("payee"),
                value: certificate.payeeName,
                detail: t("taxIdHint", { last: certificate.payeeTaxIdHint }),
              },
            ]}
          />
          <PaperSection title={t("items")}>
            <SimpleTable
              caption={t("items")}
              minWidth="36rem"
              testId="certificate-items"
              columns={[
                { key: "type", header: t("col.incomeType") },
                { key: "rate", header: t("col.rate"), align: "end" },
                { key: "base", header: t("col.base"), align: "end" },
                { key: "tax", header: t("col.tax"), align: "end" },
              ]}
              rows={certificate.items.map((item, index) => ({
                key: String(index),
                cells: {
                  type: item.incomeType,
                  rate: `${percentText(item.ratePct)}%`,
                  base: <span className="tabular-nums">{money(item.base)}</span>,
                  tax: <span className="tabular-nums">{money(item.tax)}</span>,
                },
              }))}
              footer={{
                type: t("total"),
                base: money(certificate.base),
                tax: <span data-testid="certificate-tax">{money(certificate.tax)}</span>,
              }}
            />
          </PaperSection>
          <PaperFoot>
            <span>{t("foot")}</span>
          </PaperFoot>
        </Paper>
      </DetailLayout>
    </OwnerPage>
  );
}
