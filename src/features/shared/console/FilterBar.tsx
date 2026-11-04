"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useLocale, useTranslations } from "next-intl";

import type { Locale } from "@/i18n/routing";

import { useDateLabels } from "./labels";
import { DatePicker } from "@/ui/components/DatePicker";
import { Field } from "@/ui/components/Field";
import { PeriodPicker } from "@/ui/components/PeriodPicker";
import { Input } from "@/ui/components/Input";
import { NativeSelect, type NativeSelectOption } from "@/ui/components/NativeSelect";
import { FilterSheet } from "@/ui/components/FilterSheet";
import { cn } from "@/ui/lib/cn";

export type FilterField =
  | {
      name: string;
      label: string;
      type: "select";
      options: NativeSelectOption[];
      placeholder?: string;
      /** The value the page uses when the URL names none. */
      fallback?: string;
    }
  | { name: string; label: string; type: "search"; placeholder?: string }
  | { name: string; label: string; type: "month" }
  /** A month filter in the toolbar (G3): the API's `YYYY-MM` keys newest first, "every month" as the empty value. */
  | {
      name: string;
      label: string;
      type: "period";
      periods: string[];
      /** "Every month" as the empty value; leave out where the API always needs a month. */
      allLabel?: string;
      /** The month the page shows when the URL names none (the page's own default). */
      fallback?: string;
    }
  | { name: string; label: string; type: "number"; min?: number; placeholder?: string }
  /** A day (`YYYY-MM-DD` in the URL) on the console's Thai date picker; the label is its placeholder (G6). */
  | { name: string; label: string; type: "date" };

/**
 * The filters of an owner list as URL search parameters (F2): every change replaces the URL — the
 * server renders the filtered page, the address can be bookmarked or shared, and the page number
 * starts again at 1. Text search waits until typing pauses.
 */
