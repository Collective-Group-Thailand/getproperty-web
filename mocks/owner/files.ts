import { http, type HttpHandler } from "msw";

import type { components } from "../../src/lib/api/schema";
import { state } from "../state";
import { body, json, mutating, notFound, owner, problem, validation } from "./support";
import { BUILDING_A, iso } from "./world";

type Schemas = components["schemas"];

/**
 * Owner file uploads (contract §3 "Files"): presign → PUT to this server's `/__upload/<id>` (shared with
 * the staff world's object-storage stand-in) → complete; downloads are short-lived URLs on `/__files/`.
 * ID documents need `party.id_document.read` (Owner, Manager — D-172).
 */
const PHOTO_KINDS = new Set<Schemas["UploadKind"]>(["meter_photo", "inspection_photo", "service_photo"]);

export const fileHandlers: HttpHandler[] = [
  http.post("*/v1/owner/files/presign", async ({ request }) => {
    const op = "owner.files.presign";
    const ok = mutating(request, op);
    if (ok instanceof Response) return ok;
    const input = await body<Partial<Schemas["FilePresignDto"]>>(request);
    if (!input.kind || !input.fileName || !input.mimeType || !input.sizeBytes || !input.sha256 || !input.scopeType)
      return validation(op, "body", "kind, scopeType, fileName, mimeType, sizeBytes and sha256 are required");
    if (PHOTO_KINDS.has(input.kind) && !/^image\/(jpeg|png|webp)$/.test(input.mimeType))
      return problem(op, "document.type_not_allowed");
    const origin = new URL(request.url).origin;
    const file: Schemas["FileDto"] = {
      id: crypto.randomUUID(),
      kind: input.kind,
      scopeType: input.scopeType,
      scopeId: input.scopeId ?? null,
      buildingId: BUILDING_A,
      title: input.title ?? input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      width: null,
      height: null,
      retentionClass: input.kind,
      scanStatus: "pending",
      uploadState: "presigned",
      createdAt: iso(),
    };
    state.staff.files.set(file.id, { file, bytes: null });
    return json(
      {
        file,
        uploadUrl: `${origin}/__upload/${file.id}`,
        headers: { "Content-Type": input.mimeType },
        multipart: null,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      } satisfies Schemas["FilePresignedDto"],
      201,
    );
  }),
  http.post("*/v1/owner/files/:fileId/actions/complete", ({ request, params }) => {
    const op = "owner.files.complete";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const stored = state.staff.files.get(String(params.fileId));
    if (!stored) return notFound(op);
    if (!stored.bytes) return problem(op, "document.not_uploaded");
    if (stored.bytes.byteLength !== stored.file.sizeBytes) return problem(op, "document.size_mismatch");
    stored.file = { ...stored.file, uploadState: "verified", scanStatus: "clean" };
    return json(stored.file);
  }),
  http.get("*/v1/owner/files/:fileId", ({ request, params }) => {
    const op = "owner.files.get";
    const ok = owner(request, op);
    if (ok instanceof Response) return ok;
    const fileId = String(params.fileId);
    // the landlord persona's generated documents (B7.5) open too; anything else of another tenant is a 404
    if (!ok.own && !fileId.endsWith("0a4d")) return notFound(op);
    const origin = new URL(request.url).origin;
    const stored = state.staff.files.get(fileId);
    if (stored && stored.file.uploadState === "presigned") return problem(op, "document.not_uploaded");
    // Seeded evidence (meter photos, inspection photos, slips) has no upload: a placeholder picture;
    // the billing documents archive (invoice and receipt PDFs) answers a placeholder PDF.
    const financial = fileId.endsWith("0a4d") || state.owner.receipts.some((receipt) => receipt.id === fileId);
    const file: Schemas["FileDto"] = stored?.file ?? {
      id: fileId,
      kind: financial ? "pdf_invoice" : "meter_photo",
      scopeType: "unit",
      scopeId: null,
      buildingId: BUILDING_A,
      title: null,
      mimeType: financial ? "application/pdf" : "image/svg+xml",
      sizeBytes: 1,
      width: 300,
      height: 200,
      retentionClass: "meter_photo",
      scanStatus: "clean",
      uploadState: "verified",
      createdAt: iso(-1),
    };
    const pdf = file.mimeType === "application/pdf";
    return json({
      file,
      url: `${origin}/__files/${pdf ? `pdf-${fileId}` : fileId}`,
      thumbnailUrl: pdf ? null : `${origin}/__files/${fileId}`,
      expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
    } satisfies Schemas["FileDownloadDto"]);
  }),
];
