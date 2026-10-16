"use client";

import { useRef } from "react";

import { cn } from "../lib/cn";
import { useFieldGroupProps } from "./Field";

export interface OTPInputProps {
  length?: 4 | 6;
  value: string;
  onChange: (value: string) => void;
  /** Called once all digits are in — the natural moment to submit. */
  onComplete?: (value: string) => void;
  /** Accessible name for digit n, from `src/i18n`: `(index) => "หลักที่ 1"`. */
  digitLabel: (index: number) => string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * One box per digit, but one *value*: paste a whole code into any box and it fills them all (WCAG
 * 3.3.8 accessible authentication: no cognitive test, paste allowed, `autocomplete="one-time-code"`
 * so iOS/Android offer the SMS code). Wrap in `<Field>` for the group's label.
 */
export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  digitLabel,
  disabled,
  autoFocus,
  className,
}: OTPInputProps) {
  const group = useFieldGroupProps();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  const commit = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
  };
  const focus = (i: number) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  return (
    <div role="group" {...group} className={cn("flex gap-2", className)}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={length}
          aria-label={digitLabel(i)}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={digit}
          className="border-border-strong bg-surface rounded-control aria-invalid:border-danger h-14 w-12 border text-center font-mono text-2xl tabular-nums disabled:opacity-50"
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, "");
            if (typed.length > 1) {
              // A paste (or the OS filling the code): take it all from this position.
              commit(value.slice(0, i) + typed);
              focus(i + typed.length);
              return;
            }
            const next = digits.slice();
            next[i] = typed;
            commit(next.join(""));
            if (typed) focus(i + 1);
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && i > 0) {
              const next = digits.slice();
              next[i - 1] = "";
              commit(next.join(""));
              focus(i - 1);
            }
            if (event.key === "ArrowLeft") focus(i - 1);
            if (event.key === "ArrowRight") focus(i + 1);
          }}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
