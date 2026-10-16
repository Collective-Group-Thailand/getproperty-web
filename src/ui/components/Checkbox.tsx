"use client";

import { useId } from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { Icon } from "../icons";
import { cn } from "../lib/cn";

export interface CheckboxProps {
  label: React.ReactNode;
  description?: React.ReactNode;
  checked?: boolean | "indeterminate";
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean | "indeterminate") => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  value?: string;
  className?: string;
}

/** A checkbox with its label as one 44-px-tall target; `indeterminate` for a "select all" header. */
export function Checkbox({ label, description, className, disabled, ...props }: CheckboxProps) {
  const id = useId();
  const descriptionId = description ? `${id}-description` : undefined;
  return (
    <div className={cn("flex items-start gap-3", disabled && "opacity-50", className)}>
      <CheckboxPrimitive.Root
        id={id}
        disabled={disabled}
        aria-describedby={descriptionId}
        className="border-border-strong bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-sm border"
        {...props}
      >
        <CheckboxPrimitive.Indicator className="text-primary-fg">
          {props.checked === "indeterminate" ? <Icon name="remove" size={14} /> : <Icon name="check" size={14} />}
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      <div className="min-h-6 leading-6">
        <label htmlFor={id} className="text-base">
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-muted text-sm">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}
