import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { DEPOSIT_STATUS } from "@/domain/status/deposit";
import { SETTLEMENT_STATUS } from "@/domain/status/settlement";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatDateTime, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Callout } from "@/ui/components/Callout";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { IconClock } from "@/ui/icons/glyphs/clock";

import { DocumentButton } from "../shared/DocumentButton";
import { ownerPath } from "../shared/links";
import { OwnerPage, PageHeader } from "@/features/shared/console/PageHeader";
import { PhotoThumb } from "../shared/PhotoThumb";
import { section, type OwnerContext } from "../shared/server";
import { daysUntil } from "./DepositsView";
import { AddDeductionButton, RemoveDeductionButton, SettlementActions } from "./SettlementActions";

const CONDITION_TONE: Record<Schemas["ItemCondition"], "success" | "neutral" | "warning" | "danger"> = {
  good: "success",
  fair: "neutral",
  damaged: "danger",
  missing: "danger",
  not_applicable: "neutral",
};

/**
 * One deposit and its settlement workspace (F2 2.2, D-023): amounts held, the refund deadline counted
 * down, the move-in / move-out inspection comparison side by side with photos, deductions with their
 * evidence, the figures the API computed (never added up here), the resident's answer, and the next
 * step the API offers. Receipt and statement PDFs open in the viewer.
 */
