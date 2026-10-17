"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconWallet } from "@/ui/icons/glyphs/wallet";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { uploadOwnerFile } from "../shared/upload";

const MONEY = /^\d{1,9}(\.\d{1,2})?$/;
const KINDS: Schemas["DeductionKind"][] = ["damage", "missing_item", "cleaning", "unpaid_invoice", "other"];
const METHODS: Schemas["RefundMethod"][] = ["bank_transfer", "cash", "offset"];
const MAX_BYTES = 10 * 1024 * 1024;

type Deposit = Pick<Schemas["DepositDto"], "id" | "unitNo" | "nextActions" | "settlement">;

function useEvidence(unitId: string | null) {
  const [ids, setIds] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const add = async (files: File[]) => {
    setUploading(true);
    setFailed(false);
    try {
      for (const file of files) {
        const stored = await uploadOwnerFile(file, {
          kind: "inspection_photo",
          scopeType: unitId ? "unit" : "tenant",
          scopeId: unitId,
        });
        setIds((current) => [...current, stored.id]);
        setNames((current) => [...current, file.name]);
      }
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
    }
  };
  const reset = () => {
    setIds([]);
    setNames([]);
    setFailed(false);
  };
  return { ids, names, uploading, failed, add, reset };
}

/**
 * Adds a deduction to a settlement (D-023): kind, the inspection item it refers to (move-out
 * condition), description, amount and evidence photos. Normal wear and deductions without evidence
 * are refused by the API (`compliance.deposit_wear`, `compliance.deposit_evidence`) — shown with the
 * legal reference, never bypassed here.
 */
export function AddDeductionButton({
  deposit,
  unitId,
  items,
}: {
  deposit: Deposit;
  unitId: string | null;
  items: { id: string; label: string }[];
}) {
  const t = useTranslations("owner.deposits.deduction");
  const evidence = useEvidence(unitId);
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      testId="add-deduction"
      title={t("addTitle")}
      description={t("addBody", { unit: deposit.unitNo })}
      submitLabel={t("addSubmit")}
      successMessage={t("added")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/deposits/{depositId}/settlement/items", {
            params: { path: { depositId: deposit.id } },
            body: {
              kind: (text(data, "kind") ?? "damage") as Schemas["DeductionKind"],
              wearCategory: (text(data, "wearCategory") ?? "damage") as Schemas["WearCategory"],
              description: text(data, "description") ?? "",
              amount: text(data, "amount") ?? "",
              inspectionItemId: text(data, "inspectionItemId") ?? null,
              evidenceDocumentIds: evidence.ids.length ? evidence.ids : undefined,
            },
          }),
        )
      }
      onDone={() => evidence.reset()}
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("kind")} error={errors.kind}>
              <NativeSelect
                name="kind"
                options={KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
                data-testid="deduction-kind"
              />
            </Field>
            <Field label={t("wear")} hint={t("wearHint")} error={errors.wearCategory}>
              <NativeSelect
                name="wearCategory"
                options={[
                  { value: "damage", label: t("wearDamage") },
                  { value: "normal_wear", label: t("wearNormal") },
                ]}
                data-testid="deduction-wear"
              />
            </Field>
          </div>
          {items.length ? (
            <Field label={t("item")} hint={t("itemHint")} error={errors.inspectionItemId}>
              <NativeSelect
                name="inspectionItemId"
                placeholder={t("noItem")}
                options={items.map((item) => ({ value: item.id, label: item.label }))}
                data-testid="deduction-item"
              />
            </Field>
          ) : null}
          <Field label={t("description")} required error={errors.description}>
            <Textarea name="description" rows={2} required data-testid="deduction-description" />
          </Field>
          <Field label={t("amount")} required hint={t("amountHint")} error={errors.amount}>
            <Input name="amount" inputMode="decimal" required data-testid="deduction-amount" />
          </Field>
          <FileDropzone
            label={t("evidence")}
            hint={t("evidenceHint")}
            accept="image/*,application/pdf"
            multiple
            maxBytes={MAX_BYTES}
            tooLargeText={t("tooLarge")}
            chooseText={t("choose")}
            disabled={evidence.uploading}
            onFiles={(files) => void evidence.add(files)}
            data-testid="deduction-evidence"
          />
          {evidence.names.length ? (
            <p className="text-muted text-sm" data-testid="deduction-evidence-list">
              {t("attached", { files: evidence.names.join(", ") })}
            </p>
          ) : null}
          {evidence.failed ? <Callout tone="danger">{t("uploadFailed")}</Callout> : null}
        </>
      )}
    </FormDialog>
  );
}

export function RemoveDeductionButton({ deposit, item }: { deposit: Deposit; item: Schemas["DeductionDto"] }) {
  const t = useTranslations("owner.deposits.deduction");
  return (
    <ConfirmAction
      label={t("remove")}
      icon={IconDelete}
      variant="ghost"
      size="sm"
      tone="destructive"
      testId="remove-deduction"
      title={t("removeTitle")}
      description={t("removeBody", { description: item.description })}
      confirmLabel={t("remove")}
      onConfirm={() =>
        unwrap(
          browserApi().DELETE("/v1/owner/deposits/{depositId}/settlement/items/{itemId}", {
            params: { path: { depositId: deposit.id, itemId: item.id } },
          }),
        )
      }
    />
  );
}

