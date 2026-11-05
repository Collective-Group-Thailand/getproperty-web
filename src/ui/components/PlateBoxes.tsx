"use client";

import { Icon } from "../icons";
import { IconChevronDown } from "../icons/glyphs/chevron-down";
import { cx as cn } from "../lib/cx";

export type PlatePart = "category" | "number" | "province";

export interface PlateBoxesProps {
  category: string;
  number: string;
  province: string;
  /** The part the keypad is typing into, or null when the keypad is closed. */
  active: PlatePart | null;
  onSelect: (part: PlatePart) => void;
  /** Copy from `src/i18n`: the three small labels and the empty readings. */
  labels: { category: string; number: string; province: string; provinceEmpty: string };
  /** Shown faintly while a box is empty (`1กข`, `4521`). */
  placeholders?: { category: string; number: string };
  errors?: Partial<Record<PlatePart, string>>;
  idPrefix: string;
  className?: string;
}

/**
 * The plate as it is printed (J-DESIGN §3 gate-tablet): two large boxes — category, number — in mono 28 px, and the
 * province beside them. Each box is a button that opens the plate keypad on that part (`active` frames it in brand
 * blue); nothing here opens the OS keyboard. Errors sit under the row, linked with `aria-describedby`.
 */
export function PlateBoxes({
  category,
  number,
  province,
  active,
  onSelect,
  labels,
  placeholders,
  errors,
  idPrefix,
  className,
}: PlateBoxesProps) {
  const box = (part: Exclude<PlatePart, "province">, value: string, placeholder: string | undefined, wide: boolean) => {
    const error = errors?.[part];
    return (
      <div className={cn("flex min-w-0 flex-col gap-1.5", wide ? "flex-[1.15]" : "flex-[0.9]")}>
        <span id={`${idPrefix}-${part}-label`} className="text-muted text-sm">
          {labels[part]}
        </span>
        <button
          type="button"
          onClick={() => onSelect(part)}
          aria-labelledby={`${idPrefix}-${part}-label ${idPrefix}-${part}-value`}
          aria-expanded={active === part}
          aria-describedby={error ? `${idPrefix}-${part}-error` : undefined}
          data-testid={`plate-${part}`}
          className={cn(
            "rounded-control bg-surface flex h-20 touch-manipulation items-center justify-center border-2 px-3",
            "duration-fast transition-colors",
            active === part
              ? "border-primary ring-primary/25 ring-4"
              : error
                ? "border-danger"
                : "border-border-strong",
          )}
        >
          <span
            id={`${idPrefix}-${part}-value`}
            className={cn(
              "font-mono text-2xl font-semibold tracking-wider tabular-nums",
              value ? "text-fg" : "text-subtle text-xl font-normal",
            )}
          >
            {value || placeholder || " "}
          </span>
        </button>
      </div>
    );
  };

  const provinceError = errors?.province;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-end gap-3 sm:flex-nowrap">
        {box("category", category, placeholders?.category, false)}
        {box("number", number, placeholders?.number, true)}
        <div className="flex min-w-[12rem] flex-[1.9] flex-col gap-1.5">
          <span id={`${idPrefix}-province-label`} className="text-muted text-sm">
            {labels.province}
          </span>
          <button
            type="button"
            onClick={() => onSelect("province")}
            aria-labelledby={`${idPrefix}-province-label ${idPrefix}-province-value`}
            aria-expanded={active === "province"}
            aria-describedby={provinceError ? `${idPrefix}-province-error` : undefined}
            data-testid="plate-province"
            className={cn(
              "rounded-control bg-surface flex h-20 touch-manipulation items-center justify-between gap-2 border-2 px-4 text-left",
              active === "province"
                ? "border-primary ring-primary/25 ring-4"
                : provinceError
                  ? "border-danger"
                  : "border-border",
            )}
          >
            <span
              id={`${idPrefix}-province-value`}
              className={cn("truncate text-lg", province ? "text-fg font-medium" : "text-muted")}
            >
              {province || labels.provinceEmpty}
            </span>
            <Icon icon={IconChevronDown} size={24} className="text-subtle" />
          </button>
        </div>
      </div>
      {(["category", "number", "province"] as const).map((part) =>
        errors?.[part] ? (
          <p key={part} id={`${idPrefix}-${part}-error`} className="text-danger-subtle-fg text-sm font-medium">
            {errors[part]}
          </p>
        ) : null,
      )}
    </div>
  );
}
