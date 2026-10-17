"use client";

import { Select as SelectPrimitive } from "radix-ui";

import { Icon } from "../icons";
import { IconCheck } from "../icons/glyphs/check";
import { IconChevronDown } from "../icons/glyphs/chevron-down";
import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shown when nothing is selected, from `src/i18n`. */
  placeholder?: string;
  inputSize?: "sm" | "md" | "lg";
  disabled?: boolean;
  name?: string;
  className?: string;
}

/**
 * A single-choice list on Radix Select: typeahead, keyboard navigation and a listbox the screen
 * reader understands. For a list long enough to search, use `Combobox`.
 */
export function Select({ options, placeholder, inputSize = "md", className, disabled, ...props }: SelectProps) {
  const field = useFieldProps();
  return (
    <SelectPrimitive.Root disabled={disabled || field.disabled} {...props}>
      <SelectPrimitive.Trigger
        id={field.id}
        aria-describedby={field["aria-describedby"]}
        aria-invalid={field["aria-invalid"]}
        aria-required={field.required}
        data-size={inputSize}
        className={cn(
          controlVariants({ inputSize }),
          "data-[placeholder]:text-subtle flex items-center justify-between gap-2 text-start",
          className,
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <Icon icon={IconChevronDown} className="text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="border-border bg-surface-raised rounded-card shadow-overlay z-modal max-h-[min(60vh,20rem)] min-w-(--radix-select-trigger-width) overflow-hidden border"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className="rounded-control data-highlighted:bg-bg-subtle relative flex cursor-default items-center gap-2 py-2 ps-8 pe-3 text-base outline-none select-none data-disabled:opacity-50"
              >
                <SelectPrimitive.ItemIndicator className="absolute start-2">
                  <Icon icon={IconCheck} className="text-primary" />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
