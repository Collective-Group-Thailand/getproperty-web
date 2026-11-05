"use client";

import { Icon } from "../icons";
import { IconBackspace } from "../icons/glyphs/backspace";
import { cx as cn } from "../lib/cx";

export interface PinPadProps {
  /** Digits typed so far (only their count is shown). */
  length: number;
  maxLength: number;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  labels: { backspace: string; entered: string };
  /** Line under the dots: an error or the lockout countdown, read out politely. */
  message?: React.ReactNode;
  messageTone?: "neutral" | "danger" | "warning";
  className?: string;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
const ZERO = "0";

/**
 * The guard's PIN pad (JW4): dots for the digits typed (never the digits), twelve 72-px keys, and a message line
 * for "PIN ไม่ถูกต้อง" or a lockout countdown. A hardware keyboard works too (digits and Backspace on the pad).
 */
export function PinPad({
  length,
  maxLength,
  onDigit,
  onBackspace,
  disabled,
  labels,
  message,
  messageTone = "neutral",
  className,
}: PinPadProps) {
  const key = cn(
    "rounded-panel bg-bg-subtle text-fg flex h-18 items-center justify-center text-3xl font-semibold tabular-nums",
    "active:bg-border-strong duration-fast touch-manipulation transition-colors select-none disabled:opacity-40",
  );
  return (
    <div
      className={cn("flex w-full max-w-sm flex-col items-center gap-5", className)}
      onKeyDown={(event) => {
        if (disabled) return;
        if (/^\d$/.test(event.key)) onDigit(event.key);
        else if (event.key === "Backspace") onBackspace();
      }}
    >
      <div role="status" aria-label={labels.entered} className="flex h-6 items-center gap-4" data-testid="pin-dots">
        {Array.from({ length: maxLength }, (_, index) => (
          <span
            key={index}
            className={cn(
              "size-4 rounded-full border-2",
              index < length ? "border-primary bg-primary" : "border-border-strong bg-transparent",
            )}
          />
        ))}
      </div>
      <p
        aria-live="polite"
        className={cn(
          "min-h-7 text-center text-base font-medium",
          messageTone === "danger"
            ? "text-danger-subtle-fg"
            : messageTone === "warning"
              ? "text-warning-subtle-fg"
              : "text-muted",
        )}
      >
        {message}
      </p>
      <div className="grid w-full grid-cols-3 gap-3">
        {KEYS.map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={disabled}
            className={key}
            onClick={() => onDigit(digit)}
            data-key={digit}
          >
            {digit}
          </button>
        ))}
        <span aria-hidden />
        <button type="button" disabled={disabled} className={key} onClick={() => onDigit(ZERO)} data-key="0">
          {ZERO}
        </button>
        <button
          type="button"
          disabled={disabled}
          className={key}
          onClick={onBackspace}
          aria-label={labels.backspace}
          data-key="backspace"
        >
          <Icon icon={IconBackspace} size={30} />
        </button>
      </div>
    </div>
  );
}
