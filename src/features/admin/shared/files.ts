"use client";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { sha256Hex } from "@/lib/api/sha256";
import type { Schemas } from "@/lib/api/types";

/**
 * Uploads one platform file (`/v1/admin/files`, D-214): presign through the BFF → PUT to object storage with
 * exactly the headers the API signed → complete. Returns the file the next request references (a tariff
 * version's `sourceDocumentId`). The virus scan follows; the file is downloadable once it is clean.
 */
export async function uploadPlatformFile(
  file: File,
  kind: Schemas["PlatformUploadKind"],
  title?: string | null,
): Promise<Schemas["FileDto"]> {
  const signed = await unwrap(
    browserApi().POST("/v1/admin/files/presign", {
      body: {
        kind,
        title: title ?? file.name,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        sha256: await sha256Hex(file),
      },
    }),
  );
  if (!signed.uploadUrl) throw new ApiError(422, { code: "document.multipart_unsupported", title: "", detail: "" });
  const put = await fetch(signed.uploadUrl, {
    method: "PUT",
    headers: signed.headers as Record<string, string>,
    body: file,
  });
  if (!put.ok) throw new ApiError(put.status, { code: "document.upload_failed", title: "", detail: "" });
  return unwrap(
    browserApi().POST("/v1/admin/files/{fileId}/actions/complete", {
      params: { path: { fileId: signed.file.id } },
      body: {},
    }),
  );
}

/** A 5-minute signed link to a clean platform file (`GET /v1/admin/files/{fileId}`; 409 while scanning). */
export function platformFileLink(fileId: string): Promise<Schemas["FileDownloadDto"]> {
  return unwrap(browserApi().GET("/v1/admin/files/{fileId}", { params: { path: { fileId } } }));
}