export async function DepositDetail({ context, depositId }: { context: OwnerContext; depositId: string }) {
  const t = await getTranslations("owner.deposits.detail");
  const deductionT = await getTranslations("owner.deposits.deduction");
  const methods = await getTranslations("owner.deposits.method");
  const { api, locale } = context;
  let deposit: Schemas["DepositDto"];
  try {
    deposit = await unwrap(api.GET("/v1/owner/deposits/{depositId}", { params: { path: { depositId } } }));
  } catch (error) {
    if (isApiError(error) && error.status === 404) notFound();
    throw error;
  }
  const [lease, comparison] = await Promise.all([
    section(unwrap(api.GET("/v1/owner/leases/{leaseId}", { params: { path: { leaseId: deposit.leaseId } } }))),
    deposit.settlement
      ? section(
          unwrap(api.GET("/v1/owner/deposits/{depositId}/inspection-comparison", { params: { path: { depositId } } })),
        )
      : Promise.resolve({ data: null, error: null }),
  ]);
  const settlement = deposit.settlement;
  const unitId = lease.data?.unitId ?? null;
  const editable = settlement ? settlement.status === "opened" || settlement.status === "inspected" : false;
  const days = settlement && !settlement.refundedAt ? daysUntil(settlement.deadlineAt) : null;
  const lines = comparison.data?.lines ?? [];
  const itemOptions = lines
    .filter((line) => line.moveOut)
    .map((line) => ({
      id: line.moveOut!.inspectionItemId,
      label: [line.area, line.label].filter(Boolean).join(" · "),
    }));

  return (
    <OwnerPage testId="deposit-detail">
      <PageHeader
        title={t("title", { unit: deposit.unitNo })}
        testId="deposit-title"
        description={[deposit.lesseeName, deposit.leaseNumber].filter(Boolean).join(" · ") || undefined}
        crumbs={[{ label: deposit.unitNo }]}
        status={
          <span className="flex gap-2">
            <StatusBadgeOf map={DEPOSIT_STATUS} value={deposit.status} />
            {settlement ? <StatusBadgeOf map={SETTLEMENT_STATUS} value={settlement.status} /> : null}
          </span>
        }
        actions={<SettlementActions deposit={deposit} unitId={unitId} />}
      />

      {settlement?.isLate ? (
        <Callout tone="danger" title={t("lateTitle")}>
          {t("lateBody", { date: formatDate(settlement.deadlineAt, locale) })}
        </Callout>
      ) : null}
      {settlement?.residentResponse === "disputed" ? (
        <Callout tone="warning" title={t("disputedTitle")}>
          <span data-testid="dispute-reason">{settlement.disputeReason ?? "—"}</span>
          {settlement.disputeDocumentIds.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-2" aria-label={t("disputePhotos")} data-testid="dispute-photos">
              {settlement.disputeDocumentIds.map((documentId, index) => (
                <li key={documentId}>
                  <PhotoThumb
                    fileId={documentId}
                    alt={t("disputePhoto", { number: index + 1 })}
                    purpose="deposit_settlement"
                    size="sm"
                  />
                </li>
              ))}
            </ul>
          ) : null}
        </Callout>
      ) : null}
      {settlement?.residentResponse === "accepted" ? (
        <Callout tone="success" title={t("acceptedTitle")}>
          {t("acceptedBody")}
        </Callout>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card as="section" aria-labelledby="deposit-amounts" data-testid="deposit-amounts">
          <CardHeader
            title={<span id="deposit-amounts">{t("amounts")}</span>}
            action={
              days !== null ? (
                <span data-testid="deposit-countdown">
                  <Badge
                    tone={settlement?.isLate || days < 0 ? "danger" : days <= 2 ? "warning" : "neutral"}
                    icon={IconClock}
                  >
                    {days < 0 ? t("overdueBy", { days: -days }) : t("daysLeft", { days })}
                  </Badge>
                </span>
              ) : null
            }
          />
          <DescriptionList
            items={[
              { id: "security", term: t("security"), description: formatTHB(deposit.amountSecurity, locale) },
              { id: "advance", term: t("advance"), description: formatTHB(deposit.amountAdvanceRent, locale) },
              {
                id: "received",
                term: t("received"),
                description: deposit.receivedAt ? formatDateTime(deposit.receivedAt, locale) : null,
              },
              { id: "receipt", term: t("receiptNumber"), description: deposit.receiptNumber },
              ...(settlement
                ? [
                    { id: "moveOut", term: t("moveOut"), description: formatDateTime(settlement.moveOutAt, locale) },
                    { id: "deadline", term: t("deadline"), description: formatDateTime(settlement.deadlineAt, locale) },
                    { id: "held", term: t("held"), description: formatTHB(settlement.depositHeld, locale) },
                    {
                      id: "unused",
                      term: t("advanceUnused"),
                      description: formatTHB(settlement.advanceRentUnused, locale),
                    },
                    {
                      id: "deductions",
                      term: t("deductionsTotal"),
                      description: (
                        <span data-testid="deductions-total">{formatTHB(settlement.deductionsTotal, locale)}</span>
                      ),
                    },
                    {
                      id: "utilities",
                      term: t("utilitiesFinal"),
                      description: formatTHB(settlement.utilitiesFinal, locale),
                    },
                    {
                      id: "proposed",
                      term: t("proposedRefund"),
                      description: settlement.proposedRefund ? (
                        <span data-testid="proposed-refund">{formatTHB(settlement.proposedRefund, locale)}</span>
                      ) : null,
                    },
                    {
                      id: "agreed",
                      term: t("agreedRefund"),
                      description: settlement.agreedRefund ? formatTHB(settlement.agreedRefund, locale) : null,
                    },
                    {
                      id: "refund",
                      term: t("refunded"),
                      description:
                        settlement.refundAmount && settlement.refundedAt ? (
                          <span data-testid="refunded">
                            {t("refundedOn", {
                              amount: formatTHB(settlement.refundAmount, locale),
                              date: formatDateTime(settlement.refundedAt, locale),
                              method: settlement.refundMethod ? methods(settlement.refundMethod) : "",
                            })}
                          </span>
                        ) : null,
                    },
                  ]
                : []),
            ]}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {deposit.receiptNumber ? (
              <DocumentButton
                document={{ kind: "depositReceipt", id: deposit.id }}
                label={t("receiptPdf")}
                title={t("receiptTitle", { number: deposit.receiptNumber })}
              />
            ) : null}
            {settlement?.statementNumber ? (
              <DocumentButton
                document={{ kind: "depositStatement", id: deposit.id }}
                label={t("statementPdf")}
                title={t("statementTitle", { number: settlement.statementNumber })}
                testId="statement-pdf"
              />
            ) : null}
            {lease.data ? (
              <a
                className="text-sm underline-offset-4 hover:underline"
                href={ownerPath(locale, `/leases/${lease.data.id}`)}
              >
                {t("openLease")}
              </a>
            ) : null}
          </div>
        </Card>

        {settlement ? (
          <Card as="section" aria-labelledby="deposit-deductions" data-testid="deposit-deductions">
            <CardHeader
              title={<span id="deposit-deductions">{t("deductions")}</span>}
              description={t("deductionsHint")}
              action={editable ? <AddDeductionButton deposit={deposit} unitId={unitId} items={itemOptions} /> : null}
            />
            {settlement.items.length ? (
              <ul className="flex flex-col gap-3">
                {settlement.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-control border-border flex flex-col gap-2 border p-3"
                    data-testid="deduction"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{item.description}</span>
                      <span className="tabular-nums">{formatTHB(item.amount, locale)}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone="neutral" size="sm">
                        {deductionT(`kinds.${item.kind}`)}
                      </Badge>
                      {item.residentAccepted === true ? (
                        <Badge tone="success" size="sm">
                          {t("residentAccepted")}
                        </Badge>
                      ) : item.residentAccepted === false ? (
                        <Badge tone="danger" size="sm">
                          {t("residentDisputed")}
                        </Badge>
                      ) : null}
                      {item.evidenceDocumentIds.map((fileId, index) => (
                        <PhotoThumb
                          key={fileId}
                          fileId={fileId}
                          alt={t("evidenceAlt", { index: index + 1, description: item.description })}
                          size="sm"
                        />
                      ))}
                      {editable ? <RemoveDeductionButton deposit={deposit} item={item} /> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted text-sm">{t("noDeductions")}</p>
            )}
          </Card>
        ) : null}
      </div>

      {settlement ? (
        <Card as="section" aria-labelledby="deposit-comparison" data-testid="inspection-comparison">
          <CardHeader
            title={<span id="deposit-comparison">{t("comparison")}</span>}
            description={t("comparisonHint")}
          />
          {lines.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">{t("comparison")}</caption>
                <thead>
                  <tr className="border-border border-b text-start">
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("item")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("moveIn")}
                    </th>
                    <th scope="col" className="py-2 text-start font-medium">
                      {t("moveOutSide")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr
                      key={line.itemKey}
                      className="border-border border-b align-top"
                      data-testid="comparison-line"
                      data-changed={line.changed ? "true" : undefined}
                    >
                      <th scope="row" className="py-2 pe-3 text-start font-normal">
                        <span className="flex flex-col">
                          <span className="font-medium">{line.label}</span>
                          {line.area ? <span className="text-muted text-xs">{line.area}</span> : null}
                          {line.changed ? (
                            <Badge tone="warning" size="sm" className="mt-1 self-start">
                              {t("changed")}
                            </Badge>
                          ) : null}
                        </span>
                      </th>
                      {[line.moveIn, line.moveOut].map((side, index) => (
                        <td key={index} className="py-2 pe-3">
                          {side ? (
                            <span className="flex flex-col gap-1">
                              {side.condition ? (
                                <Badge tone={CONDITION_TONE[side.condition]} size="sm" className="self-start">
                                  {t(`condition.${side.condition}`)}
                                </Badge>
                              ) : null}
                              {side.meterRegister ? <span className="font-mono">{side.meterRegister}</span> : null}
                              {side.notes ? <span className="text-muted">{side.notes}</span> : null}
                              <span className="flex flex-wrap gap-1">
                                {side.photoDocumentIds.map((fileId, photo) => (
                                  <PhotoThumb
                                    key={fileId}
                                    fileId={fileId}
                                    alt={t("photoAlt", { item: line.label, index: photo + 1 })}
                                    size="sm"
                                  />
                                ))}
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted">{t("notInspected")}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted text-sm">{t("noComparison")}</p>
          )}
        </Card>
      ) : null}
    </OwnerPage>
  );
}
