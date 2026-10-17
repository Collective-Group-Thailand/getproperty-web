"use client";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";

async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

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
