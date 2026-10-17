"use client";

import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";

export interface NativeSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface NativeSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options: NativeSelectOption[];
  /** A first, empty choice ("ทุกสถานะ"). */
  placeholder?: string;
  inputSize?: "sm" | "md" | "lg";
  ref?: React.Ref<HTMLSelectElement>;
}

/**
 * The platform `<select>` in the control style — for filters and long, plain lists where the Radix
 * `Select` would add weight for no gain (D-179). Fully native: keyboard, type-ahead, the phone's own
 * picker. Labelled through `<Field>` like every control.
 */
export function NativeSelect({ options, placeholder, inputSize = "md", className, ...props }: NativeSelectProps) {
  const fieldProps = useFieldProps();
  return (
    <select className={cn(controlVariants({ inputSize }), "pe-8", className)} {...fieldProps} {...props}>
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
