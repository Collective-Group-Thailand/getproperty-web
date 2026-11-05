import { compressImage } from "@/ui/lib/image";

/**
 * The visitor photo (JW4, D-315): compressed on the tablet to ≤ 600 KB JPEG (1280 px) and sent inline as base64
 * (`POST /v1/guard/visits/{id}/photo`, ≤ 2 MB) after the visit exists — or kept in the offline queue with it.
 */
export const VISIT_PHOTO = { maxDimension: 1280, maxBytes: 600 * 1024, mimeType: "image/jpeg" as const };
export const VISIT_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export interface VisitPhoto {
  contentBase64: string;
  mimeType: "image/jpeg";
  /** For the thumbnail on the form. */
  previewUrl: string;
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export async function preparePhoto(file: Blob): Promise<VisitPhoto | "too-large"> {
  const compressed = await compressImage(file, VISIT_PHOTO);
  if (compressed.size > VISIT_PHOTO_MAX_BYTES) return "too-large";
  return {
    contentBase64: await blobToBase64(compressed),
    mimeType: "image/jpeg",
    previewUrl: URL.createObjectURL(compressed),
  };
}
