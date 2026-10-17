"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDownload } from "@/ui/icons/glyphs/download";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

import { DateField } from "../shared/DateField";
import { FormDialog, text } from "../shared/FormDialog";
import { uploadOwnerFile } from "../shared/upload";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "../shared/useApiAction";

const PROVIDERS: Record<Schemas["Utility"], Schemas["UtilityProvider"][]> = {
  electric: ["mea", "pea"],
  water: ["mwa", "pwa"],
};

/** `POST …/loss/actions/recompute` — the API recomputes the cycle's loss report from the latest data. */
export function RecomputeLoss({
  buildingId,
  cycle,
  utility,
}: {
  buildingId: string;
  cycle: string;
  utility: Schemas["Utility"];
}) {
  const t = useTranslations("owner.loss");
  const action = useApiAction();
  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        variant="secondary"
        iconStart={IconRefresh}
        loading={action.busy}
        onClick={() =>
          void action.run(() =>
            unwrap(
              browserApi().POST("/v1/owner/buildings/{buildingId}/loss/actions/recompute", {
                params: { path: { buildingId } },
                body: { cycle, utility },
              }),
            ),
          )
        }
        data-testid="loss-recompute"
      >
        {t("recompute")}
      </Button>
      <ProblemNotice error={action.error} />
    </div>
  );
}

/**
 * A CSV of the loss report as the API computed it (values copied, nothing calculated), built in the
 * browser until the API offers a loss export kind (contract request).
 */
export function LossCsv({ rows, fileName, label }: { rows: string[][]; fileName: string; label: string }) {
  const href = useMemo(() => {
    const escape = (cell: string) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
    const csv = `﻿${rows.map((row) => row.map(escape).join(",")).join("\n")}\n`;
    return `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`;
  }, [rows]);
  return (
    <Button asChild variant="secondary" iconStart={IconDownload}>
      <a href={href} download={fileName} data-testid="loss-csv">
        {label}
      </a>
    </Button>
  );
}

/**
 * Enter the utility's own invoice for a period (D-032): by hand, or from its photo — uploaded, then read
 * by the API (`…/utility-invoices/actions/prefill`) to fill the fields, which the owner checks before
 * saving. One Idempotency-Key per entry; a second invoice for the same period is refused.
 */