export function FilterBar({
  fields,
  className,
  variant = "form",
}: {
  fields: FilterField[];
  className?: string;
  /**
   * `form`: labelled fields above a list (legacy); `toolbar`: the controls of a `ListToolbar` — one row, 36-px
   * controls, the label as the control's accessible name (REDESIGN-PROMPT §4.4).
   */
  variant?: "form" | "toolbar";
}) {
  const t = useTranslations("console.period");
  const sheet = useTranslations("console.filterSheet");
  const dateLabels = useDateLabels();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const apply = (name: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(name, value);
    else next.delete(name);
    next.delete("page");
    const query = next.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  };

  if (variant === "toolbar") {
    const control = (field: FilterField, inSheet: boolean) => {
      const testId = inSheet ? `filter-${field.name}-sheet` : `filter-${field.name}`;
      const size = inSheet ? "md" : "sm";
      if (field.type === "select")
        return (
          <NativeSelect
            name={field.name}
            aria-label={inSheet ? undefined : field.label}
            inputSize={size}
            options={field.options}
            placeholder={field.placeholder ?? (field.fallback ? undefined : "")}
            value={params.get(field.name) ?? field.fallback ?? ""}
            onChange={(event) => apply(field.name, event.target.value)}
            data-testid={testId}
          />
        );
      if (field.type === "period")
        return (
          <PeriodPicker
            periods={field.periods}
            value={params.get(field.name) ?? field.fallback ?? ""}
            onChange={(value) => apply(field.name, value)}
            locale={locale}
            label={field.label}
            previousLabel={t("previous")}
            nextLabel={t("next")}
            allLabel={field.allLabel}
            testId={testId}
          />
        );
      if (field.type === "date")
        return (
          <div data-testid={testId}>
            <DatePicker
              value={params.get(field.name)}
              onChange={(value) => apply(field.name, value ?? "")}
              locale={locale}
              labels={dateLabels}
              placeholder={field.label}
              inputSize={size}
            />
          </div>
        );
      if (field.type === "search") return null;
      return (
        <Input
          name={field.name}
          aria-label={inSheet ? undefined : field.label}
          inputSize={size}
          type={field.type}
          min={field.type === "number" ? field.min : undefined}
          placeholder={field.type === "number" ? field.placeholder : undefined}
          defaultValue={params.get(field.name) ?? ""}
          onChange={(event) => apply(field.name, event.target.value)}
          data-testid={testId}
        />
      );
    };
    const search = fields.filter((field) => field.type === "search");
    const others = fields.filter((field) => field.type !== "search");
    // Filters in use (not the page's own default), for the phone trigger's number.
    const used = others.filter((field) => {
      const value = params.get(field.name);
      return Boolean(value) && value !== ("fallback" in field ? field.fallback : undefined);
    }).length;
    const clearQuery = new URLSearchParams(params.toString());
    for (const field of others) clearQuery.delete(field.name);
    clearQuery.delete("page");
    const clearHref = clearQuery.toString() ? `${pathname}?${clearQuery.toString()}` : pathname;
    return (
      <div
        className={cn("flex w-full min-w-0 items-center gap-2 md:flex-wrap xl:w-auto xl:flex-nowrap", className)}
        role="search"
        aria-busy={pending}
        data-testid="filter-bar"
      >
        {search.map((field) => (
          <div key={field.name} className="min-w-0 flex-1 sm:w-64 sm:flex-none">
            <SearchInput
              name={field.name}
              label={field.label}
              placeholder={field.placeholder}
              initial={params.get(field.name) ?? ""}
              onCommit={(value) => apply(field.name, value)}
            />
          </div>
        ))}
        {/* From md the filters sit in the toolbar; on phones they wait behind one trigger in a bottom sheet. */}
        {others.map((field) => (
          <div
            key={field.name}
            className={cn(
              "hidden md:block",
              field.type === "select"
                ? "min-w-36"
                : field.type === "period"
                  ? ""
                  : field.type === "date"
                    ? "w-40"
                    : "w-44",
            )}
          >
            {control(field, false)}
          </div>
        ))}
        {others.length > 0 ? (
          <div className={cn("md:hidden", search.length === 0 && "ms-auto")}>
            <FilterSheet
              label={sheet("label")}
              count={used}
              closeLabel={sheet("close")}
              applyLabel={sheet("apply")}
              clear={used > 0 ? { href: clearHref, label: sheet("clear") } : undefined}
              trigger={search.length > 0 ? "icon" : "button"}
              testId="filter-sheet"
            >
              {others.map((field) => (
                <Field key={field.name} label={field.label}>
                  {control(field, true)}
                </Field>
              ))}
            </FilterSheet>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={cn("flex flex-wrap items-end gap-3", className)}
      role="search"
      aria-busy={pending}
      data-testid="filter-bar"
    >
      {fields.map((field) => (
        <Field key={field.name} label={field.label} className="min-w-40">
          {field.type === "select" ? (
            <NativeSelect
              name={field.name}
              inputSize="sm"
              options={field.options}
              placeholder={field.placeholder ?? ""}
              value={params.get(field.name) ?? ""}
              onChange={(event) => apply(field.name, event.target.value)}
              data-testid={`filter-${field.name}`}
            />
          ) : field.type === "search" ? (
            <SearchInput
              name={field.name}
              placeholder={field.placeholder}
              initial={params.get(field.name) ?? ""}
              onCommit={(value) => apply(field.name, value)}
            />
          ) : field.type === "period" ? (
            <PeriodPicker
              periods={field.periods}
              value={params.get(field.name) ?? field.fallback ?? ""}
              onChange={(value) => apply(field.name, value)}
              locale={locale}
              label={field.label}
              previousLabel={t("previous")}
              nextLabel={t("next")}
              allLabel={field.allLabel}
              testId={`filter-${field.name}`}
            />
          ) : (
            <Input
              name={field.name}
              inputSize="sm"
              type={field.type}
              min={field.type === "number" ? field.min : undefined}
              placeholder={field.type === "number" ? field.placeholder : undefined}
              defaultValue={params.get(field.name) ?? ""}
              onChange={(event) => apply(field.name, event.target.value)}
              data-testid={`filter-${field.name}`}
            />
          )}
        </Field>
      ))}
    </div>
  );
}

function SearchInput({
  name,
  label,
  placeholder,
  initial,
  onCommit,
}: {
  name: string;
  /** The accessible name when no visible label sits above the field (toolbar). */
  label?: string;
  placeholder?: string;
  initial: string;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  const timer = useRef<number | undefined>(undefined);
  const commit = useRef(onCommit);
  useEffect(() => {
    commit.current = onCommit;
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Input
      name={name}
      aria-label={label}
      type="search"
      inputSize="sm"
      placeholder={placeholder}
      value={value}
      onChange={(event) => {
        const next = event.target.value;
        setValue(next);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => commit.current(next.trim()), 350);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          window.clearTimeout(timer.current);
          commit.current(value.trim());
        }
      }}
      data-testid={`filter-${name}`}
    />
  );
}
