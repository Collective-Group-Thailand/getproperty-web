import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { COLLECTION_CASE_STATUS, INVOICE_STATUS } from "@/domain/status";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { ActionPanel, DetailLayout } from "@/ui/components/DetailLayout";
import { GroupedTimeline } from "@/ui/components/GroupedTimeline";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { Icon } from "@/ui/icons";
import { IconCalendar } from "@/ui/icons/glyphs/calendar";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconLock } from "@/ui/icons/glyphs/lock";
import { IconPause } from "@/ui/icons/glyphs/pause";

import { ownerPath, withQuery } from "../../shared/links";
import { ownerCan, readOnly, section, type OwnerContext } from "../../shared/server";
import { ApproveStepButton, CloseDisputeButton, OpenDisputeButton, RefuseStepButton } from "./CaseActions";
import { ChannelIcons } from "./parts";
import { ProposePlanButton } from "./PlanActions";
import { contextParts } from "./receivables";
import { eventLook, pinnedStep, timelineGroups } from "./timeline";
import { gateReasonKey } from "./ladder";

const OPEN_INVOICES: Schemas["InvoiceStatus"][] = ["overdue", "partially_paid", "issued"];

/**
 * A collection case (JW1b, J-DESIGN §4): who owes what on which unit, the collection timeline with the next step pinned
 * on the pale tint, the open bills, and the panel — approve or refuse a waiting step, open or close a dispute, propose
 * a plan, record a payment. Every event is the API's append-only evidence; the panel follows the API's `nextActions`.
 */
