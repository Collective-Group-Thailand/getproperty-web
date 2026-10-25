import { getTranslations } from "next-intl/server";

import { section } from "@/features/shared/console/params";
import { SectionError } from "@/features/shared/console/SectionError";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { ApiClient } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { SimpleTable } from "@/ui/components/SimpleTable";

import { DocumentButton } from "../shared/DocumentButton";
import { AddRepairCost, DecideRepair, SettleRepair, VoidRepairCost } from "./RepairCostActions";

/**
 * Who fixes, who pays (landlords, D-263): the owner's decision and its history, the quotations and receipts, and
 * what is still to settle with the tenant — billed or credited on the next invoice only when the owner confirms.
 */
export async function RepairCosts({
  api,
  serviceRequestId,
  unitId,
  locale,
  today,
  canHandle,
}: {
  api: ApiClient;
  serviceRequestId: string;
  unitId: string | null;
  locale: Locale;
  today: string;
  canHandle: boolean;
}) {
  const t = await getTranslations("owner.service.costs");
  const loaded = await section(
    unwrap(api.GET("/v1/owner/service-requests/{serviceRequestId}/costs", { params: { path: { serviceRequestId } } })),
  );
  const money = (value: string) => formatTHB(value, locale);
  if (!loaded.data) {
    return (
      <Card as="section" aria-labelledby="repair-costs" data-testid="repair-costs">
        <CardHeader title={<span id="repair-costs">{t("title")}</span>} />
        <SectionError error={loaded.error} />
      </Card>
    );
  }
  const costs = loaded.data;
  const actions = new Set(canHandle ? costs.nextActions : []);
  const decision = costs.decision;
  const share = decision?.tenantSharePercent ? `${Number(decision.tenantSharePercent)}%` : "";
  return (
    <Card as="section" aria-labelledby="repair-costs" data-testid="repair-costs">
      <CardHeader
        title={<span id="repair-costs">{t("title")}</span>}
        description={t("description")}
        action={
          <span className="flex flex-wrap gap-2">
            {actions.has("decide") ? <DecideRepair serviceRequestId={serviceRequestId} decision={decision} /> : null}
            {actions.has("add-cost") ? (
              <AddRepairCost serviceRequestId={serviceRequestId} unitId={unitId} today={today} />
            ) : null}
          </span>
        }
      />
      {decision ? (
        <DescriptionList
          columns={2}
          items={[
            {
              id: "handled",
              term: t("handledBy"),
              description: <span data-testid="repair-handled">{t(`handler.${decision.handledBy}`)}</span>,
            },
            {
              id: "bearer",
              term: t("costBearer"),
              description: (
                <span data-testid="repair-bearer">
                  {decision.costBearer === "shared" ? t("sharedValue", { share }) : t(`bearer.${decision.costBearer}`)}
                </span>
              ),
            },
          ]}
        />
      ) : (
        <div data-testid="repair-undecided">
          <Callout tone="info">{t("undecided")}</Callout>
        </div>
      )}

      {costs.costs.length ? (
        <SimpleTable
          className="mt-4"
          caption={t("costsCaption")}
          testId="repair-cost-table"
          minWidth="44rem"
          columns={[
            { key: "date", header: t("col.date") },
            { key: "what", header: t("col.what") },
            { key: "payer", header: t("col.payer") },
            { key: "amount", header: t("col.amount"), align: "end" },
            { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
          ]}
          rows={costs.costs.map((cost) => ({
            key: cost.id,
            testId: "repair-cost",
            data: { kind: cost.kind, voided: cost.voidedAt ? "true" : "false" },
            cells: {
              date: formatDate(cost.issuedOn, locale),
              what: (
                <span className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={cost.kind === "receipt" ? "success" : "neutral"} size="sm">
                      {t(`kinds.${cost.kind}`)}
                    </Badge>
                    <span className={cost.voidedAt ? "text-muted line-through" : undefined}>{cost.description}</span>
                  </span>
                  {cost.vendorName ? <span className="text-muted text-xs">{cost.vendorName}</span> : null}
                  {cost.voidedAt ? (
                    <span className="text-muted text-xs">{t("voidedBecause", { reason: cost.voidReason ?? "" })}</span>
                  ) : null}
                </span>
              ),
              payer: cost.paidBy ? t(`payer.${cost.paidBy}`) : "—",
              amount: <span className="tabular-nums">{money(cost.amount)}</span>,
              actions: (
                <span className="flex flex-wrap justify-end gap-2">
                  {cost.documentId ? (
                    <DocumentButton
                      document={{ kind: "file", id: cost.documentId }}
                      label={t("openFile")}
                      title={cost.description}
                    />
                  ) : null}
                  {canHandle && !cost.voidedAt ? (
                    <VoidRepairCost serviceRequestId={serviceRequestId} costId={cost.id} />
                  ) : null}
                </span>
              ),
            },
          }))}
        />
      ) : (
        <p className="text-muted mt-4 text-sm">{t("noCosts")}</p>
      )}

      {costs.settlement.receiptsTotal !== "0.00" || costs.settlements.length ? (
        <div className="border-border mt-4 border-t pt-4" data-testid="repair-settlement">
          <DescriptionList
            columns={3}
            items={[
              { id: "total", term: t("receiptsTotal"), description: money(costs.settlement.receiptsTotal) },
              { id: "owner", term: t("ownerShare"), description: money(costs.settlement.ownerShare) },
              { id: "tenant", term: t("tenantShare"), description: money(costs.settlement.tenantShare) },
              { id: "paidByTenant", term: t("paidByTenant"), description: money(costs.settlement.paidByTenant) },
              { id: "settled", term: t("settledSoFar"), description: money(costs.settlement.settled) },
              {
                id: "due",
                term: t("due"),
                description: <span data-testid="repair-due">{money(costs.settlement.due)}</span>,
              },
            ]}
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {actions.has("settle") ? (
              <SettleRepair serviceRequestId={serviceRequestId} due={costs.settlement.due} />
            ) : null}
            {costs.settlements.map((s) => (
              <span key={s.id} className="text-muted text-sm" data-testid="repair-settled-row">
                {s.amount.startsWith("-")
                  ? t("creditedOn", { amount: money(s.amount.slice(1)), at: formatDateTime(s.settledAt, locale) })
                  : t("billedOn", { amount: money(s.amount), at: formatDateTime(s.settledAt, locale) })}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {costs.decisions.length > 1 ? (
        <details className="mt-4 text-sm">
          <summary className="text-muted cursor-pointer">{t("history", { count: costs.decisions.length })}</summary>
          <ul className="mt-2 flex flex-col gap-1">
            {costs.decisions.map((d) => (
              <li key={d.id} className="text-muted">
                {t("historyRow", {
                  at: formatDateTime(d.decidedAt, locale),
                  handled: t(`handler.${d.handledBy}`),
                  bearer:
                    d.costBearer === "shared"
                      ? t("sharedValue", { share: `${Number(d.tenantSharePercent)}%` })
                      : t(`bearer.${d.costBearer}`),
                })}
                {d.note ? ` — ${d.note}` : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}
