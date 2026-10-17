"use client";

import { useRef } from "react";

import { Icon, type IconGlyph } from "../icons";
import { cn } from "../lib/cn";

export interface SegmentOption {
  value: string;
  label: React.ReactNode;
  icon?: IconGlyph;
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

/**
 * A view switch — list/map, electric/water, this month/last month — where exactly one is always on.
 *
 * A WAI-ARIA radio group written out here rather than on Radix (D-179): it sits on public pages and
 * sign-in screens, where Radix's collection/roving-focus code would be most of the page's own script.
 * Tab reaches the checked segment; arrow keys (and Home/End) move to and check a neighbour.
 */
export function SegmentedControl({
  options,
  value,
  onValueChange,
  label,
  size = "md",
  className,
}: SegmentedControlProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.findIndex((option) => option.value === value);

  const move = (event: React.KeyboardEvent, index: number) => {
    const last = options.length - 1;
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? last
          : event.key === "ArrowDown" || event.key === (rtl ? "ArrowLeft" : "ArrowRight")
            ? (index + 1) % options.length
            : event.key === "ArrowUp" || event.key === (rtl ? "ArrowRight" : "ArrowLeft")
              ? (index - 1 + options.length) % options.length
              : null;
    if (next === null) return;
    event.preventDefault();
    refs.current[next]?.focus();
    onValueChange(options[next]!.value);
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn("bg-bg-subtle rounded-control inline-flex p-1", className)}>
      {options.map((option, index) => {
        const checked = index === current;
        return (
          <button
            key={option.value}
            ref={(element) => {
              refs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            // Roving focus: only the checked segment (or the first, when none is) is in the tab order.
            tabIndex={checked || (current === -1 && index === 0) ? 0 : -1}
            data-state={checked ? "on" : "off"}
            data-size={size}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              "rounded-control text-muted flex items-center justify-center gap-2 px-3 font-medium whitespace-nowrap",
              "data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-card hover:text-fg",
              size === "md" ? "h-8 text-sm" : "h-11 text-base",
            )}
          >
            {option.icon ? <Icon icon={option.icon} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
