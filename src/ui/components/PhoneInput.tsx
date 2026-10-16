"use client";

import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";

/** The country prefix shown before the field — decoration, not copy: `toE164` adds the real one. */
const PREFIX = "+66";

export interface PhoneInputProps {
  /** National digits as typed (`0812345678`); the caller sends `+66` E.164 to the API via `toE164`. */
  value: string;
  onChange: (national: string) => void;
  inputSize?: "sm" | "md" | "lg";
  disabled?: boolean;
  autoComplete?: "tel" | "tel-national" | "off";
  className?: string;
  name?: string;
}

/** `0812345678` → `+66812345678`; anything that is not a 9–10 digit Thai number comes back null. */
export function toE164(national: string): string | null {
  const digits = national.replace(/\D/g, "");
  if (/^0\d{8,9}$/.test(digits)) return `+66${digits.slice(1)}`;
  if (/^66\d{8,9}$/.test(digits)) return `+${digits}`;
  return null;
}

/**
 * A Thai phone field (design-system.md §3): a fixed, decorative `+66` prefix and a numeric keypad.
 * People type the number as they know it — with the leading 0 — and the conversion happens once,
 * in `toE164`, which is tested.
 */
export function PhoneInput({ value, onChange, inputSize = "md", className, ...props }: PhoneInputProps) {
  const field = useFieldProps();
  return (
    <div className={cn("relative", className)}>
      <span
        aria-hidden="true"
        className="text-muted pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 font-mono text-sm"
      >
        {PREFIX}
      </span>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        data-size={inputSize}
        className={cn(controlVariants({ inputSize }), "ps-12 font-mono tabular-nums")}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d\s-]/g, ""))}
        {...field}
        {...props}
      />
    </div>
  );
}
