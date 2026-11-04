"use client";

import { useTranslations } from "next-intl";
import { Suspense, useState } from "react";

import { Button, type ButtonProps } from "@/ui/components/Button";
import { LazyDialog } from "@/ui/components/overlays";
import { lazyWarm } from "@/ui/lib/lazy";
import { IconBill } from "@/ui/icons/glyphs/bill";

import type { DocumentRef } from "./documents";

const DocumentViewer = lazyWarm(() => import("./DocumentViewer").then((module) => module.DocumentViewer));

/**
 * Opens a document (invoice, receipt, contract, statement…) in the console's PDF viewer — a dialog
 * loaded on first use (D-179) that shows the PDF and offers "open in a new tab" and "download".
 */
export function DocumentButton({
  document,
  label,
  title,
  variant = "secondary",
  size = "sm",
  testId,
  open: controlled,
  onOpenChange,
}: {
  document: DocumentRef;
  label: string;
  /** The dialog's title ("ใบแจ้งหนี้ INV-2569-00012"). */
  title: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  testId?: string;
  /** Controlled from outside (a row's "⋯" menu): no trigger button is rendered. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("owner.common.document");
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = (next: boolean) => {
    onOpenChange?.(next);
    if (controlled === undefined) setInner(next);
  };
  return (
    <>
      {controlled === undefined ? (
        <Button variant={variant} size={size} iconStart={IconBill} onClick={() => setOpen(true)} data-testid={testId}>
          {label}
        </Button>
      ) : null}
      <LazyDialog open={open} onOpenChange={setOpen} title={title} size="xl" closeLabel={t("close")}>
        {open ? (
          <Suspense fallback={null}>
            <DocumentViewer document={document} title={title} />
          </Suspense>
        ) : null}
      </LazyDialog>
    </>
  );
}
