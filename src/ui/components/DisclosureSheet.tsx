"use client";

import { useState } from "react";

import { cn } from "../lib/cn";
import { LazySheet } from "./overlays";

export interface DisclosureSheetProps {
  /** The quiet text button that opens the sheet ("ดูเลขมิเตอร์"). */
  label: string;
  /** The sheet's title (its accessible name). */
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Close button name, from `src/i18n`. */
  closeLabel: string;
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Details that a reader opens on purpose (Stitch G2/G3: the meter readings behind a bill line): a quiet text button
 * in the line, the full detail in a bottom sheet — so a document reads as one muted line per item instead of a wall of
 * registers. Not for actions; one filled action per page stays outside.
 */
export function DisclosureSheet({
  label,
  title,
  description,
  closeLabel,
  children,
  className,
  testId,
}: DisclosureSheetProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        data-testid={testId}
        className={cn(
          "text-primary hover:text-primary-hover focus-visible:ring-focus-ring rounded-thumb -my-2 inline-flex min-h-11 items-center px-1 text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none",
          className,
        )}
      >
        {label}
      </button>
      <LazySheet
        open={open}
        onOpenChange={setOpen}
        title={title}
        description={description}
        closeLabel={closeLabel}
        side="bottom"
      >
        {children}
      </LazySheet>
    </>
  );
}
