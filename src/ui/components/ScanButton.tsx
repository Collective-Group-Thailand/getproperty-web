"use client";

import { Suspense, useState } from "react";

import { IconScan } from "../icons/glyphs/scan";
import { cn } from "../lib/cn";
import { lazyWarm } from "../lib/lazy";
import { Button } from "./Button";
import type { ScanPanelLabels } from "./ScanPanel";

export type { ScanPanelLabels } from "./ScanPanel";

export interface ScanButtonProps {
  /** Receives the decoded text (a QR payload or a typed serial), trimmed and non-empty. */
  onScan: (value: string) => void;
  /** The button's name ("สแกน QR อุปกรณ์"). */
  label: string;
  labels: ScanPanelLabels;
  /** Barcode formats to look for (default QR, Code 128/39, Data Matrix, EAN-13). */
  formats?: string[];
  disabled?: boolean;
  className?: string;
}

const ScanPanel = lazyWarm(() => import("./ScanPanel").then((module) => module.ScanPanel));

/**
 * QR / serial scanner for device provisioning and meter binding (design-system.md §3 ScanButton). The
 * button opens a panel with the rear camera and the platform `BarcodeDetector` where the browser has
 * one (Chrome on Android, Safari 17+); everywhere else — and always as an alternative — the serial can
 * be typed. The panel (camera, detector loop) is downloaded on first use.
 */
export function ScanButton({ onScan, label, labels, formats, disabled, className }: ScanButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {open ? (
        <Suspense fallback={<p className="text-muted py-6 text-center">{labels.starting}</p>}>
          <ScanPanel
            labels={labels}
            formats={formats}
            onCancel={() => setOpen(false)}
            onValue={(value) => {
              setOpen(false);
              onScan(value);
            }}
          />
        </Suspense>
      ) : (
        <Button
          variant="secondary"
          size="xl"
          block
          iconStart={IconScan}
          disabled={disabled}
          onClick={() => setOpen(true)}
          data-testid="scan-button"
        >
          {label}
        </Button>
      )}
    </div>
  );
}
