"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCalculator } from "@/ui/icons/glyphs/calculator";
import { IconCoins } from "@/ui/icons/glyphs/coins";
import { IconRepeat } from "@/ui/icons/glyphs/repeat";

import { ownerPath } from "../../shared/links";
import { uploadOwnerFile } from "../../shared/upload";
import { normaliseAmount } from "./money";

type Option = { id: string; label: string };
const MAX_BYTES = 10 * 1024 * 1024;

/** A new float for a building with its custodian (owner / manager, `juristic.fund.manage`). */
export function NewPettyCashButton({ buildings, custodians }: { buildings: Option[]; custodians: Option[] }) {
  const t = useTranslations("owner.accounting.pettyActions");
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      variant="primary"
      testId="petty-new"
      title={t("newTitle")}
      description={t("newBody")}
      submitLabel={t("newSubmit")}
      successMessage={t("created")}
      onSubmit={(data) => {
        const floatAmount = normaliseAmount(text(data, "floatAmount"));
        if (!floatAmount) invalidField("floatAmount", t("error.amount"));
        return unwrap(
          browserApi().POST("/v1/owner/juristic/petty-cash", {
            body: {
              buildingId: text(data, "buildingId") ?? buildings[0]!.id,
              name: text(data, "name") ?? "",
              custodianUserId: text(data, "custodianUserId") ?? custodians[0]?.id ?? "",
              floatAmount: floatAmount!,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("name")} required error={errors.name}>
            <Input name="name" maxLength={120} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("building")} required>
              <NativeSelect name="buildingId" options={buildings.map((b) => ({ value: b.id, label: b.label }))} />
            </Field>
            <Field label={t("float")} hint={t("floatHint")} required error={errors.floatAmount}>
              <Input name="floatAmount" inputMode="decimal" className="text-end tabular-nums" />
            </Field>
          </div>
          <Field label={t("custodian")} hint={t("custodianHint")} required error={errors.custodianUserId}>
            <NativeSelect name="custodianUserId" options={custodians.map((c) => ({ value: c.id, label: c.label }))} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/**
 * A spend from the float with its receipt (required) and the expense account — never more than the float holds
 * (the API refuses with `petty_cash.insufficient`).
 */
export function SpendButton({
  petty,
  accounts,
  today,
}: {
  petty: Schemas["PettyCashDetailDto"];
  accounts: Option[];
  today: string;
}) {
  const t = useTranslations("owner.accounting.pettyActions");
  const common = useTranslations("owner.accounting.common");
  const locale = useLocale() as Locale;
  const [file, setFile] = useState<File | null>(null);
  return (
    <FormDialog
      label={t("spend")}
      icon={IconCoins}
      variant="primary"
      sheet
      testId="petty-spend"
      title={t("spendTitle")}
      description={t("spendBody", { balance: formatTHB(petty.balance, locale) })}
      submitLabel={t("spendSubmit")}
      successMessage={t("spent")}
      onSubmit={async (data, _ack, idempotencyKey) => {
        const amount = normaliseAmount(text(data, "amount"));
        if (!amount || amount === "0.00") invalidField("amount", t("error.amount"));
        if (!text(data, "description")) invalidField("description", t("error.description"));
        if (!file) invalidField("receipt", t("error.receipt"));
        const stored = await uploadOwnerFile(file!, {
          kind: "slip",
          scopeType: "building",
          scopeId: petty.buildingId,
          title: text(data, "description"),
        });
        return unwrap(
          browserApi().POST("/v1/owner/juristic/petty-cash/{pettyCashId}/spends", {
            params: { path: { pettyCashId: petty.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              amount: amount!,
              spentOn: text(data, "spentOn") ?? today,
              description: text(data, "description")!,
              accountId: text(data, "accountId") ?? accounts[0]!.id,
              receiptDocumentId: stored.id,
            },
          }),
        );
      }}
      onDone={() => setFile(null)}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("amount")} required error={errors.amount}>
              <Input
                name="amount"
                inputMode="decimal"
                className="text-end tabular-nums"
                data-testid="petty-spend-amount"
              />
            </Field>
            <Field label={t("spentOn")} required>
              <DateField name="spentOn" defaultValue={today} max={today} />
            </Field>
          </div>
          <Field label={t("description")} required error={errors.description}>
            <Input name="description" maxLength={300} data-testid="petty-spend-description" />
          </Field>
          <Field label={t("account")} required error={errors.accountId}>
            <NativeSelect name="accountId" options={accounts.map((a) => ({ value: a.id, label: a.label }))} />
          </Field>
          <Field
            label={t("receipt")}
            hint={t("receiptHint")}
            required
            error={errors.receipt ?? errors.receiptDocumentId}
          >
            <div className="flex flex-col gap-2">
              <FileDropzone
                label={t("receipt")}
                hint={common("receiptHint")}
                accept="image/*,application/pdf"
                maxBytes={MAX_BYTES}
                tooLargeText={common("tooLarge")}
                chooseText={common("choose")}
                onFiles={(files) => setFile(files[0] ?? null)}
                data-testid="petty-spend-receipt"
              />
              {file ? <p className="text-muted m-0 text-sm">{common("attached", { file: file.name })}</p> : null}
            </div>
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** A cash count: the API compares it with the book balance and posts any shortage or overage. */
export function CountButton({ petty, today }: { petty: Schemas["PettyCashDetailDto"]; today: string }) {
  const t = useTranslations("owner.accounting.pettyActions");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("count")}
      icon={IconCalculator}
      testId="petty-count"
      title={t("countTitle")}
      description={t("countBody", { balance: formatTHB(petty.balance, locale) })}
      submitLabel={t("countSubmit")}
      successMessage={t("counted")}
      onSubmit={(data, _ack, idempotencyKey) => {
        const countedAmount = normaliseAmount(text(data, "countedAmount"));
        if (!countedAmount) invalidField("countedAmount", t("error.amount"));
        return unwrap(
          browserApi().POST("/v1/owner/juristic/petty-cash/{pettyCashId}/counts", {
            params: { path: { pettyCashId: petty.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              countedAmount: countedAmount!,
              countedOn: text(data, "countedOn") ?? today,
              ...(text(data, "note") ? { note: text(data, "note") } : {}),
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("counted")} hint={t("countedHint")} required error={errors.countedAmount}>
              <Input
                name="countedAmount"
                inputMode="decimal"
                className="text-end tabular-nums"
                data-testid="petty-count-amount"
              />
            </Field>
            <Field label={t("countedOn")} required>
              <DateField name="countedOn" defaultValue={today} max={today} />
            </Field>
          </div>
          <Field label={t("note")}>
            <Textarea name="note" rows={2} maxLength={1000} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** A top-up is an expense request of kind `petty_cash_top_up` (approval bands apply): drafted here, sent from its page. */
export function TopUpButton({ petty }: { petty: Schemas["PettyCashDetailDto"] }) {
  const t = useTranslations("owner.accounting.pettyActions");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("topUp")}
      icon={IconRepeat}
      testId="petty-top-up"
      title={t("topUpTitle")}
      description={t("topUpBody", {
        float: formatTHB(petty.floatAmount, locale),
        balance: formatTHB(petty.balance, locale),
      })}
      submitLabel={t("topUpSubmit")}
      onSubmit={(data) => {
        const amount = normaliseAmount(text(data, "amount"));
        if (!amount || amount === "0.00") invalidField("amount", t("error.amount"));
        return unwrap(
          browserApi().POST("/v1/owner/juristic/expense-requests", {
            body: {
              buildingId: petty.buildingId,
              kind: "petty_cash_top_up",
              pettyCashId: petty.id,
              amount: amount!,
              title: t("topUpRequestTitle", { name: petty.name }),
              payeeName: petty.name,
            },
          }),
        );
      }}
      onDone={(result) =>
        window.location.assign(ownerPath(locale, `/juristic/expenses/${(result as Schemas["ExpenseRequestDto"]).id}`))
      }
    >
      {(errors) => (
        <Field label={t("amount")} hint={t("topUpHint")} required error={errors.amount}>
          <Input name="amount" inputMode="decimal" className="text-end tabular-nums" />
        </Field>
      )}
    </FormDialog>
  );
}
