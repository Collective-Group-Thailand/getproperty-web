"use client";

import { useRef } from "react";

import { Icon } from "../icons";
import { IconCamera } from "../icons/glyphs/camera";
import { IconScan } from "../icons/glyphs/scan";
import { cn } from "../lib/cn";
import { Button } from "./Button";

export interface CameraCaptureProps {
  /** Called with the chosen photo(s). Compression, the guide frame and multi-shot arrive in F4. */
  onCapture: (files: File[]) => void;
  label: string;
  hint?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * F0 stub of the staff camera (design-system.md §3): a rear-camera `<input type="file" capture>` behind
 * a 56-px button. F4 4.1 replaces the input with a live `getUserMedia` view, torch, a meter guide frame,
 * multi-shot and client-side compression; the prop contract stays.
 */
export function CameraCapture({ onCapture, label, hint, multiple = false, disabled, className }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onCapture(files);
          event.target.value = "";
        }}
      />
      <Button size="xl" block iconStart={IconCamera} disabled={disabled} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      {hint ? <p className="text-muted text-center text-sm">{hint}</p> : null}
    </div>
  );
}

export interface ScanButtonProps {
  /** Receives the decoded text (a QR payload or a serial). F4 wires a real decoder. */
  onScan: (value: string) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}

/** F0 stub of the QR / serial scanner used for device provisioning (F4 4.2). */
export function ScanButton({ onScan, label, disabled, className }: ScanButtonProps) {
  return (
    <Button
      variant="secondary"
      size="xl"
      block
      disabled={disabled}
      className={className}
      // The stub cannot decode yet; it surfaces the gap loudly instead of pretending.
      onClick={() => onScan("")}
    >
      <Icon icon={IconScan} />
      {label}
    </Button>
  );
}
