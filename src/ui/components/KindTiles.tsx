"use client";

import { useRef } from "react";

import { Icon, type IconGlyph } from "../icons";
import { cx as cn } from "../lib/cx";

export interface KindTileOption {
  value: string;
  label: string;
  icon: IconGlyph;
}

export interface KindTilesProps {
  options: readonly KindTileOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  /** The group's accessible name ("ประเภทการติดต่อ"). */
  label: string;
  /** Points at an error under the group. */
  describedBy?: string;
  className?: string;
}

/**
 * Large icon + word tiles for one choice (J-DESIGN §3: five kind tiles on the gate tablet). 64-px minimum height,
 * an 8-px gap, the selected tile framed in brand blue on the pale tint. A WAI-ARIA radio group: Tab reaches the
 * checked tile, arrows move and check (like `SegmentedControl`), and a tap is all a gloved hand needs.
 */
export function KindTiles({ options, value, onValueChange, label, describedBy, className }: KindTilesProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = options.findIndex((option) => option.value === value);
  const move = (event: React.KeyboardEvent, index: number) => {
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    refs.current[next]?.focus();
    onValueChange(options[next]!.value);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-describedby={describedBy}
      className={cn("grid grid-cols-[repeat(auto-fit,minmax(6.25rem,1fr))] gap-2", className)}
    >
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (current < 0 && index === 0) ? 0 : -1}
            onClick={() => onValueChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            data-testid={`kind-${option.value}`}
            className={cn(
              "rounded-control flex min-h-20 touch-manipulation flex-col items-center justify-center gap-1.5 border-2 px-2 py-2 text-center",
              "duration-fast transition-colors",
              checked
                ? "border-primary bg-primary-subtle text-primary-subtle-fg font-semibold"
                : "border-border bg-surface text-fg active:bg-bg-subtle",
            )}
          >
            <Icon icon={option.icon} size={26} />
            <span className="text-base leading-tight">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
