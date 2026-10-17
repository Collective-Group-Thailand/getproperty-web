"use client";

import { useState } from "react";

import { IconAdd } from "../icons/glyphs/add";
import { IconRemove } from "../icons/glyphs/remove";
import { cn } from "../lib/cn";
import { IconButton } from "./IconButton";

export interface ImageViewerProps {
  src: string;
  /** What the picture shows ("สลิปโอนเงิน ห้อง A-201") — required, it is evidence (design-system.md §6). */
  alt: string;
  labels: { zoomIn: string; zoomOut: string; zoom: (percent: number) => string };
  className?: string;
  "data-testid"?: string;
}

const STEPS = [1, 1.5, 2, 3, 4];

/**
 * Evidence at full size with zoom (slips, meter photos, inspection photos — design-system.md §3
 * "SlipViewer"): buttons rather than pinch only, the zoomed picture scrolls inside its frame, and the
 * current zoom is announced.
 */
export function ImageViewer({ src, alt, labels, className, "data-testid": testId }: ImageViewerProps) {
  const [step, setStep] = useState(0);
  const zoom = STEPS[step]!;
  return (
    <div className={cn("flex flex-col gap-2", className)} data-testid={testId} data-zoom={zoom}>
      {/* Focusable so the zoomed picture can be scrolled with the keyboard (WCAG 2.1.1). */}
      <div
        className="border-border bg-bg-subtle max-h-[70vh] overflow-auto rounded-md border"
        tabIndex={0}
        role="region"
        aria-label={alt}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed, short-lived URL (contract §3), not an optimisable asset */}
        <img
          src={src}
          alt={alt}
          style={{ width: `${zoom * 100}%`, maxWidth: "none" }}
          className="block h-auto"
          draggable={false}
        />
      </div>
      <div className="flex items-center gap-2">
        <IconButton
          icon={IconRemove}
          label={labels.zoomOut}
          size="sm"
          variant="secondary"
          disabled={step === 0}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
        />
        <span className="text-muted min-w-16 text-center text-sm tabular-nums" aria-live="polite">
          {labels.zoom(Math.round(zoom * 100))}
        </span>
        <IconButton
          icon={IconAdd}
          label={labels.zoomIn}
          size="sm"
          variant="secondary"
          disabled={step === STEPS.length - 1}
          onClick={() => setStep((current) => Math.min(STEPS.length - 1, current + 1))}
        />
      </div>
    </div>
  );
}
