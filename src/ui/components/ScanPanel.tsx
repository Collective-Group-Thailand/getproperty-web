"use client";

import { useEffect, useId, useRef, useState } from "react";

import { IconClose } from "../icons/glyphs/close";
import { cn } from "../lib/cn";
import { Button } from "./Button";

export interface ScanPanelLabels {
  /** Accessible name of the live view. */
  viewfinder: string;
  /** Under the view: "Point at the QR on the label". */
  aim: string;
  /** Label of the typed alternative ("Serial number"). */
  manualLabel: string;
  /** Submits the typed value ("Use this serial"). */
  manualSubmit: string;
  cancel: string;
  /** Shown while the camera starts. */
  starting: string;
  /** No detector on this browser / no camera: type the serial. */
  unsupported: string;
}

export const DEFAULT_FORMATS = ["qr_code", "code_128", "code_39", "data_matrix", "ean_13"];

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
interface BarcodeDetectorClass {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/** The platform detector class, if this browser has one (`BarcodeDetector`, Shape Detection API). */
export function barcodeDetectorClass(scope: unknown = globalThis): BarcodeDetectorClass | null {
  const candidate = (scope as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
  return typeof candidate === "function" ? candidate : null;
}

/** The wanted formats this detector supports (all wanted ones when it cannot tell). */
export async function supportedFormats(detector: BarcodeDetectorClass, wanted: string[]): Promise<string[]> {
  if (!detector.getSupportedFormats) return wanted;
  const supported = new Set(await detector.getSupportedFormats());
  return wanted.filter((format) => supported.has(format));
}

/**
 * Polls `detect` every `intervalMs` until a non-empty value is found or `signal` aborts. A failing
 * frame (not decoded yet, video not ready) is just the next try.
 */
export async function scanUntilFound(
  detect: () => Promise<DetectedBarcode[]>,
  signal: AbortSignal,
  intervalMs = 250,
): Promise<string | null> {
  while (!signal.aborted) {
    try {
      const found = (await detect()).map((code) => code.rawValue.trim()).find((value) => value.length > 0);
      if (found) return found;
    } catch {
      // keep trying
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return null;
}

const canScan = () =>
  barcodeDetectorClass() !== null &&
  typeof navigator !== "undefined" &&
  typeof navigator.mediaDevices?.getUserMedia === "function";

/** The scanner itself: camera + detector when available, the typed serial always. Loaded by `ScanButton`. */
export function ScanPanel({
  labels,
  formats = DEFAULT_FORMATS,
  onValue,
  onCancel,
}: {
  labels: ScanPanelLabels;
  formats?: string[];
  onValue: (value: string) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"starting" | "scanning" | "manual">(() => (canScan() ? "starting" : "manual"));
  const [typed, setTyped] = useState("");
  const inputId = useId();
  const onValueRef = useRef(onValue);
  useEffect(() => {
    onValueRef.current = onValue;
  });

  useEffect(() => {
    const controller = new AbortController();
    let stream: MediaStream | null = null;
    const Detector = barcodeDetectorClass();
    const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    if (!Detector || !media?.getUserMedia) return;
    void (async () => {
      try {
        const usable = await supportedFormats(Detector, formats);
        if (usable.length === 0) throw new Error("no supported format");
        const detector = new Detector({ formats: usable });
        stream = await media.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
        if (controller.signal.aborted) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play().catch(() => undefined);
        setMode("scanning");
        const value = await scanUntilFound(() => detector.detect(video), controller.signal);
        if (value) onValueRef.current(value);
      } catch {
        if (!controller.signal.aborted) setMode("manual");
      }
    })();
    return () => {
      controller.abort();
      for (const track of stream?.getTracks() ?? []) track.stop();
    };
  }, [formats]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = typed.trim();
    if (value) onValue(value);
  };

  return (
    <div className="flex flex-col gap-3" data-testid="scan-panel" data-mode={mode}>
      {mode !== "manual" ? (
        <div className="rounded-card relative overflow-hidden bg-black" style={{ aspectRatio: "1 / 1" }}>
          <video
            ref={videoRef}
            muted
            playsInline
            aria-label={labels.viewfinder}
            className={cn("absolute inset-0 size-full object-cover", mode !== "scanning" && "invisible")}
          />
          <div
            aria-hidden="true"
            className="rounded-control pointer-events-none absolute start-1/2 top-1/2 aspect-square w-[64%] -translate-x-1/2 -translate-y-1/2 border-4 border-white shadow-[0_0_0_9999px_rgb(0_0_0/0.45)]"
          />
          <p className="rounded-control absolute inset-x-3 bottom-3 bg-black/60 px-3 py-2 text-center text-white">
            {mode === "starting" ? labels.starting : labels.aim}
          </p>
        </div>
      ) : (
        <p className="text-muted" role="status">
          {labels.unsupported}
        </p>
      )}
      <form onSubmit={submit} className="flex flex-col gap-2">
        <label htmlFor={inputId} className="text-sm font-medium">
          {labels.manualLabel}
        </label>
        <input
          id={inputId}
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="rounded-control border-border-strong bg-surface h-14 border px-4 font-mono text-lg"
          data-testid="scan-manual"
        />
        <Button type="submit" size="xl" block disabled={typed.trim().length === 0}>
          {labels.manualSubmit}
        </Button>
      </form>
      <Button variant="ghost" size="lg" iconStart={IconClose} onClick={onCancel}>
        {labels.cancel}
      </Button>
    </div>
  );
}
