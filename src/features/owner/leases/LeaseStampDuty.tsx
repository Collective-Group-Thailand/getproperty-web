"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Card, CardHeader } from "@/ui/components/Card";
import { DescriptionList } from "@/ui/components/DescriptionList";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconClock } from "@/ui/icons/glyphs/clock";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";
import { IconUpload } from "@/ui/icons/glyphs/upload";

import { DocumentButton } from "../shared/DocumentButton";
import { uploadOwnerFile } from "../shared/upload";

type StampDuty = Schemas["StampDutyDto"];

/**
 * Stamp duty of a lease (B7.5, D-253, O-019): what the API computed (an estimate until the lease is sent for
 * signature), who pays it as agreed in the lease, the due date once both parties signed and the payment — recorded
 * by the owner with the Revenue Department receipt, or paid through e-Stamp when the API says it can (never decided
 * here). `today` is the Bangkok date of the page, for the overdue tone only.
 */
export function LeaseStampDuty({
  stampDuty,
  unitId,
  unitNo,
  today,
  canManage,
}: {
  stampDuty: StampDuty;
  unitId: string;
  unitNo: string;
  today: string;
  canManage: boolean;
}) {
  const t = useTranslations("owner.leases.detail.stampDuty");
  const payers = useTranslations("owner.leases.wizard.payer");
  const locale = useLocale() as Locale;
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const { paid } = stampDuty;
  const overdue = !paid && stampDuty.dueDate !== null && stampDuty.dueDate < today;
  const amount = formatTHB(stampDuty.amount, locale);
  const params = (key: string) => ({
    path: { leaseId: stampDuty.leaseId },
    header: { "Idempotency-Key": key },
  });

  return (
    <Card as="section" aria-labelledby="lease-stamp-duty" data-testid="lease-stamp-duty">
      <CardHeader title={<span id="lease-stamp-duty">{t("title")}</span>} description={t("description")} />
      <DescriptionList
        items={[
          {
            id: "amount",
            term: t("amount"),
            description: (
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular-nums" data-testid="stamp-duty-amount">
                  {amount}
                </span>
                {stampDuty.fixed ? null : (
                  <span title={t("estimateHint")}>
                    <Badge tone="neutral" size="sm">
                      {t("estimate")}
                    </Badge>
                  </span>
                )}
              </span>
            ),
          },
          { id: "payer", term: t("payer"), description: payers(stampDuty.payer) },
          {
            id: "due",
            term: t("due"),
            description: stampDuty.dueDate ? formatDate(stampDuty.dueDate, locale) : t("dueAfterSigning"),
          },
          {
            id: "status",
            term: t("status"),
            description: paid ? (
              <span className="flex flex-col gap-1" data-testid="stamp-duty-paid">
                <Badge tone="success" size="sm" icon={IconCheckCircle}>
                  {t("paid", { date: formatDate(paid.paidAt, locale) })}
                </Badge>
                <span className="text-muted text-sm">
                  {[t(`paidVia.${paid.channel}`), paid.reference ? `${t("reference")} ${paid.reference}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
            ) : (
              <span data-testid="stamp-duty-unpaid">
                <Badge tone={overdue ? "warning" : "neutral"} size="sm" icon={IconClock}>
                  {overdue ? t("overdue") : t("unpaid")}
                </Badge>
              </span>
            ),
          },
        ]}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {paid?.documentId ? (
          <DocumentButton
            document={{ kind: "file", id: paid.documentId }}
            label={t("receipt")}
            title={t("receiptTitle", { unit: unitNo })}
            testId="stamp-duty-receipt"
          />
        ) : null}
        {canManage && !paid && stampDuty.eStampAvailable ? (
          <ConfirmAction
            label={t("payOnline")}
            icon={IconReceipt}
            size="sm"
            testId="stamp-duty-pay-online"
            title={t("payOnlineTitle", { amount })}
            description={t("payOnlineBody")}
            confirmLabel={t("payOnline")}
            successMessage={t("payOnlineDone")}
            onConfirm={(key) =>
              unwrap(
                browserApi().POST("/v1/owner/leases/{leaseId}/stamp-duty/actions/pay-online", { params: params(key) }),
              )
            }
          />
        ) : null}
        {canManage && !paid && stampDuty.fixed ? (
          <FormDialog
            label={t("record")}
            icon={IconReceipt}
            size="sm"
            variant={stampDuty.eStampAvailable ? "ghost" : "secondary"}
            testId="stamp-duty-record"
            title={t("recordTitle")}
            description={t("recordBody")}
            submitLabel={t("record")}
            successMessage={t("recorded")}
            onSubmit={async (data, _acks, key) => {
              const receipt = file
                ? await uploadOwnerFile(file, { kind: "other", scopeType: "unit", scopeId: unitId })
                : null;
              return unwrap(
                browserApi().POST("/v1/owner/leases/{leaseId}/stamp-duty", {
                  params: params(key),
                  body: {
                    reference: text(data, "reference") ?? null,
                    paidOn: text(data, "paidOn") ?? undefined,
                    documentId: receipt?.id ?? null,
                  },
                }),
              );
            }}
          >
            {(errors) => (
              <>
                <Field label={t("paidOn")} error={errors.paidOn}>
                  <Input name="paidOn" type="date" max={today} defaultValue={today} data-testid="stamp-duty-paid-on" />
                </Field>
                <Field label={t("reference")} hint={t("referenceHint")} error={errors.reference}>
                  <Input name="reference" maxLength={100} data-testid="stamp-duty-reference" />
                </Field>
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">{t("receiptFile")}</span>
                  <p className="text-muted text-sm">{t("receiptFileHint")}</p>
                  <input
                    ref={input}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png"
                    className="sr-only"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    aria-label={t("receiptFile")}
                    tabIndex={-1}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      iconStart={IconUpload}
                      onClick={() => input.current?.click()}
                    >
                      {t("receiptFile")}
                    </Button>
                    {file ? <span className="text-muted text-sm">{file.name}</span> : null}
                  </div>
                </div>
              </>
            )}
          </FormDialog>
        ) : null}
      </div>
    </Card>
  );
}
