"use client";

import { useTranslations } from "next-intl";

import { ActionMenu } from "@/features/shared/console/ActionMenu";

import { DocumentButton } from "../shared/DocumentButton";
import { ResendReceipt } from "./ResendReceipt";

/** A receipt row's "⋯" (G3 revision): open the PDF, send it to the payer again — never a row of buttons. */
export function ReceiptRowMenu({
  receipt,
}: {
  receipt: { id: string; number: string; payerName: string; hasDocument: boolean; voided: boolean };
}) {
  const t = useTranslations("owner.payments.credits");
  if (!receipt.hasDocument && receipt.voided) return null;
  return (
    <ActionMenu label={t("rowMenu", { number: receipt.number })} testId="receipt-menu">
      {receipt.hasDocument ? (
        <DocumentButton document={{ kind: "receipt", id: receipt.id }} label={t("pdf")} title={receipt.number} />
      ) : null}
      {receipt.voided ? null : (
        <ResendReceipt receiptId={receipt.id} number={receipt.number} payer={receipt.payerName} />
      )}
    </ActionMenu>
  );
}
