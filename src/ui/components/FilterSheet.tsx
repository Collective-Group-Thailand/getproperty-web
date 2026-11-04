"use client";

import { useState } from "react";

import { Icon } from "../icons";
import { IconFilter } from "../icons/glyphs/filter";
import { cn } from "../lib/cn";
import { Button } from "./Button";
import { LazySheet } from "./overlays";

export interface FilterSheetProps {
  /** Accessible name of the trigger and its visible word in `button` mode ("ตัวกรอง"). */
  label: string;
  /** The sheet's title (defaults to `label`). */
  title?: string;
  /** Filters in use — a small number on the trigger, never a pill. Leave out (or 0) when none. */
  count?: number;
  /** Close button name, from `src/i18n`. */
  closeLabel: string;
  /** The footer's one filled button ("ดูผลลัพธ์"). */
  applyLabel: string;
  /** "ล้างตัวกรอง": a link back to the unfiltered list. */
  clear?: { href: string; label: string };
  /**
   * A plain GET form inside the sheet (public pages that work without JavaScript): the controls in `children` and
   * `hidden` values (the rest of the current query) submit together; "ดูผลลัพธ์" submits. Without it the controls
   * apply as they change (the console's `FilterBar`) and "ดูผลลัพธ์" only closes the sheet.
   */
  form?: { action: string; hidden?: Record<string, string | undefined> };
  /** `icon`: a 44-px square beside a search field; `button`: an outlined button with the word. */
  trigger?: "icon" | "button";
  children: React.ReactNode;
  className?: string;
  testId?: string;
}

/**
 * The secondary filters of a list on a phone (REDESIGN-PROMPT §4.4, Stitch revision): one trigger with the number of
 * filters in use, a bottom sheet holding the rarely used controls stacked full width, and a footer with the one filled
 * "show results" and a quiet "clear". The list's view tabs stay outside as a row of chips; the search field stays in
 * the page. On a desktop the same controls sit in the `ListToolbar` instead — render this `md:hidden`.
 */
export function FilterSheet({
  label,
  title,
  count = 0,
  closeLabel,
  applyLabel,
  clear,
  form,
  trigger = "icon",
  children,
  className,
  testId,
}: FilterSheetProps) {
  const [open, setOpen] = useState(false);
  const formId = testId ? `${testId}-form` : "filter-sheet-form";
  const active = count > 0;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={active ? `${label} (${count})` : label}
        aria-haspopup="dialog"
        data-testid={testId}
        className={cn(
          "border-border bg-surface text-fg hover:border-border-strong focus-visible:ring-focus-ring rounded-control relative inline-flex shrink-0 items-center justify-center gap-2 border font-medium focus-visible:ring-2 focus-visible:outline-none",
          trigger === "icon" ? "size-11" : "h-11 px-3.5 text-sm",
          active && "border-primary/40 text-primary-subtle-fg",
          className,
        )}
      >
        <Icon icon={IconFilter} className="text-lg" />
        {trigger === "button" ? <span>{label}</span> : null}
        {active ? (
          <span
            aria-hidden="true"
            className={cn(
              "bg-primary text-primary-fg rounded-thumb grid h-5 min-w-5 place-items-center px-1 text-xs font-semibold tabular-nums",
              trigger === "icon" && "absolute -end-1.5 -top-1.5",
            )}
          >
            {count}
          </span>
        ) : null}
      </button>
      <LazySheet
        open={open}
        onOpenChange={setOpen}
        title={title ?? label}
        closeLabel={closeLabel}
        side="bottom"
        footer={
          <div className="flex items-center gap-3">
            {clear ? (
              <a
                href={clear.href}
                className="text-muted hover:text-fg inline-flex min-h-11 shrink-0 items-center px-1 text-sm font-medium underline underline-offset-4"
              >
                {clear.label}
              </a>
            ) : null}
            {form ? (
              <Button type="submit" form={formId} size="lg" className="flex-1">
                {applyLabel}
              </Button>
            ) : (
              <Button type="button" size="lg" className="flex-1" onClick={() => setOpen(false)}>
                {applyLabel}
              </Button>
            )}
          </div>
        }
      >
        {form ? (
          <form id={formId} action={form.action} method="get" className="flex flex-col gap-4 pt-1">
            {Object.entries(form.hidden ?? {}).map(([name, value]) =>
              value ? <input key={name} type="hidden" name={name} value={value} /> : null,
            )}
            {children}
          </form>
        ) : (
          <div className="flex flex-col gap-4 pt-1">{children}</div>
        )}
      </LazySheet>
    </>
  );
}
