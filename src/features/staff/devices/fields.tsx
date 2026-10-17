"use client";

import { useId } from "react";

/**
 * The devices screens' form fields: label above, 56-px controls, 18-px text (design-system.md §5).
 * Plain native inputs and selects — the phone's own pickers, nothing extra to download.
 */
export function TextField({
  label,
  value,
  onChange,
  hint,
  numeric,
  mono,
  testId,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  numeric?: boolean;
  mono?: boolean;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-muted text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        value={value}
        inputMode={numeric ? "numeric" : undefined}
        autoComplete="off"
        spellCheck={false}
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(event) => onChange(numeric ? event.target.value.replace(/[^0-9]/g, "") : event.target.value)}
        className={`rounded-control border-border-strong bg-surface h-14 border px-4 text-lg ${mono ? "font-mono" : ""}`}
        data-testid={testId}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-muted text-sm font-medium">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-control border-border-strong bg-surface h-14 border px-4 text-lg"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
