"use client";

import { createContext, useContext, useId } from "react";

import { cn } from "../lib/cn";

interface FieldContextValue {
  inputId: string;
  labelId: string;
  hintId: string;
  errorId: string;
  hasHint: boolean;
  hasError: boolean;
  required: boolean;
  disabled: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export interface FieldProps {
  /** Always visible, always above the control (design-system.md §4). */
  label: React.ReactNode;
  /** Help that belongs to the control, announced via `aria-describedby`. */
  hint?: React.ReactNode;
  /** When set, the control is invalid and this is announced in place of the hint. */
  error?: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Visually hide the label — only when a placeholder or icon already names the control. */
  labelHidden?: boolean;
  className?: string;
  children: React.ReactNode;
  /** Word for the required marker, from `src/i18n` — the marker must not be `*` alone. */
  requiredLabel?: string;
}

/**
 * Wires a label, hint and error to a control so app code cannot forget to (ADR-0002).
 *
 * The control inside calls `useFieldProps()` and receives `id`, `aria-describedby`,
 * `aria-invalid`, `required` and `disabled`. That is the whole point: a11y wiring is
 * structural here, not something each screen remembers.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  labelHidden = false,
  className,
  children,
  requiredLabel,
}: FieldProps) {
  const id = useId();
  const context: FieldContextValue = {
    inputId: `${id}-input`,
    labelId: `${id}-label`,
    hintId: `${id}-hint`,
    errorId: `${id}-error`,
    hasHint: Boolean(hint),
    hasError: Boolean(error),
    required,
    disabled,
  };

  return (
    <FieldContext.Provider value={context}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <label
          id={context.labelId}
          htmlFor={context.inputId}
          className={cn("text-sm font-medium", labelHidden && "sr-only", disabled && "text-subtle")}
        >
          {label}
          {required ? (
            <span className="text-danger ms-1">
              {/* A bare asterisk is not a name; screen readers get the word. */}
              <span aria-hidden>*</span>
              {requiredLabel ? <span className="sr-only">{requiredLabel}</span> : null}
            </span>
          ) : null}
        </label>

        {children}

        {/* The hint stays rendered when invalid so its id keeps resolving, but the error leads. */}
        {hint ? (
          <p id={context.hintId} className="text-muted text-xs">
            {hint}
          </p>
        ) : null}
        {error ? (
          <p id={context.errorId} className="text-danger text-xs font-medium">
            {error}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/**
 * Props a control must spread onto its input. Outside a `<Field>` it returns empty props, so
 * a control can still be used bare (in a toolbar, say) without crashing.
 */
export function useFieldProps(): {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
  disabled?: boolean;
} {
  const field = useContext(FieldContext);
  return field ? fieldPropsFrom(field) : {};
}

function fieldPropsFrom(field: FieldContextValue) {
  // The error comes first: it is the news, and the hint stays available behind it.
  const describedBy = [field.hasError && field.errorId, field.hasHint && field.hintId].filter(Boolean).join(" ");

  return {
    id: field.inputId,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": field.hasError ? (true as const) : undefined,
    required: field.required || undefined,
    disabled: field.disabled || undefined,
  };
}

/**
 * Props for a *composite* control — a radio group, a slider, a toolbar of toggles. These
 * cannot use `<label for>`, which only works for a single form element, so the group is named
 * with `aria-labelledby` pointing at the same visible label.
 */
export function useFieldGroupProps(): {
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
  disabled?: boolean;
} {
  const field = useContext(FieldContext);
  if (!field) return {};

  // `id` is deliberately dropped: it belongs on a single control, and a composite one has
  // several — the group is named through aria-labelledby instead.
  const { id, ...rest } = fieldPropsFrom(field);
  void id;
  return { ...rest, "aria-labelledby": field.labelId };
}

/** Groups fields under a heading — long forms only (design-system.md §3). */
export function FormSection({
  title,
  description,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description ? <p className="text-muted mt-0.5 text-sm">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
