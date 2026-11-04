"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { IconButton } from "@/ui/components/IconButton";
import { LazyDropdownMenu } from "@/ui/components/overlays";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconMore } from "@/ui/icons/glyphs/more";

import { DocumentButton } from "../shared/DocumentButton";
import { ResendReceipt } from "./ResendReceipt";

/** A receipt row's "⋯" (G3 revision): open the PDF, send it to the payer again — never a row of buttons. */
export function ReceiptRowMenu({
  receipt,
}: {
  receipt: { id: string; number: string; payerName: string; hasDocument: boolean; voided: boolean };
}) {
  const t = useTranslations("owner.payments.credits");
  const resend = useTranslations("owner.payments.resendReceipt");
  const [open, setOpen] = useState<"pdf" | "resend" | null>(null);
  const items = [
    ...(receipt.hasDocument ? [{ id: "pdf", label: t("pdf"), icon: IconBill, onSelect: () => setOpen("pdf") }] : []),
    ...(receipt.voided
      ? []
      : [
          {
            id: "resend",
            label: <span data-testid="receipt-resend">{resend("action")}</span>,
            icon: IconMail,
            onSelect: () => setOpen("resend"),
          },
        ]),
  ];
  if (items.length === 0) return null;
  return (
    <>
      <LazyDropdownMenu
        label={t("rowMenu", { number: receipt.number })}
        trigger={
          <IconButton icon={IconMore} label={t("rowMenu", { number: receipt.number })} data-testid="receipt-menu" />
        }
        items={items}
      />
      {receipt.hasDocument ? (
        <DocumentButton
          document={{ kind: "receipt", id: receipt.id }}
          label={t("pdf")}
          title={receipt.number}
          open={open === "pdf"}
          onOpenChange={(next) => setOpen(next ? "pdf" : null)}
        />
      ) : null}
      {receipt.voided ? null : (
        <ResendReceipt
          receiptId={receipt.id}
          number={receipt.number}
          payer={receipt.payerName}
          open={open === "resend"}
          onOpenChange={(next) => setOpen(next ? "resend" : null)}
        />
      )}
    </>
  );
}
