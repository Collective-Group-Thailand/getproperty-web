"use client";

import { useId } from "react";

import { Icon } from "../icons";
import { IconBackspace } from "../icons/glyphs/backspace";
import { cn } from "../lib/cn";

export type KeypadKey = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "." | "backspace" | "clear";

export interface DecimalLimits {
  /** Digits before the decimal point (contract registers: 9). */
  maxIntegerDigits?: number;
  /** Digits after it (meter registers: 3); 0 = whole numbers only. */
  maxDecimals?: number;
}

/**
 * One key applied to a decimal string, as typed on the keypad: no leading zeros ("007" → "7"), one
 * decimal point, at most `maxIntegerDigits` + `maxDecimals` digits. A key that would break a limit is
 * ignored rather than clipped, so the value on screen is always exactly what was typed.
 */
export function applyKey(value: string, key: KeypadKey, limits: DecimalLimits = {}): string {
  const maxInt = limits.maxIntegerDigits ?? 9;
  const maxDec = limits.maxDecimals ?? 3;
  if (key === "clear") return "";
  if (key === "backspace") return value.slice(0, -1);
  const [integer = "", decimals] = value.split(".");
  if (key === ".") {
    if (maxDec === 0 || decimals !== undefined) return value;
    return `${integer || "0"}.`;
  }
  if (decimals !== undefined) return decimals.length >= maxDec ? value : `${value}${key}`;
  if (integer === "0") return key;
  return integer.length >= maxInt ? value : `${integer}${key}`;
}

/** A pasted or physically typed string reduced to what the keypad would have produced. */
export function sanitizeDecimal(raw: string, limits: DecimalLimits = {}): string {
  let value = "";
  for (const char of raw.replace(/,/g, "")) {
    if (/[0-9.]/.test(char)) value = applyKey(value, char as KeypadKey, limits);
  }
  return value;
}

/** A complete decimal string (no trailing point) — what the API's `^\d{1,9}(\.\d{1,3})?$` accepts. */
export function isCompleteDecimal(value: string, limits: DecimalLimits = {}): boolean {
  const maxInt = limits.maxIntegerDigits ?? 9;
  const maxDec = limits.maxDecimals ?? 3;
  const pattern =
    maxDec > 0 ? new RegExp(`^\\d{1,${maxInt}}(\\.\\d{1,${maxDec}})?$`) : new RegExp(`^\\d{1,${maxInt}}$`);
  return pattern.test(value);
}

export interface NumericKeypadProps extends DecimalLimits {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the value field (e.g. "Meter reading"). */
  label: string;
  /** Shown after the value (`kWh`, `m³`). */
  unit?: string;
  /** Copy for the keys, from `src/i18n`. */
  labels: { backspace: string; decimal: string };
  hint?: React.ReactNode;
  error?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

const DIGITS: KeypadKey[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * The staff keypad for registers (design-system.md §5: "numeric keypad instead of the OS keyboard"):
 * a large read-out (tabular figures) above twelve 64-px keys — usable with gloves, one-handed, in the
 * sun. The read-out is a real text field with `inputmode="none"`, so a phone shows no OS keyboard while
 * a hardware keyboard, paste and screen readers still work; every path goes through `applyKey`.
 */
export function NumericKeypad({
  value,
  onChange,
  label,
  unit,
  labels,
  hint,
  error,
  disabled,
  maxIntegerDigits,
  maxDecimals,
  className,
}: NumericKeypadProps) {
  const id = useId();
  const limits = { maxIntegerDigits, maxDecimals };
  const press = (key: KeypadKey) => onChange(applyKey(value, key, limits));
  const described = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(" ") || undefined;

  const key = (k: KeypadKey, content: React.ReactNode, aria?: string) => (
    <button
      key={k}
      type="button"
      disabled={disabled}
      aria-label={aria}
      onClick={() => press(k)}
      className={cn(
        "rounded-control bg-bg-subtle text-fg flex h-16 items-center justify-center text-2xl font-semibold tabular-nums",
        "hover:bg-border active:bg-border-strong disabled:opacity-50",
        "duration-fast touch-manipulation transition-colors select-none",
      )}
    >
      {content}
    </button>
  );

  return (
    <div className={cn("flex flex-col gap-3", className)} data-testid="numeric-keypad">
      <label htmlFor={id} className="text-muted text-sm font-medium">
        {label}
      </label>
      <div
        className={cn(
          "rounded-control bg-surface flex min-h-16 items-baseline gap-2 border-2 px-4",
          error ? "border-danger" : "border-border-strong focus-within:border-primary",
        )}
      >
        <input
          id={id}
          value={value}
          inputMode="none"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          onChange={(event) => onChange(sanitizeDecimal(event.target.value, limits))}
          className="text-fg min-w-0 flex-1 bg-transparent py-3 font-mono text-4xl font-semibold tabular-nums outline-none"
          data-testid="keypad-value"
        />
        {unit ? <span className="text-muted text-lg">{unit}</span> : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-muted text-sm">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-danger-subtle-fg text-sm font-medium" role="alert">
          {error}
        </p>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        {DIGITS.map((digit) => key(digit, digit))}
        {key(".", ".", labels.decimal)}
        {key("0", "0")}
        {key("backspace", <Icon icon={IconBackspace} size={28} />, labels.backspace)}
      </div>
    </div>
  );
}
