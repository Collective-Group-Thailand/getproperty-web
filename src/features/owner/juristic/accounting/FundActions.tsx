"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconSwap } from "@/ui/icons/glyphs/swap";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { ownerPath } from "../../shared/links";
import { normaliseAmount } from "./money";

type Option = { id: string; label: string };
const KINDS: readonly Schemas["JuristicFundKind"][] = ["sinking", "reserve", "other"];

/** A new fund of a building, with the bank account that holds it (two ledger accounts are created with it). */
export function NewFundButton({ buildings, banks }: { buildings: Option[]; banks: Option[] }) {
  const t = useTranslations("owner.accounting.fundActions");
  const kinds = useTranslations("owner.accounting.fundKind");
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      variant="primary"
      testId="fund-new"
      title={t("newTitle")}
      description={t("newBody")}
      submitLabel={t("newSubmit")}
      successMessage={t("created")}
      onSubmit={(data) => {
        const bankAccountId = text(data, "bankAccountId");
        return unwrap(
          browserApi().POST("/v1/owner/juristic/funds", {
            body: {
              buildingId: text(data, "buildingId") ?? buildings[0]!.id,
              kind: (text(data, "kind") ?? "sinking") as Schemas["JuristicFundKind"],
              name: text(data, "name") ?? "",
              ...(bankAccountId ? { bankAccountId } : {}),
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("building")} required error={errors.buildingId}>
              <NativeSelect name="buildingId" options={buildings.map((b) => ({ value: b.id, label: b.label }))} />
            </Field>
            <Field label={t("kind")} required>
              <NativeSelect
                name="kind"
                defaultValue="sinking"
                options={KINDS.map((value) => ({ value, label: kinds(value) }))}
              />
            </Field>
          </div>
          <Field label={t("name")} required error={errors.name}>
            <Input name="name" maxLength={120} data-testid="fund-name" />
          </Field>
          <Field label={t("bank")} hint={t("bankHint")}>
            <NativeSelect
              name="bankAccountId"
              placeholder={t("noBank")}
              options={banks.map((b) => ({ value: b.id, label: b.label }))}
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** Rename a fund or change the bank account that holds it. */
export function EditFundButton({ fund, banks }: { fund: Schemas["FundDto"]; banks: Option[] }) {
  const t = useTranslations("owner.accounting.fundActions");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      testId="fund-edit"
      title={t("editTitle", { name: fund.name })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) =>
        unwrap(
          browserApi().PATCH("/v1/owner/juristic/funds/{fundId}", {
            params: { path: { fundId: fund.id } },
            body: {
              name: text(data, "name") ?? fund.name,
              bankAccountId: text(data, "bankAccountId") ?? null,
              version: fund.version,
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("name")} required error={errors.name}>
            <Input name="name" defaultValue={fund.name} maxLength={120} />
          </Field>
          <Field label={t("bank")} hint={t("bankHint")}>
            <NativeSelect
              name="bankAccountId"
              defaultValue={fund.bankAccountId ?? ""}
              placeholder={t("noBank")}
              options={banks.map((b) => ({ value: b.id, label: b.label }))}
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/**
 * Asks to move money into or out of a fund (D-311): out needs an adopted resolution of the fund's building — the
 * picker lists only those, and the request waits for **another** member to approve it before anything is posted.
 */
export function RequestTransferButton({
  fund,
  accounts,
  resolutions,
  today,
}: {
  fund: Schemas["FundDto"];
  accounts: Option[];
  resolutions: Option[];
  today: string;
}) {
  const t = useTranslations("owner.accounting.transfer");
  const locale = useLocale() as Locale;
  const [direction, setDirection] = useState<Schemas["FundTransferDirection"]>("out");
  return (
    <FormDialog
      label={t("request")}
      icon={IconSwap}
      variant="primary"
      sheet
      testId="fund-transfer"
      title={t("title", { name: fund.name })}
      description={t("body", { balance: formatTHB(fund.bankBalance, locale) })}
      submitLabel={t("submit")}
      successMessage={t("requested")}
      onSubmit={(data, _ack, idempotencyKey) => {
        const amount = normaliseAmount(text(data, "amount"));
        if (!amount || amount === "0.00") invalidField("amount", t("error.amount"));
        const resolutionId = text(data, "resolutionId");
        if (direction === "out" && !resolutionId) invalidField("resolutionId", t("error.resolution"));
        const transferOn = text(data, "transferOn");
        if (!transferOn) invalidField("transferOn", t("error.date"));
        return unwrap(
          browserApi().POST("/v1/owner/juristic/funds/{fundId}/transfers", {
            params: { path: { fundId: fund.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              direction,
              amount: amount!,
              transferOn: transferOn!,
              ...(text(data, "counterAccountId") ? { counterAccountId: text(data, "counterAccountId") } : {}),
              ...(resolutionId ? { resolutionId } : {}),
              ...(text(data, "reference") ? { reference: text(data, "reference") } : {}),
              ...(text(data, "note") ? { note: text(data, "note") } : {}),
            },
          }),
        );
      }}
      onDone={(result) =>
        window.location.assign(
          ownerPath(locale, `/juristic/funds/transfers/${(result as Schemas["FundTransferDto"]).id}`),
        )
      }
    >
      {(errors) => (
        <>
          <SegmentedControl
            label={t("direction")}
            value={direction}
            onValueChange={(value) => setDirection(value as Schemas["FundTransferDirection"])}
            fullWidth
            options={[
              { value: "out", label: t("out") },
              { value: "in", label: t("in") },
            ]}
          />
          <p className="text-muted m-0 text-sm">{direction === "out" ? t("outHint") : t("inHint")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("amount")} required error={errors.amount}>
              <Input
                name="amount"
                inputMode="decimal"
                className="text-end tabular-nums"
                data-testid="fund-transfer-amount"
              />
            </Field>
            <Field label={t("date")} hint={t("dateHint")} required error={errors.transferOn}>
              <DateField name="transferOn" defaultValue={today} max={today} />
            </Field>
          </div>
          {accounts.length ? (
            <Field
              label={direction === "out" ? t("to") : t("from")}
              hint={t("counterHint")}
              error={errors.counterAccountId}
            >
              <NativeSelect name="counterAccountId" options={accounts.map((a) => ({ value: a.id, label: a.label }))} />
            </Field>
          ) : null}
          <Field
            label={t("resolution")}
            hint={
              resolutions.length
                ? direction === "out"
                  ? t("resolutionRequired")
                  : t("resolutionOptional")
                : t("noResolutions")
            }
            required={direction === "out"}
            error={errors.resolutionId}
          >
            <NativeSelect
              name="resolutionId"
              placeholder={t("resolutionPlaceholder")}
              options={resolutions.map((r) => ({ value: r.id, label: r.label }))}
              data-testid="fund-transfer-resolution"
            />
          </Field>
          <Field label={t("reference")}>
            <Input name="reference" maxLength={100} />
          </Field>
          <Field label={t("note")} hint={t("noteHint")}>
            <Textarea name="note" rows={2} maxLength={1000} />
          </Field>
          <p className="bg-bg-subtle rounded-control m-0 p-3 text-sm">{t("secondUser")}</p>
        </>
      )}
    </FormDialog>
  );
}

/** Approve (posts the journal) or reject with a reason — never by the member who asked (D-091). */
export function TransferDecision({ transfer }: { transfer: Schemas["FundTransferDto"] }) {
  const t = useTranslations("owner.accounting.transfer");
  const locale = useLocale() as Locale;
  const [reason, setReason] = useState("");
  const call = (action: "approve" | "reject", idempotencyKey: string) =>
    unwrap(
      browserApi().POST(
        action === "approve"
          ? "/v1/owner/juristic/fund-transfers/{fundTransferId}/actions/approve"
          : "/v1/owner/juristic/fund-transfers/{fundTransferId}/actions/reject",
        {
          params: { path: { fundTransferId: transfer.id }, header: { "Idempotency-Key": idempotencyKey } },
          body: action === "approve" ? {} : { reason: reason.trim() },
        },
      ),
    );
  return (
    <>
      <ConfirmAction
        label={t("approve")}
        icon={IconCheckCircle}
        block
        testId="fund-transfer-approve"
        title={t("approveTitle")}
        description={t(transfer.direction === "out" ? "approveOut" : "approveIn", {
          amount: formatTHB(transfer.amount, locale),
          fund: transfer.fundName,
        })}
        confirmLabel={t("approve")}
        successMessage={t("approved")}
        onConfirm={(key) => call("approve", key)}
      />
      <ConfirmAction
        label={t("reject")}
        icon={IconXCircle}
        variant="secondary"
        tone="destructive"
        block
        testId="fund-transfer-reject"
        title={t("rejectTitle")}
        description={t("rejectBody")}
        confirmLabel={t("reject")}
        ready={reason.trim().length >= 3}
        successMessage={t("rejected")}
        onConfirm={(key) => call("reject", key)}
      >
        <Field label={t("reason")} hint={t("reasonHint")} required>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={600} />
        </Field>
      </ConfirmAction>
    </>
  );
}
