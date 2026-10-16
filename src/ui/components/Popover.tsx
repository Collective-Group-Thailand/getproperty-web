"use client";

import { Popover as PopoverPrimitive } from "radix-ui";

import { cn } from "../lib/cn";

export interface PopoverProps {
  trigger: React.ReactElement;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/** Contextual help ("ค่า Ft คืออะไร?"), a small form, a legend — anchored to its trigger. */
export function Popover({ trigger, children, align = "center", side = "bottom", className, ...props }: PopoverProps) {
  return (
    <PopoverPrimitive.Root {...props}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            "border-border bg-surface-raised rounded-card shadow-overlay z-modal w-72 border p-4 text-sm",
            className,
          )}
        >
          {children}
          <PopoverPrimitive.Arrow className="fill-surface-raised" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
