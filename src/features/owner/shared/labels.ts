"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import type { DatePickerProps } from "@/ui/components/DatePicker";
import type { SignaturePadLabels } from "@/ui/components/SignaturePad";

/** The date picker's own labels in the page language. */
export function useDateLabels(): DatePickerProps["labels"] {
  const t = useTranslations("owner.common.date");
  return useMemo(
    () => ({
      calendar: t("calendar"),
      previousMonth: t("previousMonth"),
      nextMonth: t("nextMonth"),
      today: t("today"),
      clear: t("clear"),
    }),
    [t],
  );
}

export function useSignatureLabels(): SignaturePadLabels {
  const t = useTranslations("owner.common.signature");
  return useMemo(
    () => ({ placeholder: t("placeholder"), clear: t("clear"), undo: t("undo"), upload: t("upload") }),
    [t],
  );
}
