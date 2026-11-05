"use client";

import { cx as cn } from "../lib/cx";

export interface PickerFieldProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  invalid?: boolean;
  /** Something is chosen: a quieter frame than the empty field asking to be filled. */
  filled?: boolean;
  children: React.ReactNode;
}

/**
 * A field that opens a picker instead of taking typing (the gate's destination house, JW4): it looks like an input —
 * 64 px, framed, invalid in the danger frame — and behaves as a button. Label it with `aria-labelledby`.
 */
export function PickerField({ invalid, filled, className, children, ...props }: PickerFieldProps) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-control bg-surface flex min-h-16 w-full touch-manipulation items-center gap-3 border-2 px-4 py-2 text-left",
        invalid ? "border-danger" : filled ? "border-border" : "border-border-strong",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
