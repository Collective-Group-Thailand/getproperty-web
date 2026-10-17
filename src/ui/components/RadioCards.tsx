"use client";

import { RadioGroup as RadioGroupPrimitive } from "radix-ui";

import { Icon, type IconGlyph } from "../icons";
import { cn } from "../lib/cn";
import { useFieldGroupProps } from "./Field";

export interface RadioCardOption {
  value: string;
  label: React.ReactNode;
  description?: React.ReactNode;
  icon?: IconGlyph;
  disabled?: boolean;
}

export interface RadioCardsProps {
  options: RadioCardOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  /** One column on a phone, `columns` from `md` up. */
  columns?: 1 | 2 | 3;
  className?: string;
}

/**
 * Choices big enough to tap (design-system.md §3): the plan picker, "which utility", "reading source".
 * One Radix RadioGroup, so arrow keys move between cards and only the chosen one is in the tab order.
 * Wrap in `<Field>` to name the group.
 */
export function RadioCards({ options, columns = 2, className, ...props }: RadioCardsProps) {
  const group = useFieldGroupProps();
  return (
    <RadioGroupPrimitive.Root
      {...group}
      className={cn("grid gap-3", columns === 2 && "md:grid-cols-2", columns === 3 && "md:grid-cols-3", className)}
      {...props}
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          disabled={option.disabled}
          className={cn(
            "border-border bg-surface rounded-card flex min-h-12 items-start gap-3 border p-4 text-start",
            "duration-fast ease-standard hover:bg-bg-subtle transition-colors",
            "data-[state=checked]:border-primary data-[state=checked]:bg-primary-subtle",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <span className="border-border-strong bg-surface mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border">
            <RadioGroupPrimitive.Indicator className="bg-primary block size-2.5 rounded-full" />
          </span>
          {option.icon ? <Icon icon={option.icon} className="text-primary mt-1 text-xl" /> : null}
          <span className="flex flex-col">
            <span className="font-medium">{option.label}</span>
            {option.description ? <span className="text-muted text-sm">{option.description}</span> : null}
          </span>
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
