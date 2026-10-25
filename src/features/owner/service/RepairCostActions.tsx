"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconReceipt } from "@/ui/icons/glyphs/receipt";
import { IconUpload } from "@/ui/icons/glyphs/upload";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { uploadOwnerFile } from "../shared/upload";

type Costs = Schemas["ServiceCostsDto"];
const HANDLERS = ["owner_technician", "tenant", "partner"] as const;
const BEARERS = ["owner", "tenant", "shared"] as const;

/** Who fixes and who pays (D-263): one dialog, the share only when the cost is shared. */
export function DecideRepair({
  serviceRequestId,
  decision,
}: {
  serviceRequestId: string;
  decision: Costs["decision"];
}) {
  const t = useTranslations("owner.service.costs");
  const [bearer, setBearer] = useState<string>(decision?.costBearer ?? "owner");
  return (
    <FormDialog
      label={decision ? t("change") : t("decide")}
      icon={decision ? IconEdit : IconCheckCircle}
      variant={decision ? "secondary" : "primary"}
      size="sm"
      testId="repair-decide"
      title={t("decideTitle")}
      description={t("decideBody")}
      submitLabel={t("save")}
      successMessage={t("decided")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/service-requests/{serviceRequestId}/actions/decide", {
            params: { path: { serviceRequestId } },
            body: {
              handledBy: text(data, "handledBy") as (typeof HANDLERS)[number],
              costBearer: text(data, "costBearer") as (typeof BEARERS)[number],
              tenantSharePercent: bearer === "shared" ? (text(data, "tenantSharePercent") ?? null) : null,
              note: text(data, "note") ?? null,
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("handledBy")} error={errors.handledBy}>
            <NativeSelect
              name="handledBy"
              defaultValue={decision?.handledBy ?? "owner_technician"}
              options={HANDLERS.map((value) => ({ value, label: t(`handler.${value}`) }))}
              data-testid="repair-handled-by"
            />
          </Field>
          <Field label={t("costBearer")} error={errors.costBearer}>
            <NativeSelect
              name="costBearer"
              value={bearer}
              onChange={(event) => setBearer(event.target.value)}
              options={BEARERS.map((value) => ({ value, label: t(`bearer.${value}`) }))}
              data-testid="repair-cost-bearer"
            />
          </Field>
          {bearer === "shared" ? (
            <Field label={t("share")} hint={t("shareHint")} error={errors.tenantSharePercent}>
              <Input
                name="tenantSharePercent"
                inputMode="decimal"
                defaultValue={decision?.tenantSharePercent ? String(Number(decision.tenantSharePercent)) : "50"}
                data-testid="repair-share"
              />
            </Field>
          ) : null}
          <Field label={t("note")} hint={t("noteHint")} error={errors.note}>
            <Input name="note" maxLength={500} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** A quotation or a receipt, its amount, date, vendor and file. */
export function AddRepairCost({
  serviceRequestId,
  unitId,
  today,
}: {
  serviceRequestId: string;
  unitId: string | null;
  today: string;
}) {
  const t = useTranslations("owner.service.costs");
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [kind, setKind] = useState<"quotation" | "receipt">("receipt");
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      size="sm"
      testId="repair-add-cost"
      title={t("addTitle")}
      description={t("addBody")}
      submitLabel={t("add")}
      successMessage={t("added")}
      onSubmit={async (data) => {
        const uploaded = file
          ? await uploadOwnerFile(file, {
              kind: "other",
              scopeType: unitId ? "unit" : "tenant",
              scopeId: unitId,
            })
          : null;
        return unwrap(
          browserApi().POST("/v1/owner/service-requests/{serviceRequestId}/costs", {
            params: { path: { serviceRequestId } },
            body: {
              kind,
              description: text(data, "description") ?? "",
              amount: (text(data, "amount") ?? "").replace(/,/g, ""),
              paidBy: kind === "receipt" ? ((text(data, "paidBy") ?? "owner") as "owner" | "tenant") : null,
              vendorName: text(data, "vendorName") ?? null,
              issuedOn: text(data, "issuedOn") ?? today,
              documentId: uploaded?.id ?? null,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("kind")} error={errors.kind}>
            <NativeSelect
              name="kind"
              value={kind}
              onChange={(event) => setKind(event.target.value as "quotation" | "receipt")}
              options={[
                { value: "receipt", label: t("kinds.receipt") },
                { value: "quotation", label: t("kinds.quotation") },
              ]}
              data-testid="repair-cost-kind"
            />
          </Field>
          <Field label={t("item")} error={errors.description}>
            <Input name="description" maxLength={200} required data-testid="repair-cost-description" />
          </Field>
          <Field label={t("amount")} error={errors.amount}>
            <Input name="amount" inputMode="decimal" required data-testid="repair-cost-amount" />
          </Field>
          {kind === "receipt" ? (
            <Field label={t("paidBy")} hint={t("paidByHint")} error={errors.paidBy}>
              <NativeSelect
                name="paidBy"
                defaultValue="owner"
                options={[
                  { value: "owner", label: t("payer.owner") },
                  { value: "tenant", label: t("payer.tenant") },
                ]}
                data-testid="repair-cost-paid-by"
              />
            </Field>
          ) : null}
          <Field label={t("vendor")} error={errors.vendorName}>
            <Input name="vendorName" maxLength={200} />
          </Field>
          <Field label={t("issuedOn")} error={errors.issuedOn}>
            <Input name="issuedOn" type="date" max={today} defaultValue={today} />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t("file")}</span>
            <input
              ref={input}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              aria-label={t("file")}
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
                {t("file")}
              </Button>
              {file ? <span className="text-muted text-sm">{file.name}</span> : null}
            </div>
          </div>
        </>
      )}
    </FormDialog>
  );
}

/** Voids a cost with a reason (it stays listed). */
export function VoidRepairCost({ serviceRequestId, costId }: { serviceRequestId: string; costId: string }) {
  const t = useTranslations("owner.service.costs");
  return (
    <FormDialog
      label={t("void")}
      icon={IconXCircle}
      size="sm"
      variant="ghost"
      testId={`repair-void-${costId}`}
      title={t("voidTitle")}
      description={t("voidBody")}
      submitLabel={t("void")}
      successMessage={t("voided")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/service-requests/{serviceRequestId}/costs/{costId}/actions/void", {
            params: { path: { serviceRequestId, costId } },
            body: { reason: text(data, "reason") ?? "" },
          }),
        )
      }
    >
      {(errors) => (
        <Field label={t("reason")} error={errors.reason}>
          <Input name="reason" maxLength={200} required />
        </Field>
      )}
    </FormDialog>
  );
}

/** Puts what is due on the tenant's next invoice — their share, or a credit. */
export function SettleRepair({ serviceRequestId, due }: { serviceRequestId: string; due: string }) {
  const t = useTranslations("owner.service.costs");
  const locale = useLocale() as Locale;
  const credit = due.startsWith("-");
  const amount = formatTHB(credit ? due.slice(1) : due, locale);
  return (
    <ConfirmAction
      label={credit ? t("settleCredit", { amount }) : t("settleBill", { amount })}
      icon={IconReceipt}
      size="sm"
      testId="repair-settle"
      title={credit ? t("settleCreditTitle") : t("settleBillTitle")}
      description={credit ? t("settleCreditBody", { amount }) : t("settleBillBody", { amount })}
      confirmLabel={t("settleConfirm")}
      successMessage={t("settled")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/service-requests/{serviceRequestId}/actions/settle", {
            params: { path: { serviceRequestId }, header: { "Idempotency-Key": key } },
          }),
        )
      }
    />
  );
}
