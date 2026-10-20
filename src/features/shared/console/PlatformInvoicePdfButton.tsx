"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { Button } from "@/ui/components/Button";
import { IconDownload } from "@/ui/icons/glyphs/download";

/**
 * The PDF of a platform invoice (D-146): asks the API for a short-lived signed URL when clicked
 * (`…/pdf`, admin or owner surface) and opens it; while the API is still rendering it answers
 * `409 platform_invoice.invalid_state`, shown as "being prepared".
 */
export function PlatformInvoicePdfButton({ invoiceId, surface }: { invoiceId: string; surface: "admin" | "owner" }) {
  const t = useTranslations("console.platformInvoice");
  const [state, setState] = useState<"idle" | "busy" | "pending" | "failed">("idle");
  const open = async () => {
    setState("busy");
    try {
      const params = { params: { path: { invoiceId } } };
      const download =
        surface === "admin"
          ? await unwrap(browserApi().GET("/v1/admin/platform-invoices/{invoiceId}/pdf", params))
          : await unwrap(browserApi().GET("/v1/owner/subscription/invoices/{invoiceId}/pdf", params));
      window.open(download.url, "_blank", "noopener,noreferrer");
      setState("idle");
    } catch (error) {
      setState(isApiError(error) && error.code === "platform_invoice.invalid_state" ? "pending" : "failed");
    }
  };
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        iconStart={IconDownload}
        loading={state === "busy"}
        onClick={() => void open()}
        data-testid="platform-invoice-pdf"
      >
        {t("pdf")}
      </Button>
      {state === "pending" || state === "failed" ? (
        <span role="status" className="text-muted text-sm">
          {t(state)}
        </span>
      ) : null}
    </span>
  );
}
