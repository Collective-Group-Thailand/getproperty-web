"use client";

import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";

/** Shared shell for every text-like control, so Input, NumberInput, PhoneInput and Textarea match. */
export const controlVariants = cva(
  [
    "w-full rounded-control border bg-surface text-fg",
    "transition-colors duration-fast ease-standard",
    "aria-invalid:border-danger",
    "disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-subtle",
  ],
  {
    variants: {
      inputSize: {
        sm: "h-8 px-2.5 text-sm",
        md: "h-10 px-3 text-base",
        /** Staff and tenant: 48 px. */
        lg: "h-12 px-4 text-lg",
      },
      // border-strong, not border: an input outline is a UI component and needs 3:1 (1.4.11).
      tone: { default: "border-border-strong", invalid: "border-danger" },
    },
    defaultVariants: { inputSize: "md", tone: "default" },
  },
);

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    Pick<VariantProps<typeof controlVariants>, "inputSize"> {
  ref?: React.Ref<HTMLInputElement>;
}

export function Input({ className, inputSize, type = "text", ...props }: InputProps) {
  const fieldProps = useFieldProps();
  return (
    <input
      type={type}
      data-size={inputSize ?? "md"}
      className={cn(controlVariants({ inputSize }), className)}
      {...fieldProps}
      {...props}
    />
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: React.Ref<HTMLTextAreaElement>;
}

export function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  const fieldProps = useFieldProps();
  return (
    <textarea
      rows={rows}
      className={cn(controlVariants({ inputSize: "md" }), "h-auto py-2 leading-normal", className)}
      {...fieldProps}
      {...props}
    />
  );
}

export interface NumberInputProps extends Omit<InputProps, "type"> {
  /** kWh, m³, บาท … shown inside the control and announced as part of it. */
  unit?: string;
}

/**
 * A number with its unit (design-system.md §3). Tabular figures so a column of registers lines up,
 * and `inputMode="decimal"` so a phone offers the right keypad. The unit is referenced by
 * `aria-describedby`, so "1234.5" is never read out without "kWh".
 */
export function NumberInput({ className, unit, inputSize, id, ...props }: NumberInputProps) {
  const fieldProps = useFieldProps();
  const inputId = id ?? fieldProps.id;
  const unitId = unit && inputId ? `${inputId}-unit` : undefined;
  const describedBy = [fieldProps["aria-describedby"], unitId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        data-size={inputSize ?? "md"}
        className={cn(controlVariants({ inputSize }), "font-mono tabular-nums", unit && "pe-14", className)}
        {...fieldProps}
        id={inputId}
        aria-describedby={describedBy}
        {...props}
      />
      {unit ? (
        <span id={unitId} className="text-muted pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-sm">
          {unit}
        </span>
      ) : null}
    </div>
  );
}
