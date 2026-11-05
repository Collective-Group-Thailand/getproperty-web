import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { PAYMENT_PLAN_STATUS, PLAN_INSTALMENT_STATUS } from "@/domain/status";
import { FilterBar } from "@/features/shared/console/FilterBar";
import { ListPagination } from "@/features/shared/console/ListPagination";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { SectionError } from "@/features/shared/console/SectionError";
import { enumParam } from "@/features/shared/console/params";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { EmptyState } from "@/ui/components/EmptyState";
import { LinkTabs } from "@/ui/components/LinkTabs";
import { ListToolbar } from "@/ui/components/ListToolbar";
import { RowList } from "@/ui/components/RowList";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { IconRepeat } from "@/ui/icons/glyphs/repeat";

import { ownerPath, withQuery } from "../../shared/links";
import { ownerCan, pageParam, param, readOnly, section, type OwnerContext } from "../../shared/server";
import { ApprovePlanButton, CancelPlanButton, ProposePlanButton, RejectPlanButton } from "./PlanActions";

type SearchParams = Record<string, string | string[] | undefined>;
const TABS = ["proposed", "active", "completed", "defaulted", "cancelled", "rejected"] as const;

async function planSettings(context: OwnerContext) {
  const settings = await section(unwrap(context.api.GET("/v1/owner/settings", { params: { query: {} } })));
  const value = settings.data?.find((setting) => setting.key === "juristic.plan_max_instalments")?.value;
  return typeof value === "number" ? value : null;
}

/**
 * Payment plans (JW1b, D-308): proposals waiting for the committee first, then the plans running, then the ended ones.
 * A plan moves an owner's open bills onto monthly instalments; the API computes the principal and the split.
 */
