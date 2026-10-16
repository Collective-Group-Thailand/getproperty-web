"use client";

import { useId, useMemo, useState } from "react";
import { Popover as PopoverPrimitive } from "radix-ui";

import { formatDate, TIME_ZONE } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";

import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { IconButton } from "./IconButton";
import { controlVariants } from "./Input";

export interface DatePickerProps {
  /** ISO date `YYYY-MM-DD` (a calendar day, no time) or null. */
  value: string | null;
  onChange: (value: string | null) => void;
  locale?: Locale;
  /** From `src/i18n`: the trigger when empty, the calendar's labels. */
  placeholder?: string;
  labels: { calendar: string; previousMonth: string; nextMonth: string; today: string; clear: string };
  min?: string;
  max?: string;
  inputSize?: "sm" | "md" | "lg";
  className?: string;
}

const BE = 543;
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Today's calendar day in Bangkok, as `[year, month0, day]`. */
function bangkokToday(): [number, number, number] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date())
    .split("-")
    .map(Number) as [number, number, number];
  return [parts[0], parts[1] - 1, parts[2]];
}

/**
 * A calendar-day picker with **Buddhist-era display** for Thai (design-system.md §3) and ISO values:
 * what the API gets is `2026-09-17`, what the owner sees is `17 ก.ย. 2569`. A dialog-in-popover grid
 * (`role="grid"`), arrow keys move by day/week, Enter chooses, Escape closes. Thai holidays and date
 * ranges come with the lease wizard (F2).
 */
export function DatePicker({
  value,
  onChange,
  locale = "th",
  placeholder,
  labels,
  min,
  max,
  inputSize = "md",
  className,
}: DatePickerProps) {
  const field = useFieldProps();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [today] = useState(bangkokToday);
  const selected = value ? value.split("-").map(Number) : null;
  const [view, setView] = useState<[number, number]>(
    selected ? [selected[0]!, selected[1]! - 1] : [today[0], today[1]],
  );
  const [focusDay, setFocusDay] = useState<number>(selected ? selected[2]! : today[2]);

  const [year, month] = view;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const shownYear = locale === "th" ? year + BE : year;

  const monthName = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-ca-gregory" : "en-GB", {
        month: "long",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(year, month, 1))),
    [locale, year, month],
  );
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale === "th" ? "th-TH" : "en-GB", { weekday: "narrow", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i)))); // 2023-01-01 is a Sunday
  }, [locale]);

  const disabled = (day: string) => (min !== undefined && day < min) || (max !== undefined && day > max);
  const move = (delta: number) => {
    const next = new Date(Date.UTC(year, month, focusDay + delta));
    setView([next.getUTCFullYear(), next.getUTCMonth()]);
    setFocusDay(next.getUTCDate());
  };
  const shiftMonth = (delta: number) => {
    const next = new Date(Date.UTC(year, month + delta, 1));
    setView([next.getUTCFullYear(), next.getUTCMonth()]);
    setFocusDay(1);
  };
  const choose = (day: string) => {
    if (disabled(day)) return;
    onChange(day);
    setOpen(false);
  };

  const onGridKeyDown = (event: React.KeyboardEvent) => {
    const map: Record<string, () => void> = {
      ArrowRight: () => move(1),
      ArrowLeft: () => move(-1),
      ArrowDown: () => move(7),
      ArrowUp: () => move(-7),
      PageDown: () => shiftMonth(1),
      PageUp: () => shiftMonth(-1),
      Home: () => setFocusDay(1),
      End: () => setFocusDay(daysInMonth),
      Enter: () => choose(iso(year, month, focusDay)),
      " ": () => choose(iso(year, month, focusDay)),
    };
    const action = map[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        id={field.id}
        aria-describedby={field["aria-describedby"]}
        aria-invalid={field["aria-invalid"]}
        aria-required={field.required}
        disabled={field.disabled}
        data-size={inputSize}
        className={cn(
          controlVariants({ inputSize }),
          "flex items-center justify-between gap-2 text-start",
          !value && "text-subtle",
          className,
        )}
      >
        <span className="tabular-nums">{value ? formatDate(`${value}T00:00:00+07:00`, locale) : placeholder}</span>
        <Icon name="calendar" className="text-muted" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className="border-border bg-surface-raised rounded-card shadow-overlay z-modal w-80 border p-3"
          aria-label={labels.calendar}
        >
          <div className="mb-2 flex items-center justify-between">
            <IconButton name="chevron-left" label={labels.previousMonth} size="sm" onClick={() => shiftMonth(-1)} />
            <span id={`${id}-month`} className="font-medium" aria-live="polite">
              {monthName} {shownYear}
            </span>
            <IconButton name="chevron-right" label={labels.nextMonth} size="sm" onClick={() => shiftMonth(1)} />
          </div>
          <table
            role="grid"
            aria-labelledby={`${id}-month`}
            className="w-full table-fixed border-collapse text-center text-sm"
            onKeyDown={onGridKeyDown}
          >
            <thead>
              <tr>
                {weekdays.map((w, i) => (
                  <th key={i} scope="col" className="text-muted h-8 font-normal">
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) }, (_, row) => (
                <tr key={row}>
                  {Array.from({ length: 7 }, (_, col) => {
                    const day = row * 7 + col - firstWeekday + 1;
                    if (day < 1 || day > daysInMonth) return <td key={col} />;
                    const dayIso = iso(year, month, day);
                    const isSelected = dayIso === value;
                    const isToday = year === today[0] && month === today[1] && day === today[2];
                    return (
                      <td key={col} role="gridcell" aria-selected={isSelected} className="p-0.5">
                        <button
                          type="button"
                          tabIndex={day === focusDay ? 0 : -1}
                          disabled={disabled(dayIso)}
                          aria-current={isToday ? "date" : undefined}
                          ref={(el) => {
                            if (el && open && day === focusDay && document.activeElement?.closest("[role=grid]"))
                              el.focus();
                          }}
                          onClick={() => choose(dayIso)}
                          onFocus={() => setFocusDay(day)}
                          className={cn(
                            "rounded-control hover:bg-bg-subtle size-9 tabular-nums disabled:opacity-40",
                            isToday && "ring-border-strong ring-1 ring-inset",
                            isSelected && "bg-primary text-primary-fg hover:bg-primary-hover",
                          )}
                        >
                          {day}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-between text-sm">
            <button
              type="button"
              className="text-primary rounded-control px-2 py-1 underline-offset-4 hover:underline"
              onClick={() => choose(iso(...today))}
            >
              {labels.today}
            </button>
            <button
              type="button"
              className="text-muted rounded-control px-2 py-1 underline-offset-4 hover:underline"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              {labels.clear}
            </button>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
