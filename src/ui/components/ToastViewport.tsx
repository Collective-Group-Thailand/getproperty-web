"use client";

import { Toaster as SonnerToaster } from "sonner";

import { Icon } from "../icons";
import { IconAlert } from "../icons/glyphs/alert";
import { IconCheckCircle } from "../icons/glyphs/check-circle";
import { IconInfo } from "../icons/glyphs/info";
import { IconSpinner } from "../icons/glyphs/spinner";
import { IconWarning } from "../icons/glyphs/warning";

/**
 * The sonner viewport, styled through the tokens. Loaded by `<Toaster>` (./Toast) when the first toast
 * is shown (D-179) — import `Toaster` and `toast` from ./Toast, not this file.
 */
export function ToastViewport({
  position = "bottom-center",
}: {
  position?: "bottom-center" | "top-right" | "bottom-right";
}) {
  return (
    <SonnerToaster
      position={position}
      offset={16}
      mobileOffset={{ bottom: "calc(var(--bottom-nav-h) + 8px)" }}
      icons={{
        success: <Icon icon={IconCheckCircle} className="text-success" />,
        error: <Icon icon={IconAlert} className="text-danger" />,
        warning: <Icon icon={IconWarning} className="text-warning" />,
        info: <Icon icon={IconInfo} className="text-info" />,
        loading: <Icon icon={IconSpinner} className="animate-spin" />,
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
