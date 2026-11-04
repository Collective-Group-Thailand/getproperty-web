"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import { isApiError, problemError, toFieldName } from "@/lib/api/errors";
import { Button, type ButtonProps } from "@/ui/components/Button";
import { LazyDialog, LazySheet } from "@/ui/components/overlays";
import { toast } from "@/ui/components/Toast";
import type { IconGlyph } from "@/ui/icons";

import { type MenuItemOptions, useMenuEntry } from "./ActionMenu";
import { ProblemNotice, useApiAction, useIdempotencyKey } from "./useApiAction";

/** The API's field errors by form field name (`lines[1].amount` → `lines.1.amount`). */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!isApiError(error)) return {};
  return Object.fromEntries(error.errors.map((fieldError) => [toFieldName(fieldError.path), fieldError.message]));
}

/**
 * A local field error in the API's problem shape, thrown from `onSubmit` before any request: the dialog shows it on
 * its field and nothing is sent.
 */
export function invalidField(path: string, message: string): never {
  throw problemError(422, {
    status: 422,
    code: "validation.failed",
    title: message,
    errors: [{ path, code: "invalid", message }],
  });
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
  /** Its item inside an `ActionMenu` ("⋯"), where it differs from the button (defaults: `label`, red when destructive). */
  menuItem?: MenuItemOptions;
  /** A side sheet instead of a centred dialog: a longer form beside the page it changes (connect a channel). */
  sheet?: boolean;
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
  menuItem,
  sheet = false,
}: FormDialogProps) {
  const common = useTranslations("common");
  const formId = useId();
  const [open, setOpen] = useState(defaultOpen);
  const action = useApiAction();
  const idempotency = useIdempotencyKey();
  const errors = fieldErrors(action.error);

  const start = () => {
    // Same pending action (last attempt unanswered) → same key; otherwise a fresh one (review L2).
    idempotency.renewUnless(action.unansweredAttempt());
    action.reset();
    setOpen(true);
  };
  // Inside an `ActionMenu` ("⋯") the action is a menu item and renders only its dialog.
  const inMenu = useMenuEntry(
    {
      label: menuItem?.label ?? label,
      icon,
      testId,
      disabled,
      destructive: menuItem?.destructive ?? variant === "destructive",
    },
    start,
  );

  return (
    <>
      {inMenu ? null : (
        <Button variant={variant} size={size} iconStart={icon} disabled={disabled} onClick={start} data-testid={testId}>
          {label}
        </Button>
      )}
      <Overlay
        sheet={sheet}
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
      </Overlay>
    </>
  );
}

/** The dialog, or the right-hand sheet (`sheet`), with the same title, body and footer. */
function Overlay({
  sheet,
  size,
  ...props
}: {
  sheet: boolean;
  size: "sm" | "md" | "lg";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  closeLabel: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return sheet ? <LazySheet side="right" {...props} /> : <LazyDialog size={size} {...props} />;
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
