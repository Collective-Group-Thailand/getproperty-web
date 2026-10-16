"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

import { Icon, type IconName } from "../icons";
import { cn } from "../lib/cn";

export interface SegmentOption {
  value: string;
  label: React.ReactNode;
  icon?: IconName;
}

export interface SegmentedControlProps {
  options: SegmentOption[];
  value: string;
  onValueChange: (value: string) => void;
  /** Accessible name for the group, from `src/i18n`. */
  label: string;
  size?: "md" | "lg";
  className?: string;
}

/** A view switch — list/map, electric/water, this month/last month — where exactly one is always on. */
export function SegmentedControl({
  options,
  value,
  onValueChange,
  label,
  size = "md",
  className,
}: SegmentedControlProps) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      value={value}
      onValueChange={(next) => next && onValueChange(next)}
      aria-label={label}
      className={cn("bg-bg-subtle rounded-control inline-flex p-1", className)}
    >
      {options.map((option) => (
        <ToggleGroupPrimitive.Item
          key={option.value}
          value={option.value}
          data-size={size}
          className={cn(
            "rounded-control text-muted flex items-center justify-center gap-2 px-3 font-medium whitespace-nowrap",
            "data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-card hover:text-fg",
            size === "md" ? "h-8 text-sm" : "h-11 text-base",
          )}
        >
          {option.icon ? <Icon name={option.icon} /> : null}
          {option.label}
        </ToggleGroupPrimitive.Item>
      ))}
    </ToggleGroupPrimitive.Root>
  );
}
