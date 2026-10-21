"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { isApiError, toFieldName } from "@/lib/api/errors";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { LazyDialog } from "@/ui/components/overlays";
import { toast } from "@/ui/components/Toast";
import type { IconGlyph } from "@/ui/icons";

import { ProblemNotice, useApiAction, useIdempotencyKey } from "./useApiAction";

/** The API's field errors by form field name (`lines[1].amount` → `lines.1.amount`). */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  return Object.fromEntries(error.errors.map((fieldError) => [toFieldName(fieldError.path), fieldError.message]));
}

export interface FormDialogProps {
  label: string;
  icon?: IconGlyph;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  testId?: string;
  title: string;
  description?: React.ReactNode;
  submitLabel: string;
  size_?: "sm" | "md" | "lg";
  /**
   * Sends the form. Receives the form's data and the acknowledgement ids of D-021a warnings
   * acknowledged in the dialog, and the dialog's Idempotency-Key (one per opening, reused when the
   * same dialog is sent again — contract §3); throws the API's problem (`unwrap`) on failure.
   */
  onSubmit: (data: FormData, acknowledgementIds: string[], idempotencyKey: string) => Promise<unknown>;
  successMessage?: string;
  onDone?: (result: unknown) => void;
  /** The fields; given the API's field errors of the last attempt. */
  children: (errors: Record<string, string>) => React.ReactNode;
  disabled?: boolean;
  /** Opens on first render (a "new" link from another page, `?new=1`). */
  defaultOpen?: boolean;
}

/**
 * A small create/edit form in a dialog (a floor, a utility account, a party): native inputs, the API's
 * field errors placed on their fields, compliance problems with their legal reference, and the page
 * refreshed from the API afterwards. Nothing is cleared on error (design-system.md §4 "Forms").
 */
export function FormDialog({
  label,
  icon,
  variant = "secondary",
  size = "md",
  testId,
  title,
  description,
  submitLabel,
  size_ = "md",
  onSubmit,
  successMessage,
  onDone,
  children,
  disabled,
  defaultOpen = false,
}: FormDialogProps) {
  const common = useTranslations("common");
  const formId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const action = useApiAction();
  const idempotency = useIdempotencyKey();
  const errors = fieldErrors(action.error);

  return (
    <>
      <Button
        variant={variant}
        size={size}
        iconStart={icon}
        disabled={disabled}
        onClick={() => {
          // Same pending action (last attempt unanswered) → same key; otherwise a fresh one (review L2).
          idempotency.renewUnless(action.unansweredAttempt());
          action.reset();
          setOpen(true);
        }}
        data-testid={testId}
      >
        {label}
      </Button>
      <LazyDialog
        open={open}
        onOpenChange={(next) => !action.busy && setOpen(next)}
        title={title}
        description={description}
        size={size_}
        closeLabel={common("close")}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={action.busy}>
              {common("cancel")}
            </Button>
            <Button type="submit" form={formId} loading={action.busy || action.acknowledging} data-testid="form-submit">
              {submitLabel}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          noValidate={false}
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            void action.run(
              (ackIds) => onSubmit(data, ackIds, idempotency.key),
              (result) => {
                setOpen(false);
                if (successMessage) toast.success(successMessage);
                onDone?.(result);
              },
            );
          }}
        >
          {children(errors)}
          <ProblemNotice error={action.error} onAcknowledge={action.acknowledge} acknowledging={action.acknowledging} />
        </form>
      </LazyDialog>
    </>
  );
}

/** A form value as a trimmed string, or `undefined` when empty. */
export function text(data: FormData, name: string): string | undefined {
  const value = data.get(name);
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

/** A form value as an integer, or `undefined` when empty or not a number. */
export function integer(data: FormData, name: string): number | undefined {
  const value = text(data, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
