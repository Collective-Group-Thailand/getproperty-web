import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { CONTRACT_INSTALMENT_STATUS, EXPENSE_STATUS, VENDOR_CONTRACT_STATUS, WORK_ORDER_STATUS } from "@/domain/status";
import { PRIORITY_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { bangkokToday } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { FilterLinks, ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { StatusText } from "@/ui/components/StatusText";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconBell } from "@/ui/icons/glyphs/bell";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconContract } from "@/ui/icons/glyphs/contract";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconEvaluation } from "@/ui/icons/glyphs/evaluation";

import { DocumentButton } from "../../shared/DocumentButton";
import { ownerPath, withQuery } from "../../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { accountLabel, expenseAccounts } from "../accounting/accounts";
import { memberName } from "../accounting/parts";
import { adoptedResolutions, chartOfAccounts, officeMembers } from "../accounting/shared";
import { percentText } from "../accounting/wht";
import {
  ActivateContractButton,
  AttachContractButton,
  RenewContractButton,
  TerminateContractButton,
} from "./ContractActions";
import { ContractForm } from "./ContractForm";
import { contractTab, expiryBadge, renewalWindow, type ContractTab } from "./contracts";
import { EvaluationForm } from "./EvaluationForm";
import { defaultEvaluationMonth, monthsToEvaluate, termMonths } from "./evaluations";
import { CategoryText, EvaluationTrend, ExpiryBadgeView, scoreText, SlaTable } from "./pieces";
import { awardedRounds, vendorChoices, vendorSettings } from "./shared";

type SearchParams = Record<string, string | string[] | undefined>;
type Detail = Schemas["VendorContractDetailDto"];

const STATE_TABS: Exclude<ContractTab, "renewal" | "all">[] = ["active", "draft", "expired", "terminated"];

/**
 * Service contracts (D-331). The **renewal queue** comes first: active contracts ending within the window of
 * `juristic.contract_expiry_alert_days` (30 · 60 · 90 from the setting), soonest end first, each with its expiry badge —
 * the notice date passed as a warning, a renewal draft named. Then by state.
 */
