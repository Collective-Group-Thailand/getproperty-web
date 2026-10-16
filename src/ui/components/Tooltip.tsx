"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";

export const TooltipProvider = TooltipPrimitive.Provider;

export interface TooltipProps {
  /** Short text; a tooltip is never the only way to learn something (no hover-only on tenant/staff). */
  content: React.ReactNode;
  children: React.ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}

/** The absolute time behind a relative one, a unit behind an abbreviation. Shown on hover and focus. */
export function Tooltip({ content, children, side = "top" }: TooltipProps) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="bg-neutral text-neutral-fg rounded-control shadow-raised z-toast max-w-xs px-3 py-1.5 text-sm"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-neutral" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
