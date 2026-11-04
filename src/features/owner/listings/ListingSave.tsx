"use client";

import { createContext, useContext, useMemo, useState } from "react";

import { Button, type ButtonProps } from "@/ui/components/Button";

/** The id of the listing's details form; the review panel's save button submits it from outside the form. */
export const LISTING_DETAILS_FORM = "listing-details-form";

interface SaveState {
  busy: boolean;
  setBusy: (busy: boolean) => void;
}

const SaveContext = createContext<SaveState | null>(null);

/**
 * The listing editor (G5) keeps its save in the review panel beside the numbered sections: this context carries the
 * details form's busy state to that button, which submits the form through its `form` attribute.
 */
export function ListingSaveProvider({ children }: { children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const value = useMemo(() => ({ busy, setBusy }), [busy]);
  return <SaveContext.Provider value={value}>{children}</SaveContext.Provider>;
}

export function useListingSave(): SaveState | null {
  return useContext(SaveContext);
}

/** Saves the details form (sections 2–5) from wherever it is placed. */
export function ListingSaveButton({
  label,
  testId,
  variant = "primary",
  className,
}: {
  label: string;
  testId: string;
  variant?: ButtonProps["variant"];
  className?: string;
}) {
  const save = useListingSave();
  return (
    <Button
      type="submit"
      form={LISTING_DETAILS_FORM}
      variant={variant}
      loading={save?.busy ?? false}
      className={className}
      data-testid={testId}
    >
      {label}
    </Button>
  );
}
