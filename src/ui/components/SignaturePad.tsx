"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { IconDelete } from "../icons/glyphs/delete";
import { IconUndo } from "../icons/glyphs/undo";
import { IconUpload } from "../icons/glyphs/upload";
import { cn } from "../lib/cn";
import { Button } from "./Button";

type Point = { x: number; y: number };
type Stroke = Point[];

export interface SignaturePadLabels {
  /** Under the line ("เซ็นชื่อในกรอบ"). */
  placeholder: string;
  clear: string;
  undo: string;
  /** The dragging alternative (WCAG 2.5.7): choose a photo/scan of the signature. */
  upload: string;
}

export interface SignaturePadProps {
  /** Accessible name of the drawing area ("Resident's signature"). */
  label: string;
  labels: SignaturePadLabels;
  /** The signature as a PNG, or `null` when cleared. */
  onChange: (png: Blob | null) => void;
  /** A signature to start from (a draft kept on the device); drawn as the background. */
  initial?: Blob;
  /** CSS height of the pad (default 180 px); the width follows the container. */
  height?: number;
  disabled?: boolean;
  className?: string;
}

/** Draws strokes onto a canvas sized in device pixels (crisp on a 3× phone screen). */
function paint(canvas: HTMLCanvasElement, strokes: Stroke[], background: HTMLImageElement | ImageBitmap | null) {
  const context = canvas.getContext("2d");
  if (!context) return;
  const ratio = canvas.width / canvas.clientWidth || 1;
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (background) {
    const scale = Math.min(canvas.width / background.width, canvas.height / background.height);
    const w = background.width * scale;
    const h = background.height * scale;
    context.drawImage(background, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }
  context.scale(ratio, ratio);
  context.lineWidth = 2.5;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#111";
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    context.beginPath();
    context.moveTo(stroke[0]!.x, stroke[0]!.y);
    if (stroke.length === 1) context.lineTo(stroke[0]!.x + 0.1, stroke[0]!.y + 0.1);
    for (const point of stroke.slice(1)) context.lineTo(point.x, point.y);
    context.stroke();
  }
}

/**
 * A signature on the device (design-system.md §3 SignaturePad: draw, clear, undo, upload alternative) —
 * the inspector's and the resident's signatures on a move-in/move-out report (D-023). Pointer events
 * cover finger, stylus and mouse; `touch-action: none` keeps the page from scrolling while signing.
 * The PNG is black ink on a transparent background, small enough for the API's 200 KB limit.
 */
export function SignaturePad({
  label,
  labels,
  onChange,
  initial,
  height = 180,
  disabled,
  className,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef<Stroke | null>(null);
  const background = useRef<HTMLImageElement | ImageBitmap | null>(null);
  const [empty, setEmpty] = useState(!initial);
  const [canUndo, setCanUndo] = useState(Boolean(initial));
  const fileId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const redraw = useCallback(() => {
    if (canvasRef.current) paint(canvasRef.current, strokes.current, background.current);
  }, []);

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    const isEmpty = strokes.current.length === 0 && !background.current;
    setEmpty(isEmpty);
    setCanUndo(strokes.current.length > 0 || background.current !== null);
    if (!canvas || isEmpty) {
      onChangeRef.current(null);
      return;
    }
    canvas.toBlob((blob) => onChangeRef.current(blob), "image/png");
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      redraw();
    };
    resize();
    if (initial && typeof createImageBitmap === "function") {
      void createImageBitmap(initial).then((bitmap) => {
        background.current = bitmap;
        redraw();
      });
    }
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    observer?.observe(canvas);
    return () => observer?.disconnect();
    // The starting signature is read once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [redraw]);

  const at = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          data-testid="signature-pad"
          data-empty={empty}
          className={cn(
            "rounded-control bg-surface block w-full touch-none border-2 border-dashed",
            disabled ? "opacity-50" : "border-border-strong cursor-crosshair",
          )}
          style={{ height }}
          onPointerDown={(event) => {
            if (disabled) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drawing.current = [at(event)];
            strokes.current = [...strokes.current, drawing.current];
            redraw();
          }}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            drawing.current.push(at(event));
            redraw();
          }}
          onPointerUp={() => {
            if (!drawing.current) return;
            drawing.current = null;
            emit();
          }}
          onPointerCancel={() => {
            drawing.current = null;
            emit();
          }}
        />
        <span
          aria-hidden="true"
          className="border-border text-muted pointer-events-none absolute inset-x-6 bottom-8 border-b pt-1 text-xs"
        >
          <span className="relative top-5">{labels.placeholder}</span>
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="lg"
          iconStart={IconUndo}
          disabled={disabled || !canUndo}
          onClick={() => {
            if (strokes.current.length > 0) strokes.current = strokes.current.slice(0, -1);
            else background.current = null;
            redraw();
            emit();
          }}
        >
          {labels.undo}
        </Button>
        <Button
          variant="secondary"
          size="lg"
          iconStart={IconDelete}
          disabled={disabled || empty}
          onClick={() => {
            strokes.current = [];
            background.current = null;
            redraw();
            emit();
          }}
        >
          {labels.clear}
        </Button>
        <input
          ref={fileRef}
          id={fileId}
          type="file"
          tabIndex={-1}
          aria-hidden="true"
          accept="image/png,image/jpeg"
          className="sr-only"
          disabled={disabled}
          data-testid="signature-upload"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            background.current = await createImageBitmap(file);
            strokes.current = [];
            redraw();
            emit();
          }}
        />
        <Button
          variant="ghost"
          size="lg"
          iconStart={IconUpload}
          disabled={disabled}
          onClick={() => fileRef.current?.click()}
        >
          {labels.upload}
        </Button>
      </div>
    </div>
  );
}

/** Base64 (no `data:` prefix) of a blob — the shape `InspectionCompleteDto.*SignaturePng` takes. */
export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}
