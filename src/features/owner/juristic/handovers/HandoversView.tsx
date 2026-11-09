import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { HANDOVER_STATUS } from "@/domain/status";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { bangkokToday, currentTime } from "@/features/shared/console/time";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { FilterLinks, ViewTabs } from "@/ui/components/ListToolbar";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatsRow } from "@/ui/components/StatsRow";
import { StatusText } from "@/ui/components/StatusText";
import { Icon } from "@/ui/icons";
import { IconAlert } from "@/ui/icons/glyphs/alert";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconResidents } from "@/ui/icons/glyphs/residents";
import { IconSend } from "@/ui/icons/glyphs/send";
import { isZeroDecimal } from "@/ui/lib/decimal";

import { ownerPath, withQuery } from "../../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { AcceptHandoverButton, JuristicFormedButton, RejectHandoverButton } from "./HandoverActions";
import {
  acceptBlock,
  appliedMatches,
  filterUnits,
  INBOX_TABS,
  inboxTab,
  notDue,
  problemsByUnit,
  registerOnly,
  TAB_STATE,
  UNIT_FILTERS,
  unitFilter,
} from "./handover";
import { AppliedCard, HandoverProblems, OwnerMatches, ReceivingBank } from "./pieces";

type SearchParams = Record<string, string | string[] | undefined>;
type Review = Schemas["JuristicHandoverReviewDto"];
const UNITS_PER_PAGE = 50;

/**
 * `/juristic/handovers` (JW3b, D-333): what developers handed over through getbuild — the waiting ones first, each
 * with its register in words, the handover date and the money that arrives with it, in ink.
 */