export async function PlansView({ context, searchParams }: { context: OwnerContext; searchParams: SearchParams }) {
  const t = await getTranslations("owner.collections.plans");
  const { api, locale, me } = context;
  const state = enumParam(searchParams.state, TABS);
  const q = param(searchParams.q);
  const page = pageParam(searchParams.page);
  const base = ownerPath(locale, "/juristic/plans");
  const canManage = !readOnly(me) && ownerCan(me, "juristic.collections.manage");
  const count = (value: (typeof TABS)[number]) =>
    section(
      unwrap(api.GET("/v1/owner/juristic/payment-plans", { params: { query: { state: value, perPage: 1 } } })).then(
        (result) => result.meta.total,
      ),
    );
  const [list, proposed, active, receivables, maxInstalments] = await Promise.all([
    section(
      unwrap(
        api.GET("/v1/owner/juristic/payment-plans", {
          params: { query: { page, perPage: 25, ...(state ? { state } : {}), ...(q ? { q } : {}) } },
        }),
      ),
    ),
    count("proposed"),
    count("active"),
    canManage
      ? section(unwrap(api.GET("/v1/owner/juristic/receivables", { params: { query: { perPage: 100 } } })))
      : Promise.resolve(null),
    planSettings(context),
  ]);
  const candidates = (receivables?.data?.data ?? [])
    .filter((row) => !row.planId && !row.disputeOpen)
    .map((row) => ({
      partyId: row.partyId,
      unitId: row.unitId,
      unitNo: row.unitNo,
      ownerName: row.ownerName,
      outstanding: row.outstanding,
    }));
  const tabHref = (value: string | undefined) => withQuery(base, { state: value, q });
  const rows = list.data?.data ?? [];

  return (
    <OwnerPage testId="juristic-plans">
      <PageHeader
        title={t("title")}
        description={t("lede")}
        actions={
          canManage ? (
            <ProposePlanButton
              candidates={candidates}
              maxInstalments={maxInstalments}
              variant="primary"
              defaultOpen={param(searchParams.new) === "1"}
            />
          ) : undefined
        }
      />
      <ListToolbar
        tabs={
          <LinkTabs
            label={t("show")}
            current={tabHref(state)}
            tabs={[
              { href: tabHref(undefined), label: t("tab.all"), testId: "plans-tab-all" },
              {
                href: tabHref("proposed"),
                label: t("tab.proposed"),
                count: proposed.data ?? undefined,
                testId: "plans-tab-proposed",
              },
              {
                href: tabHref("active"),
                label: t("tab.active"),
                count: active.data ?? undefined,
                testId: "plans-tab-active",
              },
              { href: tabHref("completed"), label: t("tab.completed"), testId: "plans-tab-completed" },
              { href: tabHref("defaulted"), label: t("tab.defaulted"), testId: "plans-tab-defaulted" },
            ]}
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
      ) : (
        <RowList
          label={t("title")}
          testId="plan-rows"
          empty={
            <EmptyState
              variant="card"
              icon={IconRepeat}
              title={state || q ? t("empty.filteredTitle") : t("empty.title")}
              description={state || q ? t("empty.filtered") : t("empty.body")}
              action={
                <Button asChild variant="secondary">
                  <a href={state || q ? base : ownerPath(locale, "/juristic/receivables")}>
                    {state || q ? t("empty.clear") : t("empty.receivables")}
                  </a>
                </Button>
              }
            />
          }
          items={rows.map((plan) => ({
            key: plan.id,
            href: ownerPath(locale, `/juristic/plans/${plan.id}`),
            lead: <span className="font-mono">{plan.unitNo}</span>,
            title: plan.partyName,
            meta: t("rowMeta", {
              count: plan.instalmentCount,
              paid: plan.instalments.filter((instalment) => instalment.state === "paid").length,
              first: formatDate(plan.firstDueOn, locale),
              by: t(`proposer.${plan.proposedBy}`),
            }),
            status: <StatusBadgeOf map={PAYMENT_PLAN_STATUS} value={plan.state} size="sm" />,
            figure: (
              <span className="font-semibold tabular-nums">
                {formatTHB(plan.principal ?? plan.proposedPrincipal, locale)}
              </span>
            ),
            testId: "plan-row",
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
 * One payment plan (D-308): the instalment table as the API split it (equal, the satang remainder on the last), what
 * the plan covers, and the decisions — approve (committee too, D-320), reject or cancel with a reason.
 */
export async function PlanView({ context, planId }: { context: OwnerContext; planId: string }) {
  const t = await getTranslations("owner.collections.plans");
  const { api, locale, me } = context;
  let plan: Schemas["PaymentPlanDto"];
  try {
    plan = await unwrap(api.GET("/v1/owner/juristic/payment-plans/{planId}", { params: { path: { planId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const writable = !readOnly(me);
  const next = new Set(plan.nextActions);
  const canApprove = writable && ownerCan(me, "juristic.payment_plan.approve");
  const canManage = writable && ownerCan(me, "juristic.collections.manage");
  const money = (value: string) => formatTHB(value, locale);
  const paid = plan.instalments.filter((instalment) => instalment.state === "paid").length;

  return (
    <OwnerPage testId="juristic-plan">
      <PageHeader
        title={t("recordTitle", { unit: plan.unitNo, owner: plan.partyName })}
        status={<StatusBadgeOf map={PAYMENT_PLAN_STATUS} value={plan.state} />}
        description={t("recordLede", { count: plan.instalmentCount, by: t(`proposer.${plan.proposedBy}`) })}
        back={{ label: t("title"), href: ownerPath(locale, "/juristic/plans") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="plan-panel"
            summary={
              <div className="flex flex-col gap-1">
                <span className="text-muted text-sm">{plan.principal ? t("principal") : t("proposedPrincipal")}</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums" data-testid="plan-principal">
                  {money(plan.principal ?? plan.proposedPrincipal)}
                </span>
                <span className="text-muted text-sm">
                  {t("progress", {
                    paid: formatNumber(paid, locale),
                    count: formatNumber(plan.instalmentCount, locale),
                  })}
                </span>
              </div>
            }
            title={t("panelTitle")}
            status={<StatusBadgeOf map={PAYMENT_PLAN_STATUS} value={plan.state} size="sm" />}
            description={t(`panel.${plan.state}`)}
            facts={[
              { key: "first", label: t("firstDue"), value: formatDate(plan.firstDueOn, locale) },
              ...(plan.defaultAfterDays
                ? [{ key: "default", label: t("defaultAfter"), value: t("days", { count: plan.defaultAfterDays }) }]
                : []),
              ...(plan.approvedAt
                ? [{ key: "approved", label: t("approvedAt"), value: formatDateTime(plan.approvedAt, locale) }]
                : []),
              { key: "created", label: t("createdAt"), value: formatDateTime(plan.createdAt, locale) },
            ]}
            primary={canApprove && next.has("approve") ? <ApprovePlanButton plan={plan} /> : undefined}
            secondary={
              <Button asChild variant="secondary" block>
                <a href={withQuery(ownerPath(locale, "/juristic/receivables"), { q: plan.unitNo })}>
                  {t("openReceivable")}
                </a>
              </Button>
            }
            destructive={
              canApprove && next.has("reject") ? (
                <RejectPlanButton plan={plan} />
              ) : canManage && next.has("cancel") ? (
                <CancelPlanButton plan={plan} />
              ) : undefined
            }
          />
        }
      >
        {plan.state === "defaulted" ? (
          <Callout tone="warning" title={t("defaultedTitle")}>
            {t("defaultedBody")}
          </Callout>
        ) : null}
        {plan.decidedReason ? (
          <Callout tone="neutral" title={t("decidedTitle")}>
            {plan.decidedReason}
          </Callout>
        ) : null}
        <Card
          as="section"
          aria-labelledby="instalments-title"
          className="flex flex-col gap-4"
          data-testid="plan-instalments"
        >
          <CardHeader
            title={<span id="instalments-title">{t("instalments")}</span>}
            description={plan.state === "proposed" ? t("instalmentsProposed") : t("instalmentsHint")}
          />
          <SimpleTable
            caption={t("instalments")}
            stackOnPhones
            minWidth="34rem"
            columns={[
              { key: "seq", header: t("seq"), phone: "title" },
              { key: "due", header: t("due") },
              { key: "state", header: t("state"), phone: "status" },
              { key: "paid", header: t("paidAt") },
              { key: "amount", header: t("amount"), align: "end", phone: "figure" },
            ]}
            rows={plan.instalments.map((instalment) => ({
              key: String(instalment.seq),
              testId: "plan-instalment",
              cells: {
                seq: t("seqValue", { seq: instalment.seq }),
                due: formatDate(instalment.dueOn, locale),
                state: <StatusBadgeOf map={PLAN_INSTALMENT_STATUS} value={instalment.state} size="sm" />,
                paid: instalment.paidAt ? formatDate(instalment.paidAt, locale) : "—",
                amount: money(instalment.amount),
              },
            }))}
            footer={{ seq: t("total"), amount: money(plan.principal ?? plan.proposedPrincipal) }}
          />
        </Card>
        <Card as="section" aria-labelledby="covers-title" className="flex flex-col gap-3">
          <CardHeader title={<span id="covers-title">{t("covers")}</span>} />
          <dl className="m-0 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted text-sm">{t("coveredInvoices")}</dt>
              <dd className="m-0 font-medium tabular-nums">{formatNumber(plan.invoiceIds.length, locale)}</dd>
            </div>
            <div>
              <dt className="text-muted text-sm">{t("creditNotes")}</dt>
              <dd className="m-0 font-medium tabular-nums">{formatNumber(plan.creditNoteIds.length, locale)}</dd>
            </div>
            {plan.note ? (
              <div className="sm:col-span-2">
                <dt className="text-muted text-sm">{t("note")}</dt>
                <dd className="m-0">{plan.note}</dd>
              </div>
            ) : null}
          </dl>
        </Card>
      </DetailLayout>
    </OwnerPage>
  );
}
