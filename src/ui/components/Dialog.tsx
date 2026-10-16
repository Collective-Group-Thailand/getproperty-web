"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";
import { useReturnFocus } from "../lib/useReturnFocus";
import { IconButton } from "./IconButton";

const contentVariants = cva(
  [
    "fixed left-1/2 top-1/2 z-modal flex max-h-[min(90dvh,48rem)] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2",
    "flex-col overflow-hidden rounded-card border border-border bg-surface-raised shadow-overlay",
  ],
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-lg",
        lg: "max-w-3xl",
        xl: "max-w-5xl",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export interface DialogProps extends VariantProps<typeof contentVariants> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Becomes the dialog's accessible name. Required — an unnamed dialog is unusable. */
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Actions, right-aligned. The primary action goes last. */
  footer?: React.ReactNode;
  /**
   * Accessible name for the close button, from `src/i18n`. Omit it to hide the button, for a
   * dialog the user must answer.
   */
  closeLabel?: string;
  className?: string;
}

/**
 * A modal dialog on Radix: focus is trapped and restored, Escape and the scrim close it,
 * the rest of the page is `aria-hidden`, and body scroll is locked. None of that is
 * re-implemented per screen.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  closeLabel,
  size,
  className,
}: DialogProps) {
  const returnFocus = useReturnFocus();

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="z-overlay bg-overlay fixed inset-0" />
        <DialogPrimitive.Content
          {...returnFocus}
          className={cn(contentVariants({ size }), className)}
          // Without a close button, Escape and the scrim are the only ways out, so keep them.
          onInteractOutside={closeLabel ? undefined : (event) => event.preventDefault()}
        >
          <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
              <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
              {description ? (
                <DialogPrimitive.Description className="text-muted mt-0.5 text-sm">
                  {description}
                </DialogPrimitive.Description>
              ) : null}
            </div>
            {closeLabel ? (
              <DialogPrimitive.Close asChild>
                <IconButton name="close" label={closeLabel} size="sm" />
              </DialogPrimitive.Close>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <div className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>
          ) : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const DialogClose = DialogPrimitive.Close;
