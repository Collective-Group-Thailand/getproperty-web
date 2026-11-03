"use client";

import { formatPeriodKey } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";

import { IconChevronLeft } from "../icons/glyphs/chevron-left";
import { IconChevronRight } from "../icons/glyphs/chevron-right";
import { cn } from "../lib/cn";
import { IconButton } from "./IconButton";
import { NativeSelect } from "./NativeSelect";

/**
 * The period of a report or a billing view, in the toolbar (REDESIGN-PROMPT §4.12): previous · month · next. Periods
 * are the API's keys (`YYYY-MM`), newest first; they read as people say them — `ต.ค. 2569`, `Oct 2026`.
 */
export function PeriodPicker({
  periods,
  value,
  onChange,
  locale,
  label,
  previousLabel,
  nextLabel,
  className,
}: {
  /** Newest first, from the API. */
  periods: string[];
  value: string;
  onChange: (period: string) => void;
  locale: Locale;
  /** Accessible name of the select ("รอบบิล"), from `src/i18n`. */
  label: string;
  previousLabel: string;
  nextLabel: string;
  className?: string;
}) {
  const index = periods.indexOf(value);
  const older = index >= 0 ? periods[index + 1] : undefined;
  const newer = index > 0 ? periods[index - 1] : undefined;
  return (
    <div className={cn("flex items-center gap-1", className)} data-testid="period-picker">
      <IconButton
        icon={IconChevronLeft}
        label={previousLabel}
        disabled={!older}
        onClick={() => older && onChange(older)}
        className="rtl:rotate-180"
      />
      <div className="w-40">
        <NativeSelect
          aria-label={label}
          inputSize="sm"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          options={periods.map((period) => ({ value: period, label: formatPeriodKey(period, locale) }))}
        />
      </div>
      <IconButton
        icon={IconChevronRight}
        label={nextLabel}
        disabled={!newer}
        onClick={() => newer && onChange(newer)}
        className="rtl:rotate-180"
      />
    </div>
  );
}
