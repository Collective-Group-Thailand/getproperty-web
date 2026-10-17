"use client";

import { useLocale } from "next-intl";
import { useState } from "react";

import type { Locale } from "@/i18n/routing";
import { DatePicker } from "@/ui/components/DatePicker";

import { useDateLabels } from "./labels";

/**
 * A date of a form sent as `FormData` (a dialog's notice or termination date): the console's date
 * picker (Buddhist era on screen, ISO `YYYY-MM-DD` sent) with a hidden input carrying the value.
 */
export function DateField({
  name,
  defaultValue = null,
  min,
  max,
  placeholder,
  onChange,
}: {
  name: string;
  defaultValue?: string | null;
  min?: string;
  max?: string;
  placeholder?: string;
  onChange?: (value: string | null) => void;
}) {
  const locale = useLocale() as Locale;
  const labels = useDateLabels();
  const [value, setValue] = useState<string | null>(defaultValue);
  return (
    <>
      <input type="hidden" name={name} value={value ?? ""} />
      <DatePicker
        value={value}
        onChange={(next) => {
          setValue(next);
          onChange?.(next);
        }}
        locale={locale}
        labels={labels}
        min={min}
        max={max}
        placeholder={placeholder}
      />
    </>
  );
}