export async function ContractsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.vendors.contracts");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const settings = await vendorSettings(context);
  const window = renewalWindow(settings.windows, param(searchParams.within));
  const q = param(searchParams.q);
  const page = pageParam(searchParams.page);
  const scope = { ...(building ? { buildingId: building.id } : {}), ...(q ? { q } : {}) };
  const tabs: ContractTab[] = [...(window !== null ? (["renewal"] as const) : []), ...STATE_TABS, "all"];
  const queryOf = (which: ContractTab) =>
    which === "renewal"
      ? { state: "active" as const, endingWithinDays: window ?? 0 }
      : which === "all"
        ? {}
        : { state: which };
  const counts = await Promise.all(
    tabs.map((which) =>
      unwrap(
        api.GET("/v1/owner/juristic/vendor-contracts", {
          params: { query: { page: 1, perPage: 1, ...scope, ...queryOf(which) } },
        }),
      )
        .then((answer) => answer.meta.total)
        .catch(() => undefined),
    ),
  );
  const renewalCount = window !== null ? counts[0] : 0;
  const requested = param(searchParams.tab);
  const tab = contractTab(requested === "renewal" && window === null ? "all" : requested, renewalCount);
  const list = await section(
    unwrap(
      api.GET("/v1/owner/juristic/vendor-contracts", {
        params: { query: { page, perPage: 25, ...scope, ...queryOf(tab) } },
      }),
    ),
  );
  const canManage = !readOnly(me) && ownerCan(me, "juristic.vendor.manage");
  const base = ownerPath(locale, "/juristic/contracts");
  const rows = list.data?.data ?? [];
  const today = bangkokToday();
  const money = (value: string) => formatTHB(value, locale);
  const add = (variant: "primary" | "secondary") => (
    <Button
      asChild
      variant={variant}
      iconStart={IconAdd}
      data-testid={variant === "primary" ? "contract-new" : undefined}
    >
      <a href={ownerPath(locale, "/juristic/contracts/new")}>{t("new")}</a>
    </Button>
  );
  return (
    <OwnerPage testId="juristic-contracts">
      <PageHeader title={t("title")} description={t("lede")} actions={canManage ? add("primary") : undefined} />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("tabs")}
            current={tab}
            tabs={tabs.map((which, index) => ({
              key: which,
              href: withQuery(base, {
                tab: which,
                q,
                within: which === "renewal" ? param(searchParams.within) : undefined,
              }),
              label: t(`tab.${which}`),
              count: counts[index],
              testId: `contracts-tab-${which}`,
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
      {tab === "renewal" && settings.windows.length > 1 && window !== null ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-muted text-sm">{t("window")}</span>
          <FilterLinks
            label={t("window")}
            current={String(window)}
            links={settings.windows.map((days) => ({
              key: String(days),
              href: withQuery(base, { tab: "renewal", within: days, q }),
              label: t("withinDays", { days }),
              testId: `contracts-within-${days}`,
            }))}
          />
        </div>
      ) : null}
      {!list.data ? (
        <SectionError error={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconContract}
          title={q ? t("empty.filtered.title") : t(`empty.${tab}.title`, { days: window ?? 0 })}
          description={q ? t("empty.filtered.body") : t(`empty.${tab}.body`, { days: window ?? 0 })}
          action={
            q ? (
              <Button asChild variant="secondary">
                <a href={withQuery(base, { tab })}>{t("empty.clear")}</a>
              </Button>
            ) : tab !== "all" ? (
              <Button asChild variant="secondary">
                <a href={withQuery(base, { tab: "all" })}>{t("empty.toAll")}</a>
              </Button>
            ) : canManage ? (
              add("secondary")
            ) : undefined
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="contract-rows"
          stackOnPhones
          minWidth="60rem"
          columns={[
            { key: "contract", header: t("col.contract"), phone: "title" },
            { key: "term", header: t("col.term"), phone: "hidden" },
            { key: "value", header: t("col.value"), align: "end", phone: "figure" },
            { key: "state", header: t("col.state"), phone: "status" },
          ]}
          rows={rows.map((contract) => {
            const badge = expiryBadge(contract, today, window);
            return {
              key: contract.id,
              href: ownerPath(locale, `/juristic/contracts/${contract.id}`),
              testId: "contract-row",
              data: { state: contract.state, badge: badge?.kind ?? "", title: contract.title },
              cells: {
                contract: (
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{contract.title}</span>
                    <span className="text-muted text-sm">
                      {contract.vendorName}
                      {building ? "" : ` · ${contract.buildingName}`}
                    </span>
                    <span className="text-muted text-sm md:hidden">
                      {t("term", {
                        from: formatDate(contract.startsOn, locale),
                        to: formatDate(contract.endsOn, locale),
                      })}
                    </span>
                  </span>
                ),
                term: (
                  <span className="flex flex-col">
                    <span className="text-sm whitespace-nowrap">
                      {t("term", {
                        from: formatDate(contract.startsOn, locale),
                        to: formatDate(contract.endsOn, locale),
                      })}
                    </span>
                    {contract.state === "active" ? (
                      <span className="text-muted text-sm whitespace-nowrap">
                        {t("noticeBy", { date: formatDate(contract.noticeBy, locale) })}
                      </span>
                    ) : null}
                  </span>
                ),
                value: <span className="font-medium tabular-nums">{money(contract.value)}</span>,
                state: (
                  <span className="flex flex-col items-start gap-1 max-md:items-end">
                    {tab === "renewal" ? null : (
                      <StatusBadgeOf map={VENDOR_CONTRACT_STATUS} value={contract.state} size="sm" />
                    )}
                    <ExpiryBadgeView badge={badge} />
                  </span>
                ),
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

async function loadContract(context: OwnerContext, contractId: string): Promise<Detail> {
  try {
    return await unwrap(
      context.api.GET("/v1/owner/juristic/vendor-contracts/{contractId}", { params: { path: { contractId } } }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

/** "งวดละ ฿16,050.00 ทุกเดือน วันที่ 5" — the plan in words (the schedule is the API's, made at activation). */
async function planWords(contract: Detail, locale: OwnerContext["locale"]): Promise<string | null> {
  const t = await getTranslations("owner.vendors.plan");
  const plan = contract.instalmentPlan;
  if (!plan) return null;
  return t("words", {
    amount: formatTHB(plan.amount, locale),
    frequency: t(`frequency.${plan.frequency}`),
    day: plan.dueDay,
    first: plan.firstDueOn ? formatDate(plan.firstDueOn, locale) : "",
    hasFirst: plan.firstDueOn ? "yes" : "no",
  });
}

/**
 * One service contract (D-331): the facts row (value, term, notice date, instalments), scope and SLA, the instalments
 * with the expense requests the hourly job made from them, the monthly evaluations with their trend (the renewal
 * evidence), SLA breaches of a month, the preventive plans run under it, documents and the expiry alerts sent. The panel
 * offers exactly the API's `nextActions`: activate, renew, evaluate, edit, attach — terminate last.
 */
export async function ContractView({
  context,
  contractId,
  searchParams,
}: {
  context: OwnerContext;
  contractId: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.vendors.contract");
  const list = await getTranslations("owner.vendors.contracts");
  const common = await getTranslations("owner.accounting.common");
  const { api, locale, me } = context;
  const contract = await loadContract(context, contractId);
  const today = bangkokToday();
  const thisMonth = today.slice(0, 7);
  const months = contract.state === "draft" ? [] : termMonths(contract.startsOn, contract.endsOn, thisMonth).reverse();
  const requestedMonth = param(searchParams.month);
  const month = months.find((entry) => entry === requestedMonth) ?? months[0] ?? null;
  const [settings, members, sla, resolutions] = await Promise.all([
    vendorSettings(context),
    officeMembers(api),
    month
      ? section(
          unwrap(
            api.GET("/v1/owner/juristic/vendor-contracts/{contractId}/sla-breaches", {
              params: { path: { contractId }, query: { month } },
            }),
          ),
        )
      : Promise.resolve(null),
    contract.nextActions.includes("renew")
      ? adoptedResolutions(api, (row) => `${row.number} · ${row.title}`)
      : Promise.resolve([]),
  ]);
  const can = (action: string) => !readOnly(me) && contract.nextActions.includes(action);
  const money = (value: string) => formatTHB(value, locale);
  const plain = (value: string) => formatTHB(value, locale, { withSymbol: false });
  const badge = expiryBadge(contract, today, settings.windows[0] ?? null);
  const open = can("evaluate") ? monthsToEvaluate(contract, contract.evaluations, thisMonth) : [];
  const next = defaultEvaluationMonth(open, thisMonth);
  // The month to evaluate first (the last finished one), then the others newest first.
  const toEvaluate = next ? [next, ...open.filter((month) => month !== next)] : [];
  const evaluateHref = (which: string) =>
    ownerPath(locale, `/juristic/contracts/${contract.id}/evaluate?month=${which}`);
  const plan = await planWords(contract, locale);
  const wht = contract.whtKey ? settings.rates.find((rate) => rate.key === contract.whtKey) : undefined;
  const requestIds = new Set(contract.instalments.map((instalment) => instalment.expenseRequestId).filter(Boolean));
  const otherRequests = contract.expenseRequests.filter((request) => !requestIds.has(request.id));
  const base = ownerPath(locale, `/juristic/contracts/${contract.id}`);
  const criteria =
    contract.evaluations[0]?.scores.map((score) => ({
      key: score.criterion,
      label: locale === "th" ? score.labelTh : score.labelEn,
    })) ?? [];

  const primary = can("activate") ? (
    <ActivateContractButton contract={contract} threshold={settings.threshold} leadDays={settings.leadDays} />
  ) : can("renew") && badge && (badge.kind === "notice" || badge.kind === "ending" || badge.kind === "ended") ? (
    <RenewContractButton
      contract={contract}
      resolutions={resolutions.filter((r) => r.buildingId === contract.buildingId)}
      threshold={settings.threshold}
      variant="primary"
    />
  ) : toEvaluate.length ? (
    <Button asChild block iconStart={IconEvaluation}>
      <a href={evaluateHref(toEvaluate[0]!)} data-testid="contract-evaluate">
        {t("evaluateMonth", { month: formatPeriodKey(toEvaluate[0]!, locale) })}
      </a>
    </Button>
  ) : can("renew") ? (
    <RenewContractButton
      contract={contract}
      resolutions={resolutions.filter((r) => r.buildingId === contract.buildingId)}
      threshold={settings.threshold}
      variant="primary"
    />
  ) : undefined;
  const primaryIs = can("activate")
    ? "activate"
    : can("renew") && badge && ["notice", "ending", "ended"].includes(badge.kind)
      ? "renew"
      : toEvaluate.length
        ? "evaluate"
        : can("renew")
          ? "renew"
          : null;

  return (
    <OwnerPage testId="juristic-contract">
      <PageHeader
        title={contract.title}
        status={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadgeOf map={VENDOR_CONTRACT_STATUS} value={contract.state} />
            <ExpiryBadgeView badge={badge} size="md" />
          </span>
        }
        description={t("lede", { vendor: contract.vendorName, building: contract.buildingName })}
        back={{ label: t("back"), href: ownerPath(locale, "/juristic/contracts") }}
      />
      <StatsRow
        label={t("figures")}
        highlight={badge?.kind === "notice" ? "notice" : undefined}
        figures={[
          { key: "value", label: t("value"), value: money(contract.value), hint: t("valueHint") },
          {
            key: "term",
            label: t("term"),
            value: <span className="text-xl">{formatDate(contract.endsOn, locale)}</span>,
            hint: t("termHint", { from: formatDate(contract.startsOn, locale) }),
          },
          {
            key: "notice",
            label: t("noticeBy"),
            value: <span className="text-xl">{formatDate(contract.noticeBy, locale)}</span>,
            hint: t("noticeHint", { days: contract.renewalNoticeDays }),
          },
          {
            key: "instalments",
            label: t("instalmentsTotal"),
            value: contract.instalments.length ? money(contract.instalmentsTotal) : "—",
            hint: contract.instalments.length
              ? t("instalmentsHint", { count: contract.instalments.filter((i) => i.state !== "cancelled").length })
              : contract.state === "draft"
                ? t("instalmentsDraft")
                : t("instalmentsNone"),
          },
        ]}
      />
      <DetailLayout
        panelFirstOnPhones
        panel={
          <ActionPanel
            testId="contract-panel"
            title={t(`panel.${contract.state}`)}
            description={
              contract.state === "active"
                ? contract.daysLeft >= 0
                  ? t("panel.activeBody", { days: contract.daysLeft, date: formatDate(contract.noticeBy, locale) })
                  : t("panel.pastEnd")
                : t(`panel.${contract.state}Body`)
            }
            facts={[
              { key: "vendor", label: t("vendor"), value: contract.vendorName },
              ...(contract.evaluationSummary.count
                ? [
                    {
                      key: "score",
                      label: t("averageScore"),
                      value: scoreText(contract.evaluationSummary.averageScore),
                    },
                  ]
                : []),
            ]}
            primary={primary}
            secondary={
              <>
                {primaryIs !== "evaluate" && toEvaluate.length ? (
                  <Button asChild variant="secondary" block iconStart={IconEvaluation}>
                    <a href={evaluateHref(toEvaluate[0]!)} data-testid="contract-evaluate">
                      {t("evaluateMonth", { month: formatPeriodKey(toEvaluate[0]!, locale) })}
                    </a>
                  </Button>
                ) : null}
                {primaryIs !== "renew" && can("renew") ? (
                  <RenewContractButton
                    contract={contract}
                    resolutions={resolutions.filter((r) => r.buildingId === contract.buildingId)}
                    threshold={settings.threshold}
                    variant="secondary"
                  />
                ) : null}
                {contract.renewalId ? (
                  <Button asChild variant="secondary" block>
                    <a
                      href={ownerPath(locale, `/juristic/contracts/${contract.renewalId}`)}
                      data-testid="contract-renewal-link"
                    >
                      {t("openRenewal")}
                    </a>
                  </Button>
                ) : null}
                {can("edit") ? (
                  <Button asChild variant="secondary" block iconStart={IconEdit}>
                    <a href={ownerPath(locale, `/juristic/contracts/${contract.id}/edit`)} data-testid="contract-edit">
                      {t("edit")}
                    </a>
                  </Button>
                ) : null}
                {can("attach") ? <AttachContractButton contract={contract} /> : null}
              </>
            }
            destructive={can("terminate") ? <TerminateContractButton contract={contract} today={today} /> : undefined}
          />
        }
      >
        {contract.renewsContractId ? (
          <Callout tone="info" title={t("renewsTitle")}>
            <a
              className="text-primary underline-offset-4 hover:underline"
              href={ownerPath(locale, `/juristic/contracts/${contract.renewsContractId}`)}
            >
              {t("renewsLink")}
            </a>
          </Callout>
        ) : null}
        {contract.state === "terminated" ? (
          <div data-testid="contract-terminated">
            <Callout
              tone="neutral"
              title={t("terminatedTitle", { date: formatDate(contract.terminatedOn ?? contract.endsOn, locale) })}
            >
              {contract.terminationReason}
            </Callout>
          </div>
        ) : null}

        <Card as="section" aria-labelledby="contract-scope" className="flex flex-col gap-4">
          <CardHeader title={<span id="contract-scope">{t("scope")}</span>} />
          {contract.scope ? (
            <p className="m-0 whitespace-pre-line">{contract.scope}</p>
          ) : (
            <p className="text-muted m-0">{t("noScope")}</p>
          )}
          <DescriptionList
            columns={2}
            items={[
              {
                id: "category",
                term: t("category"),
                description: contract.category ? <CategoryText categories={[contract.category]} /> : null,
              },
              {
                id: "account",
                term: t("account"),
                description: contract.expenseAccountCode ? (
                  <span className="font-mono text-sm">{contract.expenseAccountCode}</span>
                ) : null,
              },
              {
                id: "wht",
                term: t("wht"),
                description: wht ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <span>
                      {t("whtRate", {
                        rate: percentText(wht.ratePct),
                        label: locale === "th" ? wht.labelTh : wht.labelEn,
                      })}
                    </span>
                    {wht.verified ? null : (
                      <Badge size="sm" tone="warning">
                        {t("unverified")}
                      </Badge>
                    )}
                  </span>
                ) : (
                  (contract.whtKey ?? null)
                ),
              },
              {
                id: "basis",
                term: t("basis"),
                description: contract.quotationRoundId ? (
                  <a
                    className="text-primary underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/juristic/quotations/${contract.quotationRoundId}`)}
                  >
                    {t("fromRound")}
                  </a>
                ) : contract.resolutionId ? (
                  <a
                    className="text-primary underline-offset-4 hover:underline"
                    href={ownerPath(locale, `/juristic/resolutions/${contract.resolutionId}`)}
                  >
                    {t("fromResolution")}
                  </a>
                ) : (
                  <span className="text-muted">{t("noBasis")}</span>
                ),
              },
            ]}
          />
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold">{t("sla")}</h3>
            <SlaTable terms={contract.slaTerms} />
          </div>
          {contract.penaltyClauses ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-base font-semibold">{t("penalty")}</h3>
              <p className="m-0 whitespace-pre-line">{contract.penaltyClauses}</p>
            </div>
          ) : null}
        </Card>

        <Card as="section" id="instalments" aria-labelledby="contract-instalments" className="flex flex-col gap-3">
          <CardHeader
            title={<span id="contract-instalments">{t("instalments")}</span>}
            description={plan ?? t("noPlan")}
          />
          {contract.instalments.length === 0 ? (
            <p className="text-muted m-0 text-sm">
              {contract.state === "draft" && contract.instalmentPlan ? t("scheduleOnActivate") : t("noInstalments")}
            </p>
          ) : (
            <SimpleTable
              caption={t("instalments")}
              testId="contract-instalments"
              stackOnPhones
              minWidth="48rem"
              columns={[
                { key: "due", header: t("col.due"), phone: "meta" },
                { key: "amount", header: t("col.amount"), align: "end", phone: "figure" },
                { key: "state", header: t("col.state"), phone: "status" },
                { key: "request", header: t("col.request"), phone: "title" },
              ]}
              rows={contract.instalments.map((instalment) => ({
                key: String(instalment.seq),
                testId: "contract-instalment",
                data: { seq: instalment.seq, state: instalment.state },
                cells: {
                  due: (
                    <span className="flex flex-col">
                      <span className="whitespace-nowrap">{formatDate(instalment.dueOn, locale)}</span>
                      <span className="text-muted text-sm">
                        {t("seq", { seq: instalment.seq, total: contract.instalments.length })}
                      </span>
                    </span>
                  ),
                  amount: (
                    <span className="flex flex-col items-end">
                      <span className="tabular-nums">{plain(instalment.amount)}</span>
                      {instalment.vatAmount === "0.00" ? null : (
                        <span className="text-muted text-sm whitespace-nowrap tabular-nums">
                          {t("vat", { amount: plain(instalment.vatAmount) })}
                        </span>
                      )}
                    </span>
                  ),
                  state: <StatusBadgeOf map={CONTRACT_INSTALMENT_STATUS} value={instalment.state} size="sm" />,
                  request: instalment.expenseRequestId ? (
                    <a
                      href={ownerPath(locale, `/juristic/expenses/${instalment.expenseRequestId}`)}
                      className="flex flex-wrap items-center gap-2 underline-offset-4 hover:underline"
                      data-testid="instalment-request"
                    >
                      <span className="font-mono text-sm">{instalment.expenseRequestNumber ?? t("draftRequest")}</span>
                      {instalment.expenseRequestState ? (
                        <StatusBadgeOf map={EXPENSE_STATUS} value={instalment.expenseRequestState} size="sm" />
                      ) : null}
                    </a>
                  ) : (
                    <span className="text-muted text-sm">
                      {instalment.state === "scheduled" && settings.leadDays !== null
                        ? t("requestLater", { days: settings.leadDays })
                        : "—"}
                    </span>
                  ),
                },
              }))}
              footer={{
                due: t("total"),
                amount: <span className="font-semibold tabular-nums">{money(contract.instalmentsTotal)}</span>,
              }}
            />
          )}
          {otherRequests.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-semibold">{t("otherRequests")}</h3>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {otherRequests.map((request) => (
                  <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
                    <a
                      className="font-mono underline-offset-4 hover:underline"
                      href={ownerPath(locale, `/juristic/expenses/${request.id}`)}
                    >
                      {request.number ?? t("draftRequest")}
                    </a>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums">{money(request.amount)}</span>
                      <StatusBadgeOf map={EXPENSE_STATUS} value={request.state} size="sm" />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        <Card as="section" id="evaluations" aria-labelledby="contract-evaluations" className="flex flex-col gap-4">
          <CardHeader
            title={<span id="contract-evaluations">{t("evaluations")}</span>}
            description={t("evaluationsHint")}
          />
          {contract.evaluations.length === 0 ? (
            <EmptyState
              icon={IconEvaluation}
              title={t("noEvaluations")}
              description={contract.state === "draft" ? t("noEvaluationsDraft") : t("noEvaluationsBody")}
              action={
                toEvaluate.length ? (
                  <Button asChild variant="secondary" iconStart={IconEvaluation}>
                    <a href={evaluateHref(toEvaluate[0]!)}>
                      {t("evaluateMonth", { month: formatPeriodKey(toEvaluate[0]!, locale) })}
                    </a>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <EvaluationTrend
                summary={contract.evaluationSummary}
                evaluations={contract.evaluations}
                locale={locale}
              />
              <SimpleTable
                caption={t("evaluations")}
                testId="contract-evaluations"
                stackOnPhones
                minWidth="38rem"
                columns={[
                  { key: "month", header: t("col.month"), phone: "title" },
                  ...criteria.map((criterion) => ({
                    key: criterion.key,
                    header: criterion.label,
                    align: "end" as const,
                    phone: "hidden" as const,
                  })),
                  { key: "score", header: t("col.score"), align: "end", phone: "figure" },
                  { key: "breaches", header: t("col.breaches"), align: "end", phone: "meta" },
                ]}
                rows={[...contract.evaluations].reverse().map((evaluation) => ({
                  key: evaluation.id,
                  testId: "contract-evaluation",
                  cells: {
                    month: (
                      <span className="flex flex-col">
                        <span className="font-medium">{formatPeriodKey(evaluation.month, locale)}</span>
                        <span className="text-muted text-sm">
                          {t("evaluatedBy", {
                            name: memberName(members, evaluation.evaluatedBy, common("unknownMember")),
                          })}
                          {evaluation.incidents ? ` · ${t("incidents", { count: evaluation.incidents })}` : ""}
                        </span>
                      </span>
                    ),
                    ...Object.fromEntries(
                      criteria.map((criterion) => [
                        criterion.key,
                        <span key={criterion.key} className="tabular-nums">
                          {evaluation.scores.find((score) => score.criterion === criterion.key)?.score ?? "—"}
                        </span>,
                      ]),
                    ),
                    score: <span className="font-semibold tabular-nums">{scoreText(evaluation.score)}</span>,
                    breaches: (
                      <span className="tabular-nums">
                        {t("breachesOf", { breaches: evaluation.slaBreaches, orders: evaluation.workOrders })}
                      </span>
                    ),
                  },
                }))}
              />
            </>
          )}
          {toEvaluate.length ? (
            <div className="bg-bg-subtle rounded-control flex flex-col gap-2 p-4" data-testid="months-to-evaluate">
              <p className="m-0 text-sm font-medium">{t("toEvaluate", { count: toEvaluate.length })}</p>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {toEvaluate.slice(0, 6).map((which) => (
                  <li key={which}>
                    <Button asChild variant="secondary" size="sm">
                      <a href={evaluateHref(which)}>{formatPeriodKey(which, locale)}</a>
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>

        {months.length ? (
          <Card as="section" id="sla" aria-labelledby="contract-sla" className="flex flex-col gap-3">
            <CardHeader title={<span id="contract-sla">{t("breaches")}</span>} description={t("breachesHint")} />
            <FilterLinks
              label={t("breachMonth")}
              current={month ?? ""}
              links={months.slice(0, 6).map((which) => ({
                key: which,
                href: `${withQuery(base, { month: which })}#sla`,
                label: formatPeriodKey(which, locale),
                testId: `sla-month-${which}`,
              }))}
            />
            {!sla ? null : !sla.data ? (
              <SectionError error={sla.error} />
            ) : sla.data.breaches.length === 0 ? (
              <StatusText tone="success" icon={IconCheckCircle} testId="sla-clean">
                {t("noBreaches", { orders: sla.data.workOrders })}
              </StatusText>
            ) : (
              <>
                <p className="text-muted m-0 text-sm">
                  {t("breachSummary", { breaches: sla.data.breaches.length, orders: sla.data.workOrders })}
                </p>
                <SimpleTable
                  caption={t("breaches")}
                  testId="sla-breaches"
                  stackOnPhones
                  minWidth="44rem"
                  columns={[
                    { key: "work", header: t("col.work"), phone: "title" },
                    { key: "kind", header: t("col.kind"), phone: "meta" },
                    { key: "hours", header: t("col.hours"), align: "end", phone: "figure" },
                  ]}
                  rows={sla.data.breaches.map((item, index) => ({
                    key: `${item.workOrderId}-${item.kind}-${index}`,
                    href: ownerPath(locale, `/work-orders/${item.workOrderId}`),
                    testId: "sla-breach",
                    cells: {
                      work: (
                        <span className="flex flex-col gap-1">
                          <span className="font-medium">{item.title}</span>
                          <StatusBadgeOf map={PRIORITY_STATUS} value={item.priority} size="sm" />
                        </span>
                      ),
                      kind: <span className="text-sm">{t(`breachKind.${item.kind}`)}</span>,
                      hours:
                        item.allowedHours !== null && item.actualHours !== null ? (
                          <span className="text-sm whitespace-nowrap tabular-nums">
                            {t("hoursOf", {
                              actual: scoreText(item.actualHours.toFixed(2)),
                              allowed: item.allowedHours,
                            })}
                          </span>
                        ) : (
                          <span className="text-muted text-sm">{t("requestSla")}</span>
                        ),
                    },
                  }))}
                />
              </>
            )}
          </Card>
        ) : null}

        <Card as="section" aria-labelledby="contract-plans" className="flex flex-col gap-3">
          <CardHeader
            title={<span id="contract-plans">{t("plans")}</span>}
            description={t("plansHint")}
            action={
              <Button asChild variant="secondary" size="sm" iconStart={IconCalendar}>
                <a href={ownerPath(locale, "/maintenance")}>{t("openPlans")}</a>
              </Button>
            }
          />
          {contract.maintenancePlans.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("noPlans")}</p>
          ) : (
            <SimpleTable
              caption={t("plans")}
              testId="contract-plans"
              stackOnPhones
              minWidth="40rem"
              columns={[
                { key: "plan", header: t("col.plan"), phone: "title" },
                { key: "next", header: t("col.next"), phone: "figure" },
                { key: "last", header: t("col.last"), phone: "status" },
              ]}
              rows={contract.maintenancePlans.map((planItem) => ({
                key: planItem.id,
                testId: "contract-plan",
                cells: {
                  plan: (
                    <span className="flex flex-col">
                      <span className="font-medium">{planItem.title}</span>
                      <span className="text-muted text-sm">
                        {t("planEvery", { asset: planItem.assetItemName, days: planItem.intervalDays })}
                      </span>
                    </span>
                  ),
                  next: planItem.isActive ? (
                    <span className="whitespace-nowrap">{formatDate(planItem.nextDueOn, locale)}</span>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      {t("planStopped")}
                    </Badge>
                  ),
                  last: planItem.lastWorkOrderStatus ? (
                    <StatusBadgeOf map={WORK_ORDER_STATUS} value={planItem.lastWorkOrderStatus} size="sm" />
                  ) : (
                    <span className="text-muted text-sm">{t("noWorkOrder")}</span>
                  ),
                },
              }))}
            />
          )}
        </Card>

        <Card as="section" aria-labelledby="contract-documents" className="flex flex-col gap-3">
          <CardHeader title={<span id="contract-documents">{t("documents")}</span>} />
          {contract.documents.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("noDocuments")}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="contract-documents">
              {contract.documents.map((document) => (
                <li key={document.documentId} className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex flex-col">
                    <span className="font-medium">{t(`documentKind.${document.kind}`)}</span>
                    <span className="text-muted text-sm">{formatDateTime(document.createdAt, locale)}</span>
                  </span>
                  <DocumentButton
                    document={{ kind: "file", id: document.documentId }}
                    label={t("open")}
                    title={t(`documentKind.${document.kind}`)}
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="border-border flex flex-col gap-2 border-t pt-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">{t("alerts")}</h3>
            {contract.alerts.length === 0 ? (
              <p className="text-muted m-0 text-sm">
                {settings.windows.length ? t("noAlerts", { days: settings.windows.join(" · ") }) : t("noAlertsUnknown")}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0" data-testid="contract-alerts">
                {contract.alerts.map((alert) => (
                  <li key={`${alert.daysBefore}-${alert.endsOn}`}>
                    <StatusText tone="muted" icon={IconBell} detail={formatDateTime(alert.sentAt, locale)} size="sm">
                      {t("alert", { days: alert.daysBefore })}
                    </StatusText>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
        <p className="text-muted m-0 text-sm">{list("foot")}</p>
      </DetailLayout>
    </OwnerPage>
  );
}

/** What the contract editor picks from: buildings, active vendors, expense accounts, WHT rates, rounds, resolutions. */
async function editorChoices(context: OwnerContext) {
  const t = await getTranslations("owner.vendors.editor");
  const { api, locale } = context;
  const [settings, vendors, accounts, rounds, resolutions] = await Promise.all([
    vendorSettings(context),
    vendorChoices(api, "active"),
    chartOfAccounts(api),
    awardedRounds(api, (round) => t("roundOption", { title: round.title })),
    adoptedResolutions(api, (row) => t("resolutionOption", { number: row.number, title: row.title })),
  ]);
  return {
    settings,
    vendors: vendors.map((vendor) => ({ id: vendor.id, name: vendor.name, categories: vendor.categories })),
    accounts: expenseAccounts(accounts).map((account) => ({ id: account.id, label: accountLabel(account, locale) })),
    rounds,
    resolutions,
  };
}

/** The contract editor page: new (optionally for a vendor, `?vendor=`) or a draft being edited. */
export async function ContractFormView({
  context,
  contractId,
  searchParams,
}: {
  context: OwnerContext;
  contractId?: string;
  searchParams?: SearchParams;
}) {
  const t = await getTranslations("owner.vendors.editor");
  const { locale, me } = context;
  const contract = contractId ? await loadContract(context, contractId) : undefined;
  const choices = await editorChoices(context);
  const canManage = !readOnly(me) && ownerCan(me, "juristic.vendor.manage");
  const editable = !contract || contract.nextActions.includes("edit");
  const back = contract
    ? ownerPath(locale, `/juristic/contracts/${contract.id}`)
    : ownerPath(locale, "/juristic/contracts");
  const vendorParam = param(searchParams?.vendor);
  return (
    <OwnerPage testId={contract ? "juristic-contract-edit" : "juristic-contract-new"}>
      <PageHeader
        title={contract ? t("editTitle", { title: contract.title }) : t("title")}
        description={t("lede")}
        back={{ label: contract ? t("backToContract") : t("back"), href: back }}
      />
      {!canManage || !editable ? (
        <EmptyState
          variant="card"
          icon={IconContract}
          title={t("blockedTitle")}
          description={!canManage ? t("forbidden") : t("notDraft")}
          action={
            <Button asChild variant="secondary">
              <a href={back}>{contract ? t("backToContract") : t("back")}</a>
            </Button>
          }
        />
      ) : choices.vendors.length === 0 && !contract ? (
        <EmptyState
          variant="card"
          icon={IconContract}
          title={t("noVendorsTitle")}
          description={t("noVendors")}
          action={
            <Button asChild variant="secondary" iconStart={IconAdd}>
              <a href={ownerPath(locale, "/juristic/vendors/new")}>{t("addVendor")}</a>
            </Button>
          }
        />
      ) : (
        <ContractForm
          buildings={context.buildings.map((building) => ({ id: building.id, name: building.name }))}
          vendors={choices.vendors}
          accounts={choices.accounts}
          rates={choices.settings.rates}
          rounds={choices.rounds}
          resolutions={choices.resolutions}
          threshold={choices.settings.threshold}
          defaultBuildingId={focusedBuilding(context)?.id}
          defaultVendorId={choices.vendors.some((vendor) => vendor.id === vendorParam) ? vendorParam : undefined}
          contract={contract}
        />
      )}
    </OwnerPage>
  );
}

/**
 * The monthly evaluation page (D-331): the month (`?month=`, a month of the term up to this one without an
 * evaluation), a 1–5 score per criterion of the setting, incidents and notes, and the month's SLA breaches pulled from
 * the vendor's work orders — read-only here and snapshotted by the API with the evaluation.
 */
export async function EvaluateView({
  context,
  contractId,
  searchParams,
}: {
  context: OwnerContext;
  contractId: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.vendors.evaluate");
  const { api, locale } = context;
  const contract = await loadContract(context, contractId);
  const back = ownerPath(locale, `/juristic/contracts/${contract.id}`);
  const thisMonth = bangkokToday().slice(0, 7);
  const open = monthsToEvaluate(contract, contract.evaluations, thisMonth);
  const month = open.find((entry) => entry === param(searchParams.month)) ?? defaultEvaluationMonth(open, thisMonth);
  const [settings, sla] = await Promise.all([
    vendorSettings(context),
    month
      ? section(
          unwrap(
            api.GET("/v1/owner/juristic/vendor-contracts/{contractId}/sla-breaches", {
              params: { path: { contractId }, query: { month } },
            }),
          ),
        )
      : Promise.resolve(null),
  ]);
  const allowed = contract.nextActions.includes("evaluate");
  return (
    <OwnerPage testId="juristic-contract-evaluate">
      <PageHeader
        title={t("title", { vendor: contract.vendorName })}
        description={t("lede", { contract: contract.title })}
        back={{ label: t("back"), href: back }}
      />
      {!allowed || !month ? (
        <EmptyState
          variant="card"
          icon={IconEvaluation}
          title={!allowed ? t("blockedTitle") : t("doneTitle")}
          description={!allowed ? t("blocked") : t("done")}
          action={
            <Button asChild variant="secondary">
              <a href={back}>{t("back")}</a>
            </Button>
          }
        />
      ) : settings.criteria.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconEvaluation}
          title={t("noCriteriaTitle")}
          description={t("noCriteria")}
          action={
            <Button asChild variant="secondary">
              <a href={back}>{t("back")}</a>
            </Button>
          }
        />
      ) : (
        <EvaluationForm
          contractId={contract.id}
          month={month}
          months={open.slice(0, 12).map((value) => ({ value, label: formatPeriodKey(value, locale) }))}
          criteria={settings.criteria}
          sla={sla?.data ?? null}
          slaFailed={Boolean(sla && !sla.data)}
        />
      )}
    </OwnerPage>
  );
}
