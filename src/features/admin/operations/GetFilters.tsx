import { getTranslations } from "next-intl/server";

import { DateField } from "@/features/shared/console/DateField";
import { Field } from "@/ui/components/Field";
import { FilterSheet } from "@/ui/components/FilterSheet";
import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";
import { NativeSelect, type NativeSelectOption } from "@/ui/components/NativeSelect";
import { cn } from "@/ui/lib/cn";

export type GetFilterField =
  | { name: string; label: string; type: "text"; value?: string; placeholder?: string; width?: string }
  | { name: string; label: string; type: "date"; value?: string; placeholder?: string }
  | { name: string; label: string; type: "select"; value?: string; options: NativeSelectOption[] };

/**
 * A server-rendered filter form (`method="get"`) for back-office lists whose filters are free text, ids or dates
 * (audit search, event logs) — the one toolbar of the list (REDESIGN-PROMPT §4.4): 36-px controls in one row, the
 * label as each control's accessible name, "apply" and "clear" at the end. The URL is the state; it works without
 * client JavaScript (dates use the Thai date picker, sent as ISO days). On phones the same fields wait behind one
 * "ตัวกรอง" button in a bottom sheet (the console's `FilterSheet`), so the list starts in the first screen.
 */
export async function GetFilters({
  fields,
  submitLabel,
  label,
  testId,
  clear,
  className,
}: {
  fields: GetFilterField[];
  submitLabel: string;
  label: string;
  testId?: string;
  /** "Clear filters" — shown when a filter is set: the list's own path. */
  clear?: { label: string; href: string } | null;
  className?: string;
}) {
  const sheet = await getTranslations("console.filterSheet");
  const used = fields.filter((field) => Boolean(field.value)).length;
  return (
    <>
      <div className={cn("md:hidden", className)}>
        <FilterSheet
          label={sheet("label")}
          count={used}
          closeLabel={sheet("close")}
          applyLabel={sheet("apply")}
          clear={clear ?? undefined}
          trigger="button"
          form={{ action: "" }}
          testId={testId ? `${testId}-sheet` : "filter-sheet"}
        >
          {fields.map((field) => (
            <Field key={field.name} label={field.label}>
              {field.type === "select" ? (
                <NativeSelect name={field.name} defaultValue={field.value ?? ""} options={field.options} />
              ) : field.type === "date" ? (
                <DateField name={field.name} defaultValue={field.value ?? null} placeholder={field.placeholder} />
              ) : (
                <Input
                  name={field.name}
                  type="search"
                  defaultValue={field.value ?? ""}
                  placeholder={field.placeholder}
                />
              )}
            </Field>
          ))}
        </FilterSheet>
      </div>
      <form
        method="get"
        role="search"
        aria-label={label}
        className={cn("flex flex-wrap items-center gap-2 max-md:hidden", className)}
        data-testid={testId}
      >
        {fields.map((field) => (
          <label key={field.name} className="flex min-w-0 items-center">
            <span className="sr-only">{field.label}</span>
            {field.type === "select" ? (
              <NativeSelect
                name={field.name}
                inputSize="sm"
                defaultValue={field.value ?? ""}
                options={field.options}
                aria-label={field.label}
                data-testid={`filter-${field.name}`}
              />
            ) : field.type === "date" ? (
              <span className="w-40" data-testid={`filter-${field.name}`}>
                <DateField
                  name={field.name}
                  defaultValue={field.value ?? null}
                  placeholder={field.placeholder ?? field.label}
                  inputSize="sm"
                />
              </span>
            ) : (
              <Input
                name={field.name}
                type="search"
                inputSize="sm"
                defaultValue={field.value ?? ""}
                placeholder={field.placeholder ?? field.label}
                aria-label={field.label}
                className={field.width ?? "w-56"}
                data-testid={`filter-${field.name}`}
              />
            )}
          </label>
        ))}
        <Button type="submit" size="sm" variant="secondary" data-testid="filter-apply">
          {submitLabel}
        </Button>
        {clear ? (
          <a
            href={clear.href}
            className="text-primary px-2 text-sm font-medium hover:underline"
            data-testid="filter-clear"
          >
            {clear.label}
          </a>
        ) : null}
      </form>
    </>
  );
}
