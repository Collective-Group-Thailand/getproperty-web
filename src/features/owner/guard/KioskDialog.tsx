"use client";

import { useEffect, useRef } from "react";

import { Icon } from "@/ui/icons";
import { IconClose } from "@/ui/icons/glyphs/close";
import { cx as cn } from "@/ui/lib/cx";

export interface KioskDialogProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  /** The close button's name. */
  closeLabel: string;
  children: React.ReactNode;
  /** `sheet`: full width from the bottom (keypads, lists); `centre`: a confirmation. */
  variant?: "sheet" | "centre";
  footer?: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * The tablet's overlay (JW4): the native `<dialog>` in modal mode — focus kept inside, Esc closes, the page behind is
 * inert — with no overlay library in the `/gate` bundle (180 KB budget, D-179). A 64-px close target, never a
 * hover-only affordance.
 */
export function KioskDialog({
  open,
  onClose,
  title,
  closeLabel,
  children,
  variant = "centre",
  footer,
  className,
  testId,
}: KioskDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby={testId ? `${testId}-title` : undefined}
      data-testid={testId}
      className={cn(
        "bg-surface text-fg shadow-overlay backdrop:bg-overlay m-auto max-h-[92dvh] p-0",
        variant === "sheet"
          ? "rounded-panel mb-0 w-full max-w-none sm:mb-auto sm:max-w-[min(72rem,96vw)]"
          : "rounded-panel w-[min(36rem,94vw)]",
        className,
      )}
    >
      {open ? (
        <div className="flex max-h-[92dvh] flex-col">
          <header className="border-border flex items-center justify-between gap-4 border-b px-6 py-3">
            <h2 id={testId ? `${testId}-title` : undefined} className="text-xl font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="rounded-control hover:bg-bg-subtle active:bg-border -me-2 flex size-14 items-center justify-center"
            >
              <Icon icon={IconClose} size={28} />
            </button>
          </header>
          <div className="relative min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer ? (
            <footer className="border-border flex flex-wrap justify-end gap-3 border-t px-6 py-4">{footer}</footer>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
