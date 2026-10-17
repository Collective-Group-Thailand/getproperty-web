"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect, type NativeSelectOption } from "@/ui/components/NativeSelect";
import { cn } from "@/ui/lib/cn";

export type FilterField =
  | { name: string; label: string; type: "select"; options: NativeSelectOption[]; placeholder?: string }
  | { name: string; label: string; type: "search"; placeholder?: string }
  | { name: string; label: string; type: "month" }
  | { name: string; label: string; type: "number"; min?: number; placeholder?: string };

/**
 * The filters of an owner list as URL search parameters (F2): every change replaces the URL — the
 * server renders the filtered page, the address can be bookmarked or shared, and the page number
 * starts again at 1. Text search waits until typing pauses.
 */
export function FilterBar({ fields, className }: { fields: FilterField[]; className?: string }) {
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
  placeholder,
  initial,
  onCommit,
}: {
  name: string;
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
