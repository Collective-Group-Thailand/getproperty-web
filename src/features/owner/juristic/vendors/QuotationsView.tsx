import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { QUOTATION_ROUND_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { bangkokToday } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { ListToolbar, ViewTabs } from "@/ui/components/ListToolbar";
import { ProgressLine } from "@/ui/components/ProgressLine";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusText } from "@/ui/components/StatusText";
import { Icon } from "@/ui/icons";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconQuotation } from "@/ui/icons/glyphs/quotation";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath, withQuery } from "../../shared/links";
import { focusedBuilding, ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { accountLabel, expenseAccounts } from "../accounting/accounts";
import { bandRangeText } from "../accounting/ApprovalBand";
import { approveBlock, bandIndexFor, bandRange } from "../accounting/bands";
import { memberName } from "../accounting/parts";
import { adoptedResolutions, expenseAccountList, officeMembers } from "../accounting/shared";
import { ComparisonTable, QuoteRuleLine } from "./pieces";
import {
  AddQuotationButton,
  ApproveRoundButton,
  AwardButton,
  NewRoundButton,
  ReasonRoundButton,
} from "./QuotationActions";
import { compareQuotations, quoteRule } from "./quotations";
import { vendorChoices, vendorSettings } from "./shared";

type SearchParams = Record<string, string | string[] | undefined>;
type Round = Schemas["QuotationRoundDto"];
const TABS = ["mine", "open", "awaiting_approval", "awarded", "cancelled", "all"] as const;
type Tab = (typeof TABS)[number];

/**
 * Quotation rounds (D-310): what waits for the viewer's approval first ("รออนุมัติจากฉัน" — the API's `awaitingMe`),
 * then by state. Each row: the title with the building and kind of work, the quotations against the three required
 * (marked when short), the lowest quote (the API lists them cheapest first), the estimate and the state.
 */
export async function QuotationsView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.vendors.rounds");
  const categories = await getTranslations("owner.vendors.category");
  const { api, locale, me } = context;
  const building = focusedBuilding(context);
  const canApprove = ownerCan(me, "juristic.expense.approve");
  const visible = TABS.filter((which) => which !== "mine" || canApprove);
  const tab: Tab = visible.find((which) => which === param(searchParams.tab)) ?? (canApprove ? "mine" : "open");
  const q = param(searchParams.q);
  const page = pageParam(searchParams.page);
  const scope = { ...(building ? { buildingId: building.id } : {}), ...(q ? { q } : {}) };
  const queryOf = (which: Tab) =>
    which === "mine" ? { awaitingMe: true } : which === "all" ? {} : { state: which as Schemas["QuotationRoundState"] };
  const list = await section(
    unwrap(
      api.GET("/v1/owner/juristic/quotation-rounds", {
        params: { query: { page, perPage: 25, ...scope, ...queryOf(tab) } },
      }),
    ),
  );
  // Tab badges from the page's `counts` (J-CR), which count the building, not the search: with a search only the
  // open tab shows its total.
  const tabCounts = list.data?.counts;
  const COUNT_OF: Record<Tab, keyof Schemas["QuotationRoundCountsDto"]> = {
    mine: "awaitingMe",
    open: "open",
    awaiting_approval: "awaitingApproval",
    awarded: "awarded",
    cancelled: "cancelled",
    all: "all",
  };
  const counts = visible.map((which) =>
    q ? (which === tab ? list.data?.meta.total : undefined) : tabCounts?.[COUNT_OF[which]],
  );
  const canManage = !readOnly(me) && ownerCan(me, "juristic.vendor.manage");
  const base = ownerPath(locale, "/juristic/quotations");
  const rows = list.data?.data ?? [];
  const buildings = context.buildings.map((entry) => ({ id: entry.id, name: entry.name }));
  return (
    <OwnerPage testId="juristic-quotations">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={canManage ? <NewRoundButton buildings={buildings} defaultBuildingId={building?.id} /> : undefined}
      />
      <ListToolbar
        tabs={
          <ViewTabs
            label={t("tabs")}
            current={tab}
            tabs={visible.map((which, index) => ({
              key: which,
              href: withQuery(base, { tab: which, q }),
              label: t(`tab.${which}`),
              count: counts[index],
              testId: `rounds-tab-${which}`,
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
          icon={IconQuotation}
          title={q ? t("empty.filtered.title") : t(`empty.${tab}.title`)}
          description={q ? t("empty.filtered.body") : t(`empty.${tab}.body`)}
          action={
            q ? (
              <Button asChild variant="secondary">
                <a href={withQuery(base, { tab })}>{t("empty.clear")}</a>
              </Button>
            ) : tab === "mine" || tab !== "open" ? (
              <Button asChild variant="secondary">
                <a href={withQuery(base, { tab: tab === "all" ? "open" : "all" })}>
                  {tab === "all" ? t("empty.toOpen") : t("empty.toAll")}
                </a>
              </Button>
            ) : canManage ? (
              <NewRoundButton buildings={buildings} defaultBuildingId={building?.id} variant="secondary" />
            ) : undefined
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="round-rows"
          stackOnPhones
          minWidth="58rem"
          columns={[
            { key: "round", header: t("col.round"), phone: "title" },
            { key: "quotes", header: t("col.quotes"), phone: "meta" },
            { key: "lowest", header: t("col.lowest"), align: "end", phone: "figure" },
            { key: "state", header: t("col.state"), phone: "status" },
          ]}
          rows={rows.map((round) => {
            const rule = quoteRule(round);
            const lowest = compareQuotations(round.quotations)[0];
            return {
              key: round.id,
              href: ownerPath(locale, `/juristic/quotations/${round.id}`),
              testId: "round-row",
              data: { state: round.state, rule: rule.state, title: round.title },
              cells: {
                round: (
                  <span className="flex min-w-0 flex-col">
                    <span className="font-medium">{round.title}</span>
                    <span className="text-muted text-sm">
                      {[building ? null : round.buildingName, round.category ? categories(round.category) : null]
                        .filter(Boolean)
                        .join(" · ") || t("noCategory")}
                    </span>
                  </span>
                ),
                quotes: (
                  <span className="flex flex-col gap-1">
                    <span className="text-sm tabular-nums">
                      {t("quotes", { count: rule.count, minimum: rule.minimum })}
                    </span>
                    {rule.state === "short" && round.state === "open" ? (
                      <span className="text-muted text-sm">{t("short")}</span>
                    ) : null}
                  </span>
                ),
                lowest: lowest ? (
                  <span className="flex flex-col items-end">
                    <span className="font-medium tabular-nums">{formatTHB(lowest.amount, locale)}</span>
                    {round.estimatedAmount ? (
                      <span className="text-muted text-sm whitespace-nowrap tabular-nums">
                        {t("estimate", { amount: formatTHB(round.estimatedAmount, locale) })}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted text-sm">
                    {round.estimatedAmount ? t("estimate", { amount: formatTHB(round.estimatedAmount, locale) }) : "—"}
                  </span>
                ),
                state: <StatusBadgeOf map={QUOTATION_ROUND_STATUS} value={round.state} size="sm" />,
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
 * Who must approve an award and how far it is: the band snapshotted when the award was asked for, in one sentence
 * ("ต้องอนุมัติ 2 คน จาก เจ้าของ · ผู้จัดการ · กรรมการ"), a thin progress line, each decision with name / role / time,
 * and — when the viewer may not approve — why, the requester (maker ≠ checker, D-091) first.
 */
async function RoundApproval({
  round,
  members,
  viewer,
  locale,
}: {
  round: Round;
  members: Schemas["MemberDto"][];
  viewer: { userId: string; roles: string[]; canApprove: boolean };
  locale: Locale;
}) {
  const t = await getTranslations("owner.vendors.approval");
  const band = await getTranslations("owner.accounting.band");
  const common = await getTranslations("owner.accounting.common");
  const required = round.approvalsRequired ?? 0;
  const current = round.awardRequestedAt
    ? round.approvals.filter((entry) => entry.createdAt >= round.awardRequestedAt!)
    : [];
  const earlier = round.approvals.filter((entry) => !current.includes(entry));
  const block =
    round.state === "awaiting_approval"
      ? approveBlock(
          {
            state: "submitted",
            requestedBy: round.awardRequestedBy ?? "",
            nextActions: round.nextActions,
            approvals: current,
            band: { roles: round.approverRoles },
          },
          viewer,
        )
      : null;
  const decision = (entry: Schemas["ExpenseApprovalDto"]) => (
    <li key={`${entry.approverUserId}-${entry.createdAt}`} className="flex flex-col gap-0.5 text-sm">
      <StatusText
        tone={entry.decision === "approved" ? "success" : "neutral"}
        icon={entry.decision === "approved" ? IconCheckCircle : IconXCircle}
        detail={formatDateTime(entry.createdAt, locale)}
      >
        {band(entry.decision === "approved" ? "approvedBy" : "rejectedBy", {
          name: memberName(members, entry.approverUserId, common("unknownMember")),
          role: band(`role.${entry.role}`),
        })}
      </StatusText>
      {entry.reason ? <span className="text-muted ps-6">{band("quoted", { reason: entry.reason })}</span> : null}
    </li>
  );
  return (
    <div className="flex flex-col gap-3" data-testid="round-approval">
      {round.basis === "approval" && required ? (
        <>
          <p className="m-0 text-sm" data-testid="round-approval-rule">
            {t("rule", {
              count: required,
              roles: round.approverRoles.map((role) => band(`role.${role}`)).join(" · "),
              requester: memberName(members, round.awardRequestedBy, common("unknownMember")),
            })}
          </p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-muted">{band("progress")}</span>
              <span className="font-medium tabular-nums" data-testid="round-approval-progress">
                {band("given", { given: round.approvalsGiven, required })}
              </span>
            </div>
            <ProgressLine
              share={required ? Math.min(1, round.approvalsGiven / required) : 0}
              label={band("given", { given: round.approvalsGiven, required })}
            />
          </div>
        </>
      ) : null}
      {current.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">{current.map(decision)}</ul>
      ) : round.state === "awaiting_approval" ? (
        <StatusText tone="muted" icon={IconClock}>
          {band("noneYet")}
        </StatusText>
      ) : null}
      {earlier.length ? (
        <details className="text-sm">
          <summary className="text-primary w-fit cursor-pointer font-medium">
            {t("earlier", { count: earlier.length })}
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0">{earlier.map(decision)}</ul>
        </details>
      ) : null}
      {block && block !== "state" ? (
        <p
          className="bg-bg-subtle rounded-control m-0 flex items-start gap-2 p-3 text-sm"
          data-testid="round-approve-block"
          data-block={block}
        >
          <Icon icon={IconInfo} className="text-subtle mt-0.5 shrink-0" />
          <span>{t(`block.${block}`)}</span>
        </p>
      ) : null}
    </div>
  );
}

async function loadRound(context: OwnerContext, roundId: string): Promise<Round> {
  try {
    return await unwrap(
      context.api.GET("/v1/owner/juristic/quotation-rounds/{roundId}", { params: { path: { roundId } } }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

/**
 * One quotation round (D-310): the three-quotation rule in one line, the quotations side by side cheapest first, the
 * award (outcome, basis, the reason when fewer were taken, links to the contract or expense draft it made) and the
 * panel with the award's approvals and the API's `nextActions`: add a quotation, award, approve / reject, cancel.
 */
export async function QuotationRoundView({ context, roundId }: { context: OwnerContext; roundId: string }) {
  const t = await getTranslations("owner.vendors.round");
  const categories = await getTranslations("owner.vendors.category");
  const bandWords = await getTranslations("owner.accounting.band");
  const { api, locale, me } = context;
  const round = await loadRound(context, roundId);
  const can = (action: string) => !readOnly(me) && round.nextActions.includes(action);
  const today = bangkokToday();
  const [settings, members, vendors, accounts, resolutions] = await Promise.all([
    vendorSettings(context),
    officeMembers(api),
    can("add_quotation") ? vendorChoices(api, "active") : Promise.resolve([]),
    can("award") ? expenseAccountList(api) : Promise.resolve([]),
    can("award")
      ? adoptedResolutions(api, (row) => `${row.number} · ${row.title}`)
      : Promise.resolve([] as { id: string; buildingId: string; label: string }[]),
  ]);
  const rule = quoteRule(round);
  const awarded = round.quotations.find((quote) => quote.id === round.awardedQuotationId) ?? null;
  const viewer = { userId: me.user.id, roles: me.roles, canApprove: ownerCan(me, "juristic.expense.approve") };
  const money = (value: string) => formatTHB(value, locale);
  const bandText: Record<string, string> = {};
  if (can("award"))
    for (const quote of round.quotations) {
      const index = bandIndexFor(quote.amount, settings.bands);
      const entry = settings.bands[index];
      if (entry)
        bandText[quote.id] = bandWords("rule", {
          range: await bandRangeText(bandRange(settings.bands, index), locale),
          count: entry.approvals,
          roles: entry.roles.map((role) => bandWords(`role.${role}`)).join(" · "),
        });
    }
  const vendorOptions = vendors
    .filter((vendor) => !round.category || vendor.categories.includes(round.category) || vendor.categories.length === 0)
    .concat(
      vendors.filter(
        (vendor) => round.category && vendor.categories.length > 0 && !vendor.categories.includes(round.category),
      ),
    )
    .map((vendor) => ({
      id: vendor.id,
      name: vendor.name,
      description: vendor.categories.map((entry) => categories(entry)).join(" · ") || undefined,
    }));
  const add = (variant: "primary" | "secondary") => (
    <AddQuotationButton round={round} vendors={vendorOptions} today={today} variant={variant} />
  );
  const primary = can("approve") ? (
    <ApproveRoundButton round={round} />
  ) : can("award") && rule.state !== "short" ? (
    <AwardButton
      round={round}
      today={today}
      accounts={expenseAccounts(accounts).map((account) => ({
        value: account.id,
        label: accountLabel(account, locale),
      }))}
      rates={settings.rates}
      resolutions={resolutions.filter((resolution) => resolution.buildingId === round.buildingId)}
      bandText={bandText}
    />
  ) : can("add_quotation") ? (
    add("primary")
  ) : round.outcomeContractId ? (
    <Button asChild block>
      <a href={ownerPath(locale, `/juristic/contracts/${round.outcomeContractId}`)} data-testid="round-outcome">
        {t("openContract")}
      </a>
    </Button>
  ) : round.outcomeExpenseRequestId ? (
    <Button asChild block>
      <a href={ownerPath(locale, `/juristic/expenses/${round.outcomeExpenseRequestId}`)} data-testid="round-outcome">
        {t("openExpense")}
      </a>
    </Button>
  ) : undefined;
  const primaryIs = can("approve")
    ? "approve"
    : can("award") && rule.state !== "short"
      ? "award"
      : can("add_quotation")
        ? "add"
        : null;

  return (
    <OwnerPage testId="juristic-quotation-round">
      <PageHeader
        title={round.title}
        status={<StatusBadgeOf map={QUOTATION_ROUND_STATUS} value={round.state} />}
        description={t("lede", {
          building: round.buildingName,
          category: round.category ? categories(round.category) : t("noCategory"),
          date: formatDate(round.createdAt, locale),
        })}
        back={{ label: t("back"), href: ownerPath(locale, "/juristic/quotations") }}
      />
      <DetailLayout
        panelFirstOnPhones
        panel={
          <ActionPanel
            testId="round-panel"
            summary={
              <div className="flex flex-col gap-1">
                <span className="text-muted text-sm">{awarded ? t("awardedAmount") : t("lowestAmount")}</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums" data-testid="round-amount">
                  {awarded
                    ? money(awarded.amount)
                    : round.quotations.length
                      ? money(compareQuotations(round.quotations)[0]!.amount)
                      : "—"}
                </span>
                <span className="text-muted text-sm">
                  {awarded
                    ? awarded.vendorName
                    : round.estimatedAmount
                      ? t("estimate", { amount: money(round.estimatedAmount) })
                      : t("noEstimate")}
                </span>
              </div>
            }
            title={t(`panel.${round.state}`)}
            description={
              round.state === "awaiting_approval" || round.state === "awarded" ? (
                <RoundApproval round={round} members={members} viewer={viewer} locale={locale} />
              ) : (
                t(`panel.${round.state}Body`, { minimum: round.minimumQuotations })
              )
            }
            primary={primary}
            secondary={
              <>
                {primaryIs !== "add" && can("add_quotation") ? add("secondary") : null}
                {primaryIs !== "award" && can("award") ? (
                  <AwardButton
                    round={round}
                    today={today}
                    accounts={expenseAccounts(accounts).map((account) => ({
                      value: account.id,
                      label: accountLabel(account, locale),
                    }))}
                    rates={settings.rates}
                    resolutions={resolutions.filter((resolution) => resolution.buildingId === round.buildingId)}
                    bandText={bandText}
                    variant="secondary"
                  />
                ) : null}
                {can("approve") ? <ReasonRoundButton round={round} action="reject" /> : null}
              </>
            }
            destructive={can("cancel") ? <ReasonRoundButton round={round} action="cancel" /> : undefined}
          />
        }
      >
        {round.state === "cancelled" ? (
          <div data-testid="round-cancelled">
            <Callout
              tone="neutral"
              title={t("cancelledTitle", { date: formatDate(round.cancelledAt ?? round.createdAt, locale) })}
            >
              {round.cancelReason}
            </Callout>
          </div>
        ) : null}
        <QuoteRuleLine rule={rule} locale={locale} />
        <Card as="section" aria-labelledby="round-quotes" className="flex flex-col gap-3">
          <CardHeader title={<span id="round-quotes">{t("quotations")}</span>} description={t("quotationsHint")} />
          {round.quotations.length === 0 ? (
            <EmptyState
              icon={IconQuotation}
              title={t("noQuotes")}
              description={t("noQuotesBody", { minimum: round.minimumQuotations })}
              action={can("add_quotation") ? add("secondary") : undefined}
            />
          ) : (
            <ComparisonTable
              quotations={round.quotations}
              awardedId={round.awardedQuotationId}
              today={today}
              locale={locale}
            />
          )}
        </Card>
        {round.awardedQuotationId ? (
          <Card
            as="section"
            aria-labelledby="round-award"
            className="flex flex-col gap-3"
            data-testid="round-award-facts"
          >
            <CardHeader title={<span id="round-award">{t("award")}</span>} />
            <DescriptionList
              columns={2}
              items={[
                { id: "vendor", term: t("awardVendor"), description: awarded?.vendorName ?? null },
                { id: "amount", term: t("awardAmount"), description: awarded ? money(awarded.amount) : null },
                {
                  id: "outcome",
                  term: t("outcome"),
                  description: round.outcome ? t(`outcomeWord.${round.outcome}`) : null,
                },
                {
                  id: "basis",
                  term: t("basis"),
                  description:
                    round.basis === "resolution" && round.resolutionId ? (
                      <a
                        className="text-primary underline-offset-4 hover:underline"
                        href={ownerPath(locale, `/juristic/resolutions/${round.resolutionId}`)}
                      >
                        {t("basisResolution")}
                      </a>
                    ) : round.basis ? (
                      t(`basisWord.${round.basis}`)
                    ) : null,
                },
                {
                  id: "requested",
                  term: t("requestedAt"),
                  description: round.awardRequestedAt ? formatDateTime(round.awardRequestedAt, locale) : null,
                },
                ...(round.awardedAt
                  ? [{ id: "awardedAt", term: t("awardedAt"), description: formatDateTime(round.awardedAt, locale) }]
                  : []),
                ...(round.fewerQuotationsReason
                  ? [
                      {
                        id: "reason",
                        term: t("fewerReason", { minimum: round.minimumQuotations }),
                        description: <span data-testid="round-fewer-reason">{round.fewerQuotationsReason}</span>,
                        wide: true,
                      },
                    ]
                  : []),
              ]}
            />
            {round.outcomeContractId || round.outcomeExpenseRequestId ? (
              <StatusText tone="success" icon={IconCheckCircle}>
                <a
                  className="underline-offset-4 hover:underline"
                  href={ownerPath(
                    locale,
                    round.outcomeContractId
                      ? `/juristic/contracts/${round.outcomeContractId}`
                      : `/juristic/expenses/${round.outcomeExpenseRequestId}`,
                  )}
                >
                  {round.outcomeContractId ? t("outcomeContractMade") : t("outcomeExpenseMade")}
                </a>
              </StatusText>
            ) : round.state === "awaiting_approval" ? (
              <p className="text-muted m-0 text-sm">{t("outcomeAfter")}</p>
            ) : null}
          </Card>
        ) : null}
        {round.description ? (
          <Card as="section" aria-labelledby="round-description" className="flex flex-col gap-2">
            <CardHeader title={<span id="round-description">{t("description")}</span>} />
            <p className="m-0 whitespace-pre-line">{round.description}</p>
          </Card>
        ) : null}
      </DetailLayout>
    </OwnerPage>
  );
}