/** The settlement's next step: propose to the resident, revise, record the refund, or record the receipt. */
export function SettlementActions({ deposit, unitId }: { deposit: Deposit; unitId: string | null }) {
  const t = useTranslations("owner.deposits.actions");
  const methods = useTranslations("owner.deposits.method");
  const can = (name: string) => deposit.nextActions.includes(name);
  const path = { depositId: deposit.id };
  const [refund, setRefund] = useState<{ amount: string; method: Schemas["RefundMethod"]; reference: string }>({
    amount: deposit.settlement?.agreedRefund ?? deposit.settlement?.proposedRefund ?? "",
    method: "bank_transfer",
    reference: "",
  });
  const evidence = useEvidence(unitId);
  const refundReady =
    MONEY.test(refund.amount) && !evidence.uploading && (refund.method !== "bank_transfer" || evidence.ids.length > 0);

  return (
    <div className="flex flex-wrap gap-2" data-testid="settlement-actions">
      {can("record-receipt") ? (
        <ConfirmAction
          label={t("recordReceipt")}
          icon={IconCheck}
          testId="deposit-record-receipt"
          title={t("recordReceiptTitle")}
          description={t("recordReceiptBody", { unit: deposit.unitNo })}
          confirmLabel={t("recordReceipt")}
          successMessage={t("receiptRecorded")}
          onConfirm={(key) =>
            unwrap(
              browserApi().POST("/v1/owner/deposits/{depositId}/actions/record-receipt", {
                params: { path, header: { "Idempotency-Key": key } },
                body: {},
              }),
            )
          }
        />
      ) : null}
      {can("propose") ? (
        <FormDialog
          label={t("propose")}
          icon={IconCheck}
          variant="primary"
          testId="settlement-propose"
          title={t("proposeTitle")}
          description={t("proposeBody", { unit: deposit.unitNo })}
          submitLabel={t("proposeSubmit")}
          successMessage={t("proposed")}
          onSubmit={(data) =>
            unwrap(
              browserApi().POST("/v1/owner/deposits/{depositId}/settlement/actions/propose", {
                params: { path },
                body: { utilitiesFinal: text(data, "utilitiesFinal") },
              }),
            )
          }
        >
          {(errors) => (
            <Field label={t("utilitiesFinal")} hint={t("utilitiesFinalHint")} error={errors.utilitiesFinal}>
              <Input name="utilitiesFinal" inputMode="decimal" data-testid="utilities-final" />
            </Field>
          )}
        </FormDialog>
      ) : null}
      {can("revise") ? (
        <ConfirmAction
          label={t("revise")}
          icon={IconEdit}
          variant="secondary"
          testId="settlement-revise"
          title={t("reviseTitle")}
          description={t("reviseBody", { unit: deposit.unitNo })}
          confirmLabel={t("revise")}
          onConfirm={() =>
            unwrap(browserApi().POST("/v1/owner/deposits/{depositId}/settlement/actions/revise", { params: { path } }))
          }
        />
      ) : null}
      {can("record-refund") ? (
        <ConfirmAction
          label={t("recordRefund")}
          icon={IconWallet}
          testId="settlement-refund"
          title={t("recordRefundTitle")}
          description={t("recordRefundBody", { unit: deposit.unitNo })}
          confirmLabel={t("recordRefund")}
          phrase={deposit.unitNo}
          ready={refundReady}
          successMessage={t("refundRecorded")}
          onConfirm={(key) =>
            unwrap(
              browserApi().POST("/v1/owner/deposits/{depositId}/settlement/actions/record-refund", {
                params: { path, header: { "Idempotency-Key": key } },
                body: {
                  amount: refund.amount,
                  method: refund.method,
                  reference: refund.reference.trim() || null,
                  evidenceDocumentId: evidence.ids[0] ?? null,
                },
              }),
            )
          }
        >
          <Field label={t("refundAmount")} hint={t("refundAmountHint")}>
            <Input
              inputMode="decimal"
              value={refund.amount}
              onChange={(event) => setRefund({ ...refund, amount: event.target.value })}
              data-testid="refund-amount"
            />
          </Field>
          <Field label={t("refundMethod")}>
            <NativeSelect
              value={refund.method}
              onChange={(event) => setRefund({ ...refund, method: event.target.value as Schemas["RefundMethod"] })}
              options={METHODS.map((method) => ({ value: method, label: methods(method) }))}
              data-testid="refund-method"
            />
          </Field>
          <Field label={t("refundReference")}>
            <Input
              value={refund.reference}
              onChange={(event) => setRefund({ ...refund, reference: event.target.value })}
            />
          </Field>
          {refund.method === "bank_transfer" ? (
            <FileDropzone
              label={t("refundSlip")}
              hint={t("refundSlipHint")}
              accept="image/*,application/pdf"
              maxBytes={MAX_BYTES}
              tooLargeText={t("tooLarge")}
              chooseText={t("choose")}
              disabled={evidence.uploading}
              onFiles={(files) => void evidence.add(files)}
              data-testid="refund-slip"
            />
          ) : null}
          {evidence.names.length ? <p className="text-muted text-sm">{evidence.names.join(", ")}</p> : null}
        </ConfirmAction>
      ) : null}
    </div>
  );
}
