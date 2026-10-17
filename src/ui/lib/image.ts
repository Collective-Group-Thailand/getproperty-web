/**
 * Client-side photo compression for the staff PWA and the resident app (design-system.md §3 CameraCapture):
 * a photo is scaled so its longer side is at most `maxDimension` and re-encoded as JPEG, lowering the
 * quality until it fits `maxBytes`. A phone camera's 4–8 MB original becomes a few hundred KB before it
 * is queued (IndexedDB) or uploaded on 4G — the evidence stays readable (a meter register, a scratch on
 * a wall), the upload stays cheap.
 *
 * Works on `HTMLCanvasElement` (every browser) or `OffscreenCanvas`; the source can be a `Blob` (file
 * input, an earlier shot) or anything `drawImage` takes (a `<video>` frame).
 */

export interface CompressOptions {
  /** Longer side in CSS pixels after scaling (default 1600). */
  maxDimension?: number;
  /** Upper bound of the encoded file (default 400 KB). */
  maxBytes?: number;
  /** First JPEG quality tried (default 0.82); lowered in steps of 0.08 down to `minQuality`. */
  quality?: number;
  /** Lowest quality before the image is scaled down further instead (default 0.5). */
  minQuality?: number;
  mimeType?: "image/jpeg" | "image/webp";
}

export const PHOTO_DEFAULTS: Required<CompressOptions> = {
  maxDimension: 1600,
  maxBytes: 400 * 1024,
  quality: 0.82,
  minQuality: 0.5,
  mimeType: "image/jpeg",
};

/** The scaled size that keeps the aspect ratio and fits `maxDimension` (never upscales). */
export function fitWithin(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const longer = Math.max(width, height);
  if (longer <= maxDimension || longer === 0) return { width, height };
  const scale = maxDimension / longer;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** The qualities tried in order: `quality`, `quality − 0.08`, … ≥ `minQuality`. */
export function qualitySteps(quality: number, minQuality: number): number[] {
  const steps: number[] = [];
  for (let q = quality; q >= minQuality - 1e-9; q -= 0.08) steps.push(Math.round(q * 100) / 100);
  return steps.length ? steps : [minQuality];
}

type Drawable = CanvasImageSource & { width?: number; height?: number };

function sourceSize(source: Drawable): { width: number; height: number } {
  if (typeof HTMLVideoElement !== "undefined" && source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  return { width: Number(source.width ?? 0), height: Number(source.height ?? 0) };
}

async function decode(blob: Blob): Promise<{ source: Drawable; release: () => void }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
    return { source: bitmap, release: () => bitmap.close() };
  }
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await image.decode();
  return { source: image, release: () => URL.revokeObjectURL(url) };
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("encode failed"))), type, quality),
  );
}

/**
 * Draws `source` scaled into a canvas and encodes it under `maxBytes` (quality first, then size). The
 * result is never larger than the original blob when one is given: an already small JPEG is kept.
 */
export async function compressImage(source: Blob | Drawable, options: CompressOptions = {}): Promise<Blob> {
  const settings = { ...PHOTO_DEFAULTS, ...options };
  const decoded = source instanceof Blob ? await decode(source) : { source, release: () => undefined };
  try {
    const original = sourceSize(decoded.source);
    let target = fitWithin(original.width, original.height, settings.maxDimension);
    const canvas = document.createElement("canvas");
    let best: Blob | null = null;
    for (let round = 0; round < 4; round += 1) {
      canvas.width = target.width;
      canvas.height = target.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d context");
      context.imageSmoothingQuality = "high";
      context.drawImage(decoded.source, 0, 0, target.width, target.height);
      for (const quality of qualitySteps(settings.quality, settings.minQuality)) {
        const blob = await encode(canvas, settings.mimeType, quality);
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= settings.maxBytes) {
          return source instanceof Blob && source.size <= blob.size && source.type === settings.mimeType
            ? source
            : blob;
        }
      }
      target = fitWithin(target.width, target.height, Math.round(Math.max(target.width, target.height) * 0.75));
    }
    return best!;
  } finally {
    decoded.release();
  }
}

/** A `File` named for the upload (`meter-<time>.jpg`), keeping the compressed bytes. */
export function toFile(blob: Blob, baseName: string): File {
  const extension = blob.type === "image/webp" ? "webp" : blob.type === "image/png" ? "png" : "jpg";
  return new File([blob], `${baseName}.${extension}`, { type: blob.type || "image/jpeg", lastModified: Date.now() });
}