export async function HandoversView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.handovers.list");
  const { api, locale } = context;
  const page = pageParam(searchParams.page);
  const count = (state: Schemas["HandoverState"] | undefined) =>
    unwrap(api.GET("/v1/owner/juristic/handovers", { params: { query: { perPage: 1, ...(state ? { state } : {}) } } }))
      .then((answer) => answer.meta.total)
      .catch(() => undefined);
  const counts = await Promise.all(INBOX_TABS.map((tab) => count(TAB_STATE[tab])));
  const tab = inboxTab(param(searchParams.tab), counts[0] ?? 0);
  const state = TAB_STATE[tab];
  const list = await section(
    unwrap(
      api.GET("/v1/owner/juristic/handovers", {
        params: { query: { page, perPage: 25, ...(state ? { state } : {}) } },
      }),
    ),
  );
  const base = ownerPath(locale, "/juristic/handovers");
  const now = currentTime();
  const rows = list.data?.data ?? [];
  const money = (amount: string) => (
    <span className={isZeroDecimal(amount) ? "text-muted" : undefined}>{formatTHB(amount, locale)}</span>
  );
  return (
    <OwnerPage testId="juristic-handovers">
      <PageHeader title={t("title")} description={t("lede")} />
      <ViewTabs
        label={t("tabs")}
        current={tab}
        tabs={INBOX_TABS.map((which, index) => ({
          key: which,
          href: withQuery(base, { tab: which }),
          label: t(`tab.${which}`),
          count: counts[index],
          testId: `handovers-tab-${which}`,
        }))}
      />
      {!list.data ? (
        <SectionError error={list.error} />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="card"
          icon={IconKey}
          title={t(`empty.${tab}.title`)}
          description={t(`empty.${tab}.body`)}
          action={
            tab !== "all" ? (
              <a
                className="text-primary font-medium underline-offset-4 hover:underline"
                href={withQuery(base, { tab: "all" })}
              >
                {t("empty.toAll")}
              </a>
            ) : (
              <a
                className="text-primary font-medium underline-offset-4 hover:underline"
                href={ownerPath(locale, "/juristic/import")}
              >
                {t("empty.toImport")}
              </a>
            )
          }
        />
      ) : (
        <SimpleTable
          caption={t("title")}
          testId="handover-rows"
          stackOnPhones
          minWidth="60rem"
          columns={[
            { key: "building", header: t("col.building"), phone: "title" },
            { key: "date", header: t("col.date"), phone: "meta" },
            { key: "advance", header: t("col.advance"), align: "end", phone: "meta", phoneLabel: true },
            { key: "fund", header: t("col.fund"), align: "end", phone: "meta", phoneLabel: true },
            { key: "forward", header: t("col.forward"), align: "end", phone: "meta", phoneLabel: true },
            { key: "state", header: t("col.state"), phone: "status" },
          ]}
          rows={rows.map((row) => ({
            key: row.id,
            href: ownerPath(locale, `/juristic/handovers/${row.id}`),
            testId: "handover-row",
            data: { state: row.state, building: row.buildingName },
            cells: {
              building: (
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{row.buildingName}</span>
                  <span className="text-muted text-sm">
                    {t("register", { units: row.totals.units, owners: row.totals.parties })}
                  </span>
                </span>
              ),
              date: (
                <span className="flex flex-col whitespace-nowrap">
                  <span>{formatDate(row.requestedHandoverAt, locale)}</span>
                  {row.state === "pending_review" && notDue(row.requestedHandoverAt, now) ? (
                    <span className="text-muted text-sm">{t("notDue")}</span>
                  ) : null}
                </span>
              ),
              advance: registerOnly(row) ? (
                <span className="text-muted text-sm">{t("registerOnly")}</span>
              ) : (
                money(row.totals.advanceCommonFees)
              ),
              fund: registerOnly(row) ? null : money(row.totals.firstFundContributions),
              forward: registerOnly(row) ? null : money(row.totals.receivablesBroughtForward),
              state: <StatusBadgeOf map={HANDOVER_STATUS} value={row.state} size="sm" />,
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

async function loadReview(context: OwnerContext, handoverId: string): Promise<Review> {
  try {
    return await unwrap(
      context.api.GET("/v1/owner/juristic/handovers/{handoverId}", { params: { path: { handoverId } } }),
    );
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
}

/**
 * `/juristic/handovers/[handoverId]` (JW3b, D-333): the review — what arrives (figures in ink), what blocks an
 * acceptance, where the money lands, the owners new or matched, unit by unit; after the decision, what was recorded or
 * why it was refused. The panel carries the API's next actions: accept (disabled with its reason), the juristic
 * person's formation, reject last.
 */
export async function HandoverReviewView({
  context,
  handoverId,
  searchParams,
}: {
  context: OwnerContext;
  handoverId: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations("owner.handovers.review");
  const { api, locale, me } = context;
  const review = await loadReview(context, handoverId);
  const now = currentTime();
  const today = bangkokToday();
  const can = (action: string) => !readOnly(me) && review.nextActions.includes(action);
  const accounts = review.receivingBank?.matchedBankAccountId
    ? await unwrap(api.GET("/v1/owner/bank-accounts")).catch(() => [] as Schemas["BankAccountDto"][])
    : [];
  const matched = accounts.find((account) => account.id === review.receivingBank?.matchedBankAccountId) ?? null;
  const problems = problemsByUnit(review.problems);
  const filter = unitFilter(param(searchParams.units), review.problems.length > 0);
  const units = filterUnits(review.units, problems, filter);
  const page = pageParam(searchParams.page);
  const shown = units.slice((page - 1) * UNITS_PER_PAGE, page * UNITS_PER_PAGE);
  const block = acceptBlock(review, now);
  const base = ownerPath(locale, `/juristic/handovers/${review.id}`);
  const moneyless = registerOnly(review);
  const building = context.buildings.find((entry) => entry.id === review.buildingId) ?? null;
  const pending = review.state === "pending_review";

  const figures = [
    {
      key: "units",
      label: t("figure.units"),
      value: t("figure.unitsValue", { count: review.totals.units }),
      hint: t("figure.unitsHint", { floors: review.totals.floors, owners: review.totals.parties }),
    },
    ...(moneyless
      ? []
      : [
          {
            key: "advance",
            label: t("figure.advance"),
            value: formatTHB(review.totals.advanceCommonFees, locale),
            hint: t("figure.advanceHint", { count: review.totals.unitsWithMoney }),
          },
          {
            key: "fund",
            label: t("figure.fund"),
            value: formatTHB(review.totals.firstFundContributions, locale),
          },
          {
            key: "forward",
            label: t("figure.forward"),
            value: formatTHB(review.totals.receivablesBroughtForward, locale),
            hint: t("figure.forwardHint", { count: review.totals.receivableItems }),
          },
        ]),
  ];

  // ── the panel ────────────────────────────────────────────────────────────────────────────────────────────────
  const reason = block ? (
    <StatusText tone="warning" icon={IconAlert} testId="handover-accept-reason">
      {block.reason === "not_due"
        ? t("panel.reason.notDue", { date: formatDate(block.on, locale) })
        : t("panel.reason.problems", { count: block.count })}
    </StatusText>
  ) : null;
  const primary = can("accept") ? (
    <div className="flex flex-col gap-2">
      <AcceptHandoverButton review={review} disabled={!!block} />
      {reason}
    </div>
  ) : can("juristic_formed") ? (
    <JuristicFormedButton review={review} today={today} />
  ) : undefined;
  const destructive = can("reject") ? <RejectHandoverButton review={review} /> : undefined;
  const panelTitle = pending
    ? t("panel.title.pending")
    : review.state === "accepted"
      ? review.formedOn
        ? t("panel.title.formed")
        : t("panel.title.accepted")
      : t(`panel.title.${review.state === "rejected" ? "rejected" : "other"}`);
  const panelBody = pending ? (
    review.nextActions.length > 0 ? (
      <div className="flex flex-col gap-2">
        <p className="m-0">{t("panel.body.pending")}</p>
        <ul className="m-0 flex list-disc flex-col gap-1 ps-5 text-sm" data-testid="handover-effects">
          {(moneyless ? (["register"] as const) : (["register", "credits", "fund", "opening"] as const)).map(
            (effect) => (
              <li key={effect}>{t(`panel.effect.${effect}`)}</li>
            ),
          )}
        </ul>
      </div>
    ) : (
      t("panel.readOnly")
    )
  ) : review.state === "accepted" ? (
    review.formedOn ? (
      t("panel.body.formed", {
        date: formatDate(review.formedOn, locale),
        number: review.registrationNo ?? t("panel.noNumber"),
      })
    ) : review.developerTenantId ? (
      t("panel.body.developerOperates")
    ) : (
      t("panel.body.accepted")
    )
  ) : review.state === "rejected" ? (
    review.rejectionDeliveredAt ? (
      t("panel.body.rejectedDelivered", { date: formatDateTime(review.rejectionDeliveredAt, locale) })
    ) : (
      t("panel.body.rejectedWaiting")
    )
  ) : (
    t("panel.body.superseded")
  );
  const summary = (
    <dl className="divide-border m-0 flex flex-col divide-y" data-testid="handover-summary">
      {[
        {
          key: "date",
          icon: IconCalendar,
          label: t("summary.date"),
          value: formatDate(review.requestedHandoverAt, locale),
        },
        {
          key: "asOf",
          icon: IconClock,
          label: t("summary.asOf"),
          value: review.asOfDate ? formatDate(review.asOfDate, locale) : t("summary.none"),
        },
        { key: "sent", icon: IconSend, label: t("summary.sent"), value: formatDate(review.createdAt, locale) },
        {
          key: "payload",
          icon: IconInfo,
          label: t("summary.payload"),
          value: moneyless ? t("summary.registerOnly") : t("summary.withMoney"),
        },
      ].map((fact) => (
        <div key={fact.key} className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
          <dt className="text-muted flex items-center gap-2.5 text-sm">
            <Icon icon={fact.icon} size={18} className="text-subtle shrink-0" />
            {fact.label}
          </dt>
          <dd className="m-0 text-end text-sm font-medium" data-testid={`handover-summary-${fact.key}`}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );

  return (
    <OwnerPage testId="juristic-handover">
      <PageHeader
        title={t("title", { building: review.buildingName })}
        status={<StatusBadgeOf map={HANDOVER_STATUS} value={review.state} />}
        description={t("lede", {
          sent: formatDate(review.createdAt, locale),
          date: formatDate(review.requestedHandoverAt, locale),
        })}
        back={{ label: t("back"), href: ownerPath(locale, "/juristic/handovers") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="handover-panel"
            summary={summary}
            title={panelTitle}
            description={panelBody}
            primary={primary}
            destructive={destructive}
            secondary={
              building ? (
                <a
                  href={ownerPath(locale, "/juristic/register")}
                  className="text-primary text-sm font-medium underline-offset-4 hover:underline"
                  data-testid="handover-to-register"
                >
                  {t("panel.toRegister", { building: building.name })}
                </a>
              ) : undefined
            }
          />
        }
      >
        <div className="flex flex-col gap-6">
          <StatsRow
            label={t("figure.label")}
            figures={figures}
            highlight={!moneyless && !isZeroDecimal(review.totals.receivablesBroughtForward) ? "forward" : undefined}
          />
          {moneyless ? (
            <Callout tone="info" size="sm">
              {t("registerOnly")}
            </Callout>
          ) : null}
          {review.state === "rejected" && review.rejectReason ? (
            <Card as="section" aria-labelledby="handover-rejected" data-testid="handover-rejected">
              <div className="flex flex-col gap-2">
                <h2 id="handover-rejected" className="text-base font-semibold">
                  {t("rejected.title")}
                </h2>
                <p className="m-0 whitespace-pre-line">{review.rejectReason}</p>
                <p className="text-muted m-0 text-sm">
                  {review.rejectedAt ? t("rejected.at", { date: formatDateTime(review.rejectedAt, locale) }) : null}
                </p>
              </div>
            </Card>
          ) : null}
          {review.formedOn ? (
            <Callout tone="success" size="sm" icon={IconCheckCircle}>
              {t("formedLine", {
                date: formatDate(review.formedOn, locale),
                number: review.registrationNo ?? t("panel.noNumber"),
              })}
            </Callout>
          ) : null}
          <HandoverProblems problems={review.problems} units={review.units} />
          {review.applied ? (
            <AppliedCard
              applied={review.applied}
              matches={appliedMatches(review)}
              acceptedAt={review.acceptedAt}
              locale={locale}
            />
          ) : null}
          <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
            <ReceivingBank
              bank={review.receivingBank}
              matched={matched}
              bankAccountsHref={
                ownerCan(me, "tenant.bank_account.manage") ? ownerPath(locale, "/settings/bank-accounts") : null
              }
            />
            <OwnerMatches create={review.partiesToCreate} attach={review.partiesToAttach} />
          </div>
          <section aria-labelledby="handover-units" className="flex flex-col gap-3" id="units">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <h2 id="handover-units" className="text-lg font-semibold">
                  {t("units.title")}
                </h2>
                <p className="text-muted m-0 text-sm">
                  {review.asOfDate
                    ? t("units.lede", { date: formatDate(review.asOfDate, locale) })
                    : t("units.ledeNoDate")}
                </p>
              </div>
              <FilterLinks
                label={t("units.filter")}
                current={filter}
                links={UNIT_FILTERS.filter((key) => key !== "problems" || review.problems.length > 0).map((key) => ({
                  key,
                  href: `${withQuery(base, { units: key })}#units`,
                  label: t(`units.show.${key}`),
                  testId: `handover-units-${key}`,
                }))}
              />
            </div>
            {shown.length === 0 ? (
              <EmptyState
                variant="card"
                icon={IconBuilding}
                title={t("units.empty")}
                action={
                  <a
                    className="text-primary font-medium underline-offset-4 hover:underline"
                    href={`${withQuery(base, { units: "all" })}#units`}
                  >
                    {t("units.showAll")}
                  </a>
                }
              />
            ) : (
              <SimpleTable
                caption={t("units.title")}
                testId="handover-units"
                stackOnPhones
                pinFirstColumn={false}
                minWidth="40rem"
                columns={[
                  { key: "unit", header: t("units.col.unit"), phone: "title" },
                  { key: "owners", header: t("units.col.owners"), phone: "wide" },
                  ...(moneyless
                    ? []
                    : [
                        {
                          key: "advance",
                          header: t("units.col.advance"),
                          align: "end" as const,
                          phone: "meta" as const,
                          phoneLabel: true,
                        },
                        {
                          key: "fund",
                          header: t("units.col.fund"),
                          align: "end" as const,
                          phone: "meta" as const,
                          phoneLabel: true,
                        },
                        {
                          key: "forward",
                          header: t("units.col.forward"),
                          align: "end" as const,
                          phone: "figure" as const,
                        },
                      ]),
                ]}
                rows={shown.map((unit) => {
                  const codes = problems.get(unit.unitRef) ?? [];
                  return {
                    key: unit.unitRef,
                    testId: "handover-unit",
                    tone: codes.length > 0 ? ("warning" as const) : undefined,
                    data: { unit: unit.unitNo, problems: codes.length },
                    cells: {
                      unit: (
                        <span className="flex flex-col gap-1">
                          <span className="font-mono font-medium">{unit.unitNo}</span>
                          {codes.map((code) => (
                            <Badge key={code} tone="warning" size="sm" icon={IconAlert}>
                              {t(`problems.short.${code}`)}
                            </Badge>
                          ))}
                        </span>
                      ),
                      owners:
                        unit.owners.length === 0 ? (
                          <span className="text-muted text-sm">{t("units.noOwner")}</span>
                        ) : (
                          <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-sm">
                            {unit.owners.map((owner) => (
                              <li key={owner.partyRef} className="flex items-center gap-2">
                                <Icon icon={IconResidents} size={14} className="text-subtle shrink-0" />
                                <span>{owner.displayName}</span>
                                {unit.owners.length > 1 ? (
                                  <span className="text-muted tabular-nums">
                                    {t("units.share", { share: owner.sharePct.replace(/\.?0+$/, "") })}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        ),
                      advance: (
                        <span className="flex flex-col items-end">
                          <span>{formatTHB(unit.advanceCommonFees, locale)}</span>
                          {unit.advancePeriodFrom && unit.advancePeriodTo ? (
                            <span className="text-muted text-xs whitespace-nowrap">
                              {t("units.period", {
                                from: formatDate(unit.advancePeriodFrom, locale, { style: "month" }),
                                to: formatDate(unit.advancePeriodTo, locale, { style: "month" }),
                              })}
                            </span>
                          ) : null}
                        </span>
                      ),
                      fund: formatTHB(unit.firstFundContribution, locale),
                      forward: isZeroDecimal(unit.receivablesBroughtForward) ? (
                        <span className="text-muted">{formatTHB(unit.receivablesBroughtForward, locale)}</span>
                      ) : (
                        <span className="flex flex-col items-end">
                          <span>{formatTHB(unit.receivablesBroughtForward, locale)}</span>
                          <span className="text-muted text-xs">
                            {t("units.items", { count: unit.receivableItems })}
                          </span>
                        </span>
                      ),
                    },
                  };
                })}
              />
            )}
            {units.length > UNITS_PER_PAGE ? (
              <ListPagination
                meta={{ page, perPage: UNITS_PER_PAGE, total: units.length }}
                path={base}
                searchParams={searchParams}
                locale={locale}
              />
            ) : null}
            <p className="text-muted m-0 flex items-start gap-2 text-sm" data-testid="handover-privacy">
              <Icon icon={IconInfo} size={16} className="text-subtle mt-0.5 shrink-0" />
              {t("privacy")}
            </p>
          </section>
        </div>
      </DetailLayout>
    </OwnerPage>
  );
}
