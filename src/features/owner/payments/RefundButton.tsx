"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { uploadOwnerFile } from "../shared/upload";

const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

/**
 * Refund a payer's credit (an overpayment, D-198): amount (the credit is filled in; the API refuses more
 * than the credit), cash or transfer with its slip, date and reference — typed confirmation with the
 * unit, one Idempotency-Key.
 */
export function RefundButton({ credit }: { credit: Schemas["PayerCreditDto"] }) {
  const t = useTranslations("owner.payments.credits.refund");
  const locale = useLocale() as Locale;
  const [amount, setAmount] = useState(credit.balance);
  const [method, setMethod] = useState<Schemas["CreditRefundMethod"]>("cash");
  const [date, setDate] = useState<string | null>(null);
  const [reference, setReference] = useState("");
  const [evidence, setEvidence] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  if (!credit.unitId) return null;
  const ready = MONEY.test(amount) && Boolean(date) && !uploading && (method === "cash" || evidence !== null);
  return (
    <ConfirmAction
      label={t("button")}
      icon={IconWallet}
      size="sm"
      variant="secondary"
      testId="credit-refund"
      title={t("title")}
      description={t("body", {
        party: credit.partyName,
        unit: credit.unitNo ?? "—",
        credit: formatTHB(credit.balance, locale),
      })}
      confirmLabel={t("button")}
      phrase={credit.unitNo ?? undefined}
      ready={ready}
      successMessage={t("done")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/refunds", {
            params: { header: { "Idempotency-Key": key } },
            body: {
              partyId: credit.partyId,
              unitId: credit.unitId!,
              amount,
              method,
              refundedAt: `${date}T12:00:00+07:00`,
              reference: reference.trim() || undefined,
              evidenceDocumentId: evidence ?? undefined,
            },
          }),
        )
      }
    >
      <Field label={t("amount")}>
        <Input
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          data-testid="refund-amount"
        />
      </Field>
      <Field label={t("method")}>
        <NativeSelect
          value={method}
          onChange={(event) => setMethod(event.target.value as Schemas["CreditRefundMethod"])}
          options={[
            { value: "cash", label: t("cash") },
            { value: "bank_transfer", label: t("transfer") },
          ]}
          data-testid="refund-method"
        />
      </Field>
      <Field label={t("date")} required>
        <DateField name="refundedAt" onChange={setDate} />
      </Field>
      <Field label={t("reference")}>
        <Input value={reference} onChange={(event) => setReference(event.target.value)} />
      </Field>
      {method === "bank_transfer" ? (
        <FileDropzone
          label={t("slip")}
          accept="image/*,application/pdf"
          maxBytes={10 * 1024 * 1024}
          tooLargeText={t("tooLarge")}
          chooseText={t("choose")}
          disabled={uploading}
          onFiles={(files) => {
            const file = files[0];
            if (!file) return;
            setUploading(true);
            uploadOwnerFile(file, { kind: "slip", scopeType: "unit", scopeId: credit.unitId })
              .then((stored) => setEvidence(stored.id))
              .catch(() => setEvidence(null))
              .finally(() => setUploading(false));
          }}
        />
      ) : null}
    </ConfirmAction>
  );
}
