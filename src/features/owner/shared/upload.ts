"use client";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { sha256Hex } from "@/lib/api/sha256";
import type { Schemas } from "@/lib/api/types";

export interface UploadTarget {
  kind: Schemas["UploadKind"];
  scopeType: Schemas["DocumentScope"];
  scopeId?: string | null;
  title?: string | null;
}

/**
 * Uploads one file for the owner console (contract §3 "Files"): presign through the BFF → PUT to object
 * storage with exactly the headers the API signed → complete. Returns the `core.document` id the next
 * request references (evidence, utility invoice, unit import). Private files never get a public URL.
 */
export async function uploadOwnerFile(file: File, target: UploadTarget): Promise<Schemas["FileDto"]> {
  const signed = await unwrap(
    browserApi().POST("/v1/owner/files/presign", {
      body: {
        kind: target.kind,
        scopeType: target.scopeType,
        scopeId: target.scopeId ?? null,
        title: target.title ?? file.name,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        sha256: await sha256Hex(file),
      },
    }),
  );
  if (!signed.uploadUrl) {
    throw new ApiError(422, { code: "document.multipart_unsupported", title: "", detail: "" });
  }
  const put = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: signed.headers as Record<string, string>,
    body: file,
  });
  if (!put.ok) throw new ApiError(put.status, { code: "document.upload_failed", title: "", detail: "" });
  return unwrap(
    browserApi().POST("/v1/owner/files/{fileId}/actions/complete", {
      params: { path: { fileId: signed.file.id } },
      body: {},
    }),
  );
}

/**
 * Runs a request that reads an uploaded file's bytes (Excel import preview, utility bill prefill) and
 * repeats it while the API answers `document.scan_pending` — the worker scans each upload a moment after
 * `complete` (contract §3 "Files"), so the first try right after an upload can arrive before the scan.
 */
export async function whenScanned<T>(
  read: () => Promise<T>,
  options: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  const { attempts = 20, delayMs = 750 } = options;
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "document.scan_pending" || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
