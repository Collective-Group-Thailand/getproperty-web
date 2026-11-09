"use client";

import { useEffect, useRef, useState } from "react";

import { Combobox, type ComboboxOption } from "@/ui/components/Combobox";

/**
 * A searchable single choice whose options come from the API (`?q=`), for forms read with `FormData`: the chosen
 * value is posted as the hidden input `name`. The first page loads when the picker mounts; typing searches again
 * after a short pause. The chosen option stays chosen when a later search no longer lists it.
 */
export function SearchPicker({
  name,
  search,
  placeholder,
  emptyLabel,
  listLabel,
  onPick,
  testId,
}: {
  name: string;
  search: (query: string) => Promise<ComboboxOption[]>;
  placeholder?: string;
  emptyLabel: string;
  listLabel: string;
  onPick?: (value: string | null) => void;
  testId?: string;
}) {
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [chosen, setChosen] = useState<ComboboxOption | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);

  const run = (query: string) => {
    const ticket = ++latest.current;
    search(query.trim())
      .then((found) => {
        if (ticket === latest.current) setOptions(found);
      })
      .catch(() => {
        if (ticket === latest.current) setOptions([]);
      });
  };

  useEffect(() => {
    run("");
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the first page once, on mount
  }, []);

  const shown = chosen && !options.some((option) => option.value === chosen.value) ? [chosen, ...options] : options;
  return (
    <div data-testid={testId}>
      <input type="hidden" name={name} value={chosen?.value ?? ""} />
      <Combobox
        options={shown}
        value={chosen?.value ?? null}
        onChange={(value) => {
          const next = value ? (shown.find((option) => option.value === value) ?? null) : null;
          setChosen(next);
          onPick?.(next?.value ?? null);
        }}
        onQueryChange={(query) => {
          clearTimeout(timer.current);
          timer.current = setTimeout(() => run(query), 250);
        }}
        placeholder={placeholder}
        emptyLabel={emptyLabel}
        listLabel={listLabel}
      />
    </div>
  );
}
