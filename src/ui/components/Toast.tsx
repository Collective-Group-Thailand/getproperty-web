"use client";

import { toast as sonnerToast, Toaster as SonnerToaster } from "sonner";

import { Icon } from "../icons";

/**
 * Toasts on sonner (design-system.md §3): a confirmation on the current page, with an undo where the
 * action is reversible. Styled through the tokens; mounted once per zone shell.
 */
export function Toaster({ position = "bottom-center" }: { position?: "bottom-center" | "top-right" | "bottom-right" }) {
  return (
    <SonnerToaster
      position={position}
      offset={16}
      mobileOffset={{ bottom: "calc(var(--bottom-nav-h) + 8px)" }}
      icons={{
        success: <Icon name="check-circle" className="text-success" />,
        error: <Icon name="alert" className="text-danger" />,
        warning: <Icon name="warning" className="text-warning" />,
        info: <Icon name="info" className="text-info" />,
        loading: <Icon name="spinner" className="animate-spin" />,
      }}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex w-full items-center gap-3 rounded-card border border-border bg-surface-raised p-4 text-sm text-fg shadow-overlay",
          title: "font-medium",
          description: "text-muted",
          actionButton:
            "ms-auto rounded-control bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover",
          cancelButton: "ms-auto rounded-control border border-border-strong px-3 py-1.5 text-sm",
        },
      }}
    />
  );
}

export const toast = sonnerToast;
