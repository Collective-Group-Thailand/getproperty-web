"use client";

import { useId } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "../lib/cn";

export interface SwitchProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
}

/** An on/off setting that takes effect at once (a notification toggle). For a form value, use Checkbox. */
export function Switch({ label, description, className, disabled, ...props }: SwitchProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <div className={cn("flex items-center justify-between gap-4", disabled && "opacity-50", className)}>
      <div>
        <label htmlFor={id} className="text-base">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-muted text-sm">
            {description}
          </p>
        ) : null}
      </div>
      <SwitchPrimitive.Root
        id={id}
        disabled={disabled}
        aria-describedby={descriptionId}
        className="bg-border-strong data-[state=checked]:bg-primary duration-fast ease-standard relative h-7 w-12 shrink-0 rounded-full transition-colors"
        {...props}
      >
        <SwitchPrimitive.Thumb className="bg-surface shadow-card duration-fast ease-standard block size-6 translate-x-0.5 rounded-full transition-transform data-[state=checked]:translate-x-5.5" />
      </SwitchPrimitive.Root>
    </div>
  );
}
