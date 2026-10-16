"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";
import { useReturnFocus } from "../lib/useReturnFocus";
import { IconButton } from "./IconButton";

const sheetVariants = cva(
  [
    "fixed z-modal flex flex-col overflow-hidden border-border bg-surface-raised shadow-overlay",
    "motion-safe:duration-slow motion-safe:ease-standard",
  ],
  {
    variants: {
      side: {
        /** The tenant's QR pay sheet, the staff's reading detail: slides up, respects the home indicator. */
        bottom: "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-panel border-t pb-[env(safe-area-inset-bottom)]",
        /** The owner's filters and detail panes on a desktop. */
        right: "inset-y-0 end-0 h-dvh w-[min(100vw,28rem)] border-s",
      },
    },
    defaultVariants: { side: "bottom" },
  },
);

export interface SheetProps extends VariantProps<typeof sheetVariants> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Becomes the sheet's accessible name. */
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Accessible name for the close button, from `src/i18n`. */
  closeLabel: string;
  className?: string;
}

/**
 * A sheet: a dialog anchored to an edge (design-system.md §3). The bottom variant is the tenant's and
 * staff's default overlay — thumb-reachable, with a grab handle, never hover-dependent. Focus trap,
 * Escape and scrim close come from Radix Dialog.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel,
  side,
  className,
}: SheetProps) {
  const returnFocus = useReturnFocus();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="z-overlay bg-overlay fixed inset-0" />
        <DialogPrimitive.Content {...returnFocus} className={cn(sheetVariants({ side }), className)}>
          {side !== "right" ? (
            <div aria-hidden="true" className="bg-border-strong mx-auto mt-2 h-1 w-10 rounded-full" />
          ) : null}
          <div className="flex items-start justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-muted mt-0.5 text-sm">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            <DialogPrimitive.Close asChild>
              <IconButton name="close" label={closeLabel} size="md" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
          {footer ? <div className="border-border flex flex-col gap-2 border-t px-5 py-3">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
