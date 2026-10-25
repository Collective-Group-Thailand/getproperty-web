"use client";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";

/**
 * Documents the owner console opens in its viewer (F2 2.2–2.4), by kind and id. Each resolves to a
 * short-lived signed URL from the API (5 minutes, contract §3) or, for the contract preview, the BFF
 * path that streams the PDF; nothing here builds a storage URL itself.
 */
export type DocumentRef =
  | { kind: "invoice"; id: string; paper?: "a4" | "thermal_80mm" }
  | { kind: "creditNote"; id: string }
  | { kind: "debitNote"; id: string }
  | { kind: "receipt"; id: string }
  | { kind: "depositReceipt"; id: string }
  | { kind: "depositStatement"; id: string }
  | { kind: "leaseContract"; id: string }
  | { kind: "leasePreview"; id: string }
  | { kind: "inspectionReport"; id: string }
  | { kind: "leaseNotice"; id: string }
  | { kind: "file"; id: string; purpose?: string };

export interface ResolvedDocument {
  url: string;
  number: string | null;
  /** The URL is the BFF itself (same origin), not a signed storage URL. */
  local: boolean;
}

export async function resolveDocument(ref: DocumentRef): Promise<ResolvedDocument> {
  const api = browserApi();
  const signed = (answer: { url: string; number?: string | null }) => ({
    url: answer.url,
    number: answer.number ?? null,
    local: false,
  });
  switch (ref.kind) {
    case "invoice":
      return signed(
        await unwrap(
          api.GET("/v1/owner/invoices/{invoiceId}/document", {
            params: { path: { invoiceId: ref.id }, query: { paper: ref.paper } },
          }),
        ),
      );
    case "creditNote":
      return signed(
        await unwrap(api.GET("/v1/owner/credit-notes/{noteId}/document", { params: { path: { noteId: ref.id } } })),
      );
    case "debitNote":
      return signed(
        await unwrap(api.GET("/v1/owner/debit-notes/{noteId}/document", { params: { path: { noteId: ref.id } } })),
      );
    case "receipt":
      return signed(
        await unwrap(api.GET("/v1/owner/receipts/{receiptId}/document", { params: { path: { receiptId: ref.id } } })),
      );
    case "depositReceipt":
      return signed(
        await unwrap(api.GET("/v1/owner/deposits/{depositId}/receipt", { params: { path: { depositId: ref.id } } })),
      );
    case "depositStatement":
      return signed(
        await unwrap(api.GET("/v1/owner/deposits/{depositId}/statement", { params: { path: { depositId: ref.id } } })),
      );
    case "leaseContract":
      return signed(
        await unwrap(api.GET("/v1/owner/leases/{leaseId}/contract", { params: { path: { leaseId: ref.id } } })),
      );
    case "leasePreview":
      return { url: `/bff/v1/owner/leases/${encodeURIComponent(ref.id)}/contract-preview`, number: null, local: true };
    case "inspectionReport":
      return signed(
        await unwrap(
          api.GET("/v1/owner/inspections/{inspectionId}/report", { params: { path: { inspectionId: ref.id } } }),
        ),
      );
    case "leaseNotice":
      return signed(
        await unwrap(
          api.GET("/v1/owner/lease-notices/{noticeId}/document", { params: { path: { noticeId: ref.id } } }),
        ),
      );
    case "file": {
      const file = await unwrap(
        api.GET("/v1/owner/files/{fileId}", {
          params: { path: { fileId: ref.id }, query: ref.purpose ? { purpose: ref.purpose } : {} },
        }),
      );
      return { url: file.url, number: file.file.title, local: false };
    }
  }
}
