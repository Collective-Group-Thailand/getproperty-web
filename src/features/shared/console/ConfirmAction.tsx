"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button, type ButtonProps } from "@/ui/components/Button";
import { LazyAlertDialog } from "@/ui/components/overlays";
import { toast } from "@/ui/components/Toast";
import type { IconGlyph } from "@/ui/icons";

import { ProblemNotice, useApiAction, useIdempotencyKey } from "./useApiAction";

export interface ConfirmActionProps {
  /** The button that opens the confirmation. */
  label: string;
  icon?: IconGlyph;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  disabled?: boolean;
  testId?: string;
  /** What is about to happen ("ออกบิลทั้งหมด"). */
  title: string;
  /** The consequence restating the target — unit code, period, count, amount (00-master-plan.md §8). */
  description: React.ReactNode;
  confirmLabel: string;
  tone?: "primary" | "destructive";
  /**
   * Typed confirmation: the user retypes this (a unit code, an invoice number) before the action
   * unlocks. Required for irreversible actions (issue, void, manual payment, slip approval, refund,
   * deposit refund, termination…).
   */
  phrase?: string;
  /** Extra inputs inside the dialog (a reason, an amount). */
  children?: React.ReactNode;
  /** Whether the inputs inside are complete; the confirm button waits for it. */
  ready?: boolean;
  /**
   * The request. It receives the dialog's Idempotency-Key — one per opening, reused when the same
   * dialog retries after a network failure, so the API recognises the replay (contract §3) — and the
   * acknowledgement ids of D-021a warnings acknowledged in the dialog.
   */
  onConfirm: (idempotencyKey: string, acknowledgementIds: string[]) => Promise<unknown>;
  /**
   * Explains some refusals in the screen's own words (a designed state rather than the API's detail); return null to
   * fall back to the standard problem notice.
   */
  explain?: (error: unknown) => React.ReactNode | null;
  /** Toast after success. */
  successMessage?: string;
  onDone?: (result: unknown) => void;
}

/** A button that runs an irreversible request only after a (typed) confirmation (design-system.md §4). */
export function ConfirmAction({
  label,
  icon,
  variant = "primary",
  size = "md",
  disabled,
  testId,
  title,
  description,
  confirmLabel,
  tone = "primary",
  phrase,
  children,
  ready = true,
  onConfirm,
  explain,
  successMessage,
  onDone,
}: ConfirmActionProps) {
  const t = useTranslations("console.confirm");
  const common = useTranslations("common");
  const [open, setOpen] = useState(false);
  const idempotency = useIdempotencyKey();
  const action = useApiAction();
  const explained = action.error && explain ? explain(action.error) : null;

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
      <LazyAlertDialog
        open={open}
        onOpenChange={(next) => {
          if (!action.busy) setOpen(next);
        }}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel={common("cancel")}
        tone={tone}
        loading={action.busy || action.acknowledging}
        confirmationPhrase={phrase}
        confirmationLabel={phrase ? t("typeToConfirm", { phrase }) : undefined}
        confirmDisabled={!ready}
        onConfirm={() => {
          if (!ready) return;
          void action.run(
            (ackIds) => onConfirm(idempotency.key, ackIds),
            (result) => {
              setOpen(false);
              if (successMessage) toast.success(successMessage);
              onDone?.(result);
            },
          );
        }}
      >
        {children ? <div className="mt-4 flex flex-col gap-3">{children}</div> : null}
        {explained ?? (
          <ProblemNotice
            error={action.error}
            onAcknowledge={action.acknowledge}
            acknowledging={action.acknowledging}
            className="mt-4"
          />
        )}
      </LazyAlertDialog>
    </>
  );
}
