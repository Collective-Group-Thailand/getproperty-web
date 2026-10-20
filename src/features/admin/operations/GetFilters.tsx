import { Button } from "@/ui/components/Button";
import { Input } from "@/ui/components/Input";
import { NativeSelect, type NativeSelectOption } from "@/ui/components/NativeSelect";

export type GetFilterField =
  | { name: string; label: string; type: "text" | "date"; value?: string; placeholder?: string; width?: string }
  | { name: string; label: string; type: "select"; value?: string; options: NativeSelectOption[] };

/**
 * A server-rendered filter form (`method="get"`) for back-office lists whose filters are free text,
 * ids or dates (audit search, dead letters): the URL is the state, the page re-reads the API, and it
 * works without client JavaScript. Lists with only selects use the live `FilterBar` instead.
 */
export function GetFilters({
  fields,
  submitLabel,
  label,
  testId,
}: {
  fields: GetFilterField[];
  submitLabel: string;
  label: string;
  testId?: string;
}) {
  return (
    <form method="get" role="search" aria-label={label} className="flex flex-wrap items-end gap-3" data-testid={testId}>
      {fields.map((field) => (
        <label key={field.name} className="flex flex-col gap-1 text-sm">
          {field.label}
          {field.type === "select" ? (
            <NativeSelect
              name={field.name}
              inputSize="sm"
              defaultValue={field.value ?? ""}
              options={field.options}
              data-testid={`filter-${field.name}`}
            />
          ) : (
            <Input
              name={field.name}
              type={field.type}
              inputSize="sm"
              defaultValue={field.value ?? ""}
              placeholder={"placeholder" in field ? field.placeholder : undefined}
              className={("width" in field && field.width) || "w-48"}
              data-testid={`filter-${field.name}`}
            />
          )}
        </label>
      ))}
      <Button type="submit" size="sm" variant="secondary" data-testid="filter-apply">
        {submitLabel}
      </Button>
    </form>
  );
}