export function UtilityInvoiceButton({
  buildingId,
  utility,
  accounts,
}: {
  buildingId: string;
  utility: Schemas["Utility"];
  accounts: Schemas["UtilityAccountDto"][];
}) {
  const t = useTranslations("owner.loss.invoice");
  const providers = useTranslations("owner.common.provider");
  const idempotency = useIdempotencyKey();
  const [prefill, setPrefill] = useState<{
    version: number;
    fields: Schemas["UtilityInvoiceFieldsDto"] | null;
    documentId: string | null;
    confidence: number | null;
  }>({
    version: 0,
    fields: null,
    documentId: null,
    confidence: null,
  });
  const [reading, setReading] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const own = accounts.filter((account) => account.utility === utility);
  const fields = prefill.fields;

  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      testId="utility-invoice-add"
      title={t(`title.${utility}`)}
      description={t("body")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      size_="lg"
      onSubmit={async (data) => {
        const result = await unwrap(
          browserApi().POST("/v1/owner/buildings/{buildingId}/utility-invoices", {
            params: { path: { buildingId }, header: { "Idempotency-Key": idempotency.key } },
            body: {
              utility,
              provider: (text(data, "provider") ?? PROVIDERS[utility][0]) as Schemas["UtilityProvider"],
              utilityAccountId: text(data, "utilityAccountId") ?? null,
              invoiceNo: text(data, "invoiceNo") ?? null,
              periodStart: text(data, "periodStart") ?? "",
              periodEnd: text(data, "periodEnd") ?? "",
              units: text(data, "units") ?? "",
              amount: text(data, "amount") ?? "",
              ft: text(data, "ft") ?? null,
              serviceCharge: text(data, "serviceCharge") ?? null,
              vat: text(data, "vat") ?? null,
              previousRegister: text(data, "previousRegister") ?? null,
              currentRegister: text(data, "currentRegister") ?? null,
              invoiceDocumentId: prefill.documentId,
            },
          }),
        );
        idempotency.renew();
        setPrefill({ version: prefill.version + 1, fields: null, documentId: null, confidence: null });
        return result;
      }}
    >
      {(errors) => (
        <>
          <FileDropzone
            label={t("photo")}
            hint={t("photoHint")}
            accept="image/*,application/pdf"
            maxBytes={10 * 1024 * 1024}
            tooLargeText={t("tooLarge")}
            chooseText={t("choose")}
            disabled={reading}
            onFiles={(files) => {
              const file = files[0];
              if (!file) return;
              setReading(true);
              setReadFailed(false);
              uploadOwnerFile(file, { kind: "utility_invoice", scopeType: "building", scopeId: buildingId })
                .then(async (stored) => {
                  const answer = await unwrap(
                    browserApi().POST("/v1/owner/buildings/{buildingId}/utility-invoices/actions/prefill", {
                      params: { path: { buildingId } },
                      body: { documentId: stored.id, utility },
                    }),
                  );
                  setPrefill((current) => ({
                    version: current.version + 1,
                    fields: answer.fields,
                    documentId: stored.id,
                    confidence: answer.confidence,
                  }));
                })
                .catch(() => setReadFailed(true))
                .finally(() => setReading(false));
            }}
            data-testid="utility-invoice-photo"
          />
          {reading ? <p className="text-muted text-sm">{t("reading")}</p> : null}
          {readFailed ? <Callout tone="warning">{t("readFailed")}</Callout> : null}
          {fields ? (
            <div data-testid="utility-invoice-prefilled">
              <Callout tone="info">
                {t("prefilled", { confidence: Math.round((prefill.confidence ?? 0) * 100) })}
              </Callout>
            </div>
          ) : null}
          <div key={prefill.version} className="grid gap-4 sm:grid-cols-2">
            <Field label={t("provider")}>
              <NativeSelect
                name="provider"
                options={PROVIDERS[utility].map((value) => ({ value, label: providers(value) }))}
              />
            </Field>
            {own.length ? (
              <Field label={t("account")}>
                <NativeSelect
                  name="utilityAccountId"
                  placeholder={t("noAccount")}
                  options={own.map((account) => ({
                    value: account.id,
                    label: `${account.label} (${account.customerNo})`,
                  }))}
                />
              </Field>
            ) : null}
            <Field label={t("invoiceNo")} error={errors.invoiceNo}>
              <Input name="invoiceNo" defaultValue={fields?.invoiceNo ?? ""} />
            </Field>
            <Field label={t("periodStart")} required error={errors.periodStart}>
              <DateField name="periodStart" defaultValue={fields?.periodStart ?? null} />
            </Field>
            <Field label={t("periodEnd")} required error={errors.periodEnd}>
              <DateField name="periodEnd" defaultValue={fields?.periodEnd ?? null} />
            </Field>
            <Field label={t(`units.${utility}`)} required error={errors.units}>
              <Input
                name="units"
                inputMode="decimal"
                required
                defaultValue={fields?.units ?? ""}
                data-testid="ui-units"
              />
            </Field>
            <Field label={t("amount")} required error={errors.amount}>
              <Input
                name="amount"
                inputMode="decimal"
                required
                defaultValue={fields?.amount ?? ""}
                data-testid="ui-amount"
              />
            </Field>
            {utility === "electric" ? (
              <Field label={t("ft")} error={errors.ft}>
                <Input name="ft" inputMode="decimal" defaultValue={fields?.ft ?? ""} />
              </Field>
            ) : null}
            <Field label={t("serviceCharge")} error={errors.serviceCharge}>
              <Input name="serviceCharge" inputMode="decimal" defaultValue={fields?.serviceCharge ?? ""} />
            </Field>
            <Field label={t("vat")} error={errors.vat}>
              <Input name="vat" inputMode="decimal" defaultValue={fields?.vat ?? ""} />
            </Field>
            <Field label={t("previousRegister")}>
              <Input
                name="previousRegister"
                inputMode="decimal"
                className="font-mono"
                defaultValue={fields?.previousRegister ?? ""}
              />
            </Field>
            <Field label={t("currentRegister")}>
              <Input
                name="currentRegister"
                inputMode="decimal"
                className="font-mono"
                defaultValue={fields?.currentRegister ?? ""}
              />
            </Field>
          </div>
        </>
      )}
    </FormDialog>
  );
}
