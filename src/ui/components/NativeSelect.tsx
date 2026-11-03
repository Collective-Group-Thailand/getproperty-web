"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "../icons";
import { IconCheck } from "../icons/glyphs/check";
import { IconChevronDown } from "../icons/glyphs/chevron-down";
import { IconSearch } from "../icons/glyphs/search";
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
  /** Text of the type-to-filter field (shown from 11 options), from `src/i18n`; default: the field's own label. */
  filterLabel?: string;
  /** Shown when the filter matches nothing, from `src/i18n`. */
  noMatchLabel?: string;
}

/** From this many choices the desktop list gets a type-to-filter field (REDESIGN-PROMPT §3). */
export const FILTER_FROM = 11;

/**
 * The one select of the system (REDESIGN-PROMPT §3). The `<select>` is always the real control — its value, `name`,
 * label, keyboard and form behaviour are the platform's, so forms, `register()` and tests treat it as a select. On a
 * touch screen (coarse pointer) it opens the phone's own picker. With a mouse it opens a calm listbox anchored under the
 * field instead of the browser's menu, with type-to-filter from 11 choices; picking sets the select's value and fires
 * its `change` event, exactly as the native menu would.
 */
export function NativeSelect({
  options,
  placeholder,
  inputSize = "md",
  className,
  filterLabel,
  noMatchLabel,
  ref,
  ...props
}: NativeSelectProps) {
  const fieldProps = useFieldProps();
  const local = useRef<HTMLSelectElement | null>(null);
  const [open, setOpen] = useState<{ anchor: HTMLSelectElement; value: string } | null>(null);
  const finePointer = useFinePointer();

  const setRefs = useCallback(
    (node: HTMLSelectElement | null) => {
      local.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.RefObject<HTMLSelectElement | null>).current = node;
    },
    [ref],
  );

  const choices = useMemo(
    () => [...(placeholder !== undefined ? [{ value: "", label: placeholder }] : []), ...options],
    [options, placeholder],
  );

  const onMouseDown = (event: React.MouseEvent<HTMLSelectElement>) => {
    props.onMouseDown?.(event);
    if (event.defaultPrevented || !finePointer || props.disabled || props.multiple || event.button !== 0) return;
    event.preventDefault();
    const select = event.currentTarget;
    select.focus();
    setOpen((current) => (current ? null : { anchor: select, value: select.value }));
  };

  const pick = (value: string) => {
    const select = local.current;
    setOpen(null);
    if (!select) return;
    select.focus();
    if (select.value === value) return;
    // The native setter, so React's value tracker sees the change and calls onChange like a real pick.
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(select, value);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const close = useCallback(() => {
    setOpen((current) => {
      current?.anchor.focus();
      return null;
    });
  }, []);

  return (
    <>
      <span className="relative block w-full">
        <select
          className={cn(
            controlVariants({ inputSize }),
            "cursor-pointer appearance-none truncate pe-9",
            props.disabled && "cursor-not-allowed",
            className,
          )}
          {...fieldProps}
          {...props}
          ref={setRefs}
          onMouseDown={onMouseDown}
          aria-expanded={finePointer ? Boolean(open) : undefined}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon
          icon={IconChevronDown}
          className="text-muted pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-base"
        />
      </span>
      {open ? (
        <SelectListbox
          anchor={open.anchor}
          choices={choices}
          current={open.value}
          onPick={pick}
          onClose={close}
          filterLabel={filterLabel ?? fieldLabel(open.anchor)}
          noMatchLabel={noMatchLabel ?? "—"}
        />
      ) : null}
    </>
  );
}

function fieldLabel(select: HTMLSelectElement): string {
  return select.labels?.[0]?.textContent?.trim() || select.getAttribute("aria-label") || "";
}

/** True once mounted on a device whose primary pointer is fine (a mouse or trackpad). */
function useFinePointer(): boolean {
  const [fine, setFine] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(pointer: fine)");
    const update = () => setFine(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return fine;
}

function SelectListbox({
  anchor,
  choices,
  current,
  onPick,
  onClose,
  filterLabel,
  noMatchLabel,
}: {
  anchor: HTMLSelectElement;
  choices: NativeSelectOption[];
  current: string;
  onPick: (value: string) => void;
  onClose: () => void;
  filterLabel: string;
  noMatchLabel: string;
}) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const filter = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );
  const filtering = choices.length >= FILTER_FROM;
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? choices.filter((choice) => choice.label.toLowerCase().includes(needle)) : choices;
  }, [choices, query]);
  const [active, setActive] = useState(() =>
    Math.max(
      0,
      choices.findIndex((choice) => choice.value === current),
    ),
  );

  useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const up = below < 220 && above > below;
      const maxHeight = Math.min(360, up ? above : below);
      setPosition({
        top: up ? rect.top - 6 - maxHeight : rect.bottom + 6,
        left: rect.left,
        width: Math.max(rect.width, 220),
        maxHeight,
      });
    };
    place();
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, onClose]);

  useEffect(() => {
    (filtering ? filter.current : list.current)?.focus();
    const outside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (box.current?.contains(target) || anchor.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", outside);
    return () => document.removeEventListener("mousedown", outside);
  }, [anchor, filtering, onClose]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => Math.min(shown.length - 1, Math.max(0, index + step)));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const choice = shown[active];
      if (choice && !choice.disabled) onPick(choice.value);
    }
  };

  if (!position) return null;
  return createPortal(
    <div
      ref={box}
      className="rounded-card border-border bg-surface shadow-overlay z-overlay fixed flex flex-col overflow-hidden border"
      style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}
      onKeyDown={onKeyDown}
      data-testid="select-listbox"
    >
      {filtering ? (
        <label className="border-border flex shrink-0 items-center gap-2 border-b px-3">
          <Icon icon={IconSearch} className="text-subtle text-base" />
          <span className="sr-only">{filterLabel}</span>
          <input
            ref={filter}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
            aria-controls={id}
            aria-activedescendant={shown[active] ? `${id}-${active}` : undefined}
            autoComplete="off"
          />
        </label>
      ) : null}
      <ul
        ref={list}
        id={id}
        role="listbox"
        aria-label={filterLabel}
        tabIndex={filtering ? -1 : 0}
        aria-activedescendant={!filtering && shown[active] ? `${id}-${active}` : undefined}
        className="relative min-h-0 flex-1 overflow-y-auto p-1 outline-none"
      >
        {shown.length === 0 ? <li className="text-muted px-3 py-2.5 text-sm">{noMatchLabel}</li> : null}
        {shown.map((choice, index) => {
          const selected = choice.value === current;
          return (
            <li
              key={`${choice.value}-${index}`}
              id={`${id}-${index}`}
              data-index={index}
              role="option"
              aria-selected={selected}
              aria-disabled={choice.disabled || undefined}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => !choice.disabled && onPick(choice.value)}
              className={cn(
                "rounded-thumb flex min-h-10 cursor-pointer items-center gap-2 px-3 py-2 text-base",
                index === active && "bg-bg-subtle",
                selected && "text-primary font-semibold",
                choice.disabled && "text-subtle cursor-not-allowed",
                choice.value === "" && !selected && "text-muted",
              )}
            >
              <span className="min-w-0 flex-1">{choice.label}</span>
              {selected ? <Icon icon={IconCheck} className="text-primary shrink-0" /> : null}
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}
