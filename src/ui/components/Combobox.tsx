"use client";

import { useId, useMemo, useRef, useState } from "react";

import { Icon } from "../icons";
import { cn } from "../lib/cn";
import { useFieldProps } from "./Field";
import { controlVariants } from "./Input";

export interface ComboboxOption {
  value: string;
  label: string;
  /** Secondary text — a room's floor, a resident's phone. */
  description?: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** From `src/i18n`. */
  placeholder?: string;
  emptyLabel: string;
  /** Accessible name for the listbox, from `src/i18n`. */
  listLabel: string;
  inputSize?: "sm" | "md" | "lg";
  /** Override the default label match — e.g. match a room code and its resident's name. */
  filter?: (option: ComboboxOption, query: string) => boolean;
  className?: string;
}

const defaultFilter = (option: ComboboxOption, query: string) =>
  `${option.label} ${option.description ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());

/**
 * A searchable single choice — rooms, residents, properties — following the WAI-ARIA combobox pattern
 * (editable input + listbox popup, `aria-activedescendant`). Built on plain elements rather than Radix
 * because Radix ships no combobox; the keyboard map is Down/Up to move, Enter to choose, Escape to
 * close, and typing filters.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder,
  emptyLabel,
  listLabel,
  inputSize = "md",
  filter = defaultFilter,
  className,
}: ComboboxProps) {
  const field = useFieldProps();
  const baseId = useId();
  const listId = `${baseId}-list`;
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const text = query ?? selected?.label ?? "";
  const visible = useMemo(() => (query ? options.filter((o) => filter(o, query)) : options), [options, query, filter]);
  const activeOption = visible[Math.min(active, visible.length - 1)];

  const choose = (option: ComboboxOption | undefined) => {
    if (!option) return;
    onChange(option.value);
    setQuery(null);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setActive((i) => Math.min(i + 1, visible.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (open) {
          event.preventDefault();
          choose(activeOption);
        }
        break;
      case "Escape":
        setOpen(false);
        setQuery(null);
        break;
    }
  };

  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && activeOption ? `${baseId}-${activeOption.value}` : undefined}
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        data-size={inputSize}
        className={cn(controlVariants({ inputSize }), "pe-10")}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
          if (event.target.value === "") onChange(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          setOpen(false);
          setQuery(null);
        }}
        onKeyDown={onKeyDown}
        {...field}
      />
      <Icon
        name="chevrons-up-down"
        className="text-muted pointer-events-none absolute end-3 top-1/2 -translate-y-1/2"
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={listLabel}
        hidden={!open}
        className="border-border bg-surface-raised rounded-card shadow-overlay z-modal absolute inset-x-0 top-full mt-1 max-h-64 overflow-y-auto border p-1"
      >
        {visible.length === 0 ? (
          <li role="presentation" className="text-muted px-3 py-2 text-sm">
            {emptyLabel}
          </li>
        ) : (
          visible.map((option, index) => (
            <li
              key={option.value}
              id={`${baseId}-${option.value}`}
              role="option"
              aria-selected={option.value === value}
              data-active={index === active || undefined}
              className="rounded-control data-active:bg-bg-subtle flex cursor-default flex-col px-3 py-2"
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(option)}
            >
              <span className="flex items-center justify-between gap-2">
                <span>{option.label}</span>
                {option.value === value ? <Icon name="check" className="text-primary" /> : null}
              </span>
              {option.description ? <span className="text-muted text-sm">{option.description}</span> : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