export async function CaseView({ context, caseId }: { context: OwnerContext; caseId: string }) {
  const t = await getTranslations("owner.collections");
  const { api, locale, me } = context;
  let found: Schemas["CollectionCaseDto"];
  try {
    found = await unwrap(api.GET("/v1/owner/juristic/collection-cases/{caseId}", { params: { path: { caseId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [rows, invoices, statements, settings] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/juristic/receivables", { params: { query: { q: found.unitNo, perPage: 50 } } }))),
    section(
      unwrap(
        api.GET("/v1/owner/invoices", {
          params: { query: { unitId: found.unitId, partyId: found.partyId, perPage: 50 } },
        }),
      ),
    ),
    section(
      unwrap(api.GET("/v1/owner/juristic/statements", { params: { query: { partyId: found.partyId, perPage: 1 } } })),
    ),
    section(unwrap(api.GET("/v1/owner/settings", { params: { query: {} } }))),
  ]);
  const row = rows.data?.data.find((candidate) => candidate.caseId === found.id) ?? null;
  const open = (invoices.data?.data ?? []).filter((invoice) => OPEN_INVOICES.includes(invoice.status));
  const latestStatement = statements.data?.data[0] ?? null;
  const writable = !readOnly(me);
  const canManage = writable && ownerCan(me, "juristic.collections.manage");
  const canApprove = writable && ownerCan(me, "juristic.collections.approve");
  const next = new Set(found.nextActions);
  const money = (value: string) => formatTHB(value, locale);
  const step = pinnedStep(found);
  const stepName = step ? t(`action.${step.action}`) : "";
  const maxInstalments = settings.data?.find((setting) => setting.key === "juristic.plan_max_instalments")?.value;

  const pinned = step ? (
    <div className="flex items-start gap-3">
      <span className="text-primary-subtle-fg mt-0.5">
        <Icon
          icon={
            found.state === "paused"
              ? IconPause
              : step.legalReviewRequired
                ? IconLock
                : step.awaitingApproval
                  ? IconClock
                  : IconCalendar
          }
        />
      </span>
      <div className="text-primary-subtle-fg flex min-w-0 flex-col gap-0.5">
        <span className="font-medium" data-testid="case-next-step">
          {t("case.nextStep", { step: stepName, date: formatDate(step.dueOn, locale, { style: "long" }) })}
        </span>
        <span className="text-sm">
          {found.state === "paused"
            ? found.disputeOpenedAt
              ? t("case.heldByDispute")
              : t("case.heldByPlan")
            : step.legalReviewRequired
              ? t("case.heldByCounsel")
              : step.awaitingApproval
                ? t("case.heldByApproval")
                : t("case.willRun")}
        </span>
      </div>
    </div>
  ) : null;

  const groups = timelineGroups(found.timeline).map((group) => ({
    key: group.month,
    label: formatDate(`${group.month}-01`, locale, { style: "month" }),
    events: group.events.map((event) => {
      const look = eventLook(event);
      const gate = gateReasonKey(event.reason);
      const detail =
        event.kind === "step"
          ? [
              event.outcome ? t(`outcome.${event.outcome}`) : null,
              event.amount ? money(event.amount) : null,
              event.outcome === "skipped" && gate ? t(`gate.${gate}`) : null,
              event.outcome === "refused" && event.reason ? event.reason : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : event.reason && event.reason !== "payment_plan"
            ? event.reason
            : event.reason === "payment_plan"
              ? t("case.pausedForPlan")
              : null;
      return {
        id: event.id,
        title: t(look.title as "event.opened"),
        time: formatDate(event.occurredAt, locale, { style: "dayMonth" }),
        timeTitle: formatDate(event.occurredAt, locale, { style: "long" }),
        description: detail || undefined,
        icon: look.icon,
        tone: look.tone,
      };
    }),
  }));

  const candidates = row
    ? [
        {
          partyId: row.partyId,
          unitId: row.unitId,
          unitNo: row.unitNo,
          ownerName: row.ownerName,
          outstanding: row.outstanding,
        },
      ]
    : [];
  const disputeOpen = Boolean(found.disputeOpenedAt);
  const primaryKind =
    canApprove && step?.awaitingApproval && next.has("approve_step")
      ? "approve"
      : canManage && disputeOpen && next.has("close_dispute")
        ? "close"
        : canManage && !found.planId && found.state !== "resolved" && candidates.length
          ? "plan"
          : null;
  const primary =
    primaryKind === "approve" ? (
      <ApproveStepButton collectionCase={found} stepName={stepName} />
    ) : primaryKind === "close" ? (
      <CloseDisputeButton collectionCase={found} block />
    ) : primaryKind === "plan" ? (
      <ProposePlanButton
        candidates={candidates}
        maxInstalments={typeof maxInstalments === "number" ? maxInstalments : null}
        variant="primary"
      />
    ) : undefined;

  return (
    <OwnerPage testId="juristic-case">
      <PageHeader
        title={t("case.title", { unit: found.unitNo, owner: found.partyName })}
        status={<StatusBadgeOf map={COLLECTION_CASE_STATUS} value={found.state} />}
        description={[
          ...(row
            ? contextParts(row.context).map((part) => t(`receivables.context.${part.key}`, { count: part.count ?? 0 }))
            : []),
          t("case.lede", { ladder: t(`legalForm.${found.legalForm}`), date: formatDate(found.openedAt, locale) }),
        ].join(" · ")}
        back={{ label: t("receivables.title"), href: ownerPath(locale, "/juristic/receivables") }}
      />
      <DetailLayout
        panel={
          <ActionPanel
            testId="case-panel"
            summary={
              <div className="flex flex-col gap-1">
                <span className="text-muted text-sm">{t("case.outstanding")}</span>
                <span className="text-2xl font-semibold tracking-tight tabular-nums" data-testid="case-outstanding">
                  {row ? money(row.outstanding) : "—"}
                </span>
                {row && row.oldestOverdueOn ? (
                  <span className="text-muted text-sm">
                    {t("case.overdueSince", {
                      months: formatNumber(row.oldestOverdueMonths, locale),
                      date: formatDate(row.oldestOverdueOn, locale),
                    })}
                  </span>
                ) : null}
              </div>
            }
            title={t("case.panelTitle")}
            status={<StatusBadgeOf map={COLLECTION_CASE_STATUS} value={found.state} size="sm" />}
            description={
              disputeOpen
                ? t("case.panelDispute")
                : step?.awaitingApproval
                  ? t("case.panelApproval")
                  : found.planId
                    ? t("case.panelPlan")
                    : found.state === "resolved"
                      ? t("case.panelResolved")
                      : t("case.panelOpen")
            }
            facts={[
              ...(row ? [{ key: "surcharge", label: t("case.surcharge"), value: money(row.surcharge) }] : []),
              { key: "anchor", label: t("case.anchor"), value: formatDate(found.anchorOn, locale) },
              ...(found.pausedDays
                ? [{ key: "paused", label: t("case.pausedDays"), value: t("case.days", { count: found.pausedDays }) }]
                : []),
              ...(row
                ? [
                    {
                      key: "channels",
                      label: t("case.channels"),
                      value: <ChannelIcons channels={row.channels} className="justify-end" />,
                    },
                  ]
                : []),
            ]}
            primary={primary}
            destructive={
              canApprove && step?.awaitingApproval && next.has("refuse_step") ? (
                <RefuseStepButton collectionCase={found} stepName={stepName} />
              ) : undefined
            }
            secondary={
              <>
                {canManage && !disputeOpen && next.has("open_dispute") ? (
                  <OpenDisputeButton collectionCase={found} block />
                ) : null}
                {canManage && disputeOpen && primaryKind !== "close" && next.has("close_dispute") ? (
                  <CloseDisputeButton collectionCase={found} block />
                ) : null}
                {found.planId ? (
                  <Button asChild variant="secondary" block>
                    <a href={ownerPath(locale, `/juristic/plans/${found.planId}`)} data-testid="case-plan-link">
                      {t("case.openPlan")}
                    </a>
                  </Button>
                ) : null}
                {latestStatement ? (
                  <Button asChild variant="secondary" block>
                    <a
                      href={ownerPath(locale, `/juristic/statements/${latestStatement.id}`)}
                      data-testid="case-statement-link"
                    >
                      {t("case.openStatement", { number: latestStatement.number })}
                    </a>
                  </Button>
                ) : null}
                {writable && ownerCan(me, "payment.record") ? (
                  <Button asChild variant="secondary" block>
                    <a href={withQuery(ownerPath(locale, "/payments/new"), { party: found.partyId })}>
                      {t("case.recordPayment")}
                    </a>
                  </Button>
                ) : null}
              </>
            }
          />
        }
      >
        <Card as="section" aria-labelledby="timeline-title" className="flex flex-col gap-5" data-testid="case-timeline">
          <CardHeader
            title={<span id="timeline-title">{t("case.timeline")}</span>}
            description={t("case.timelineHint")}
          />
          <GroupedTimeline
            pinned={pinned}
            groups={groups}
            empty={<p className="text-muted m-0 text-sm">{t("case.noEvents")}</p>}
          />
        </Card>

        <Card as="section" aria-labelledby="bills-title" className="flex flex-col gap-4" data-testid="case-bills">
          <CardHeader title={<span id="bills-title">{t("case.bills")}</span>} description={t("case.billsHint")} />
          {open.length === 0 ? (
            <p className="text-muted m-0 text-sm">{t("case.noBills")}</p>
          ) : (
            <SimpleTable
              caption={t("case.bills")}
              stackOnPhones
              minWidth="36rem"
              columns={[
                { key: "number", header: t("case.billNumber"), phone: "title" },
                { key: "period", header: t("case.billPeriod") },
                { key: "due", header: t("case.billDue") },
                { key: "status", header: t("case.billStatus"), phone: "status" },
                { key: "balance", header: t("case.billBalance"), align: "end", phone: "figure" },
              ]}
              rows={open.map((invoice) => ({
                key: invoice.id,
                href: ownerPath(locale, `/invoices/${invoice.id}`),
                cells: {
                  number: <span className="font-mono whitespace-nowrap">{invoice.number ?? "—"}</span>,
                  period: `${formatDate(invoice.periodStart, locale, { style: "dayMonth" })} – ${formatDate(invoice.periodEnd, locale)}`,
                  due: invoice.dueDate ? (
                    <span className="whitespace-nowrap">{formatDate(invoice.dueDate, locale)}</span>
                  ) : (
                    "—"
                  ),
                  status: <StatusBadgeOf map={INVOICE_STATUS} value={invoice.status} size="sm" />,
                  balance: money(invoice.balance),
                },
              }))}
            />
          )}
        </Card>
      </DetailLayout>
    </OwnerPage>
  );
}
