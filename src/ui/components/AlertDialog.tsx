"use client";

import { useId, useState } from "react";
import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { cn } from "../lib/cn";
import { useReturnFocus } from "../lib/useReturnFocus";
import { Button } from "./Button";
import { controlVariants } from "./Input";

export interface AlertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What is about to happen, in the user's words. */
  title: React.ReactNode;
  /**
   * The consequence, restating the target — room code and amount for anything financial
   * (00-master-plan.md §8). This is the sentence that stops the wrong click.
   */
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  /** `destructive` for anything that voids, terminates, refunds or revokes. */
  tone?: "primary" | "destructive";
  loading?: boolean;
  /**
   * Turns this into a **typed confirmation**: the user retypes this exact string — a room code, a
   * bill number — before the action unlocks. Required by 00-master-plan.md §8 for irreversible
   * actions: issue bills, void bill, record manual payment, approve slip, refund, deposit refund,
   * terminate lease, revoke access, bank-account change, cancel subscription.
   */
  confirmationPhrase?: string;
  /** Label for the typed-confirmation input, from `src/i18n` (it names the phrase to type). */
  confirmationLabel?: string;
  /** Keeps the confirm button disabled while inputs inside the dialog (a reason, an amount) are incomplete. */
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

/**
 * A confirmation the user cannot dismiss by accident: no scrim close, no Escape-to-confirm,
 * focus starts on Cancel, and the destructive action is never the default focus.
 */
export function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  tone = "primary",
  loading = false,
  confirmationPhrase,
  confirmationLabel,
  confirmDisabled = false,
  children,
}: AlertDialogProps) {
  const returnFocus = useReturnFocus();

  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className="z-overlay bg-overlay fixed inset-0" />
        <AlertDialogPrimitive.Content
          {...returnFocus}
          className={cn(
            "z-modal fixed top-1/2 left-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
            "border-border bg-surface-raised rounded-card shadow-overlay border p-5",
          )}
        >
          <AlertDialogPrimitive.Title className="text-lg font-semibold">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="text-muted mt-2 text-sm">
            {description}
          </AlertDialogPrimitive.Description>

          {children}

          {/*
            Radix unmounts Content when the dialog closes, so the typed confirmation lives in
            a child: its state resets on every open without an effect, and a reopened dialog
            can never arrive already unlocked.
          */}
          <Confirmation
            confirmationPhrase={confirmationPhrase}
            confirmationLabel={confirmationLabel}
            confirmLabel={confirmLabel}
            cancelLabel={cancelLabel}
            onConfirm={onConfirm}
            tone={tone}
            loading={loading}
            confirmDisabled={confirmDisabled}
          />
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

function Confirmation({
  confirmationPhrase,
  confirmationLabel,
  confirmLabel,
  cancelLabel,
  onConfirm,
  tone,
  loading,
  confirmDisabled,
}: Pick<
  AlertDialogProps,
  | "confirmationPhrase"
  | "confirmationLabel"
  | "confirmLabel"
  | "cancelLabel"
  | "onConfirm"
  | "tone"
  | "loading"
  | "confirmDisabled"
>) {
  const inputId = useId();
  const [typed, setTyped] = useState("");
  // Case, spaces and dashes do not count: "a 301" is the same room as "A-301" — the check is that the
  // person read which record this is, not that they type punctuation.
  const plain = (value: string) => value.toUpperCase().replace(/[\s\-–_]/g, "");
  const locked = Boolean(confirmationPhrase) && plain(typed) !== plain(confirmationPhrase ?? "");

  return (
    <>
      {confirmationPhrase ? (
        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-sm font-medium">
            {confirmationLabel}
          </label>
          <input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder={confirmationPhrase}
            className={cn(controlVariants({ inputSize: "md" }), "font-mono")}
          />
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <AlertDialogPrimitive.Cancel asChild>
          <Button variant="secondary" disabled={loading}>
            {cancelLabel}
          </Button>
        </AlertDialogPrimitive.Cancel>
        {/*
          Not wrapped in AlertDialogPrimitive.Action: that closes the dialog on click, which
          would dismiss it even while the typed confirmation is still locked.
        */}
        <Button
          variant={tone === "destructive" ? "destructive-solid" : "primary"}
          onClick={onConfirm}
          disabled={locked || confirmDisabled}
          loading={loading}
        >
          {confirmLabel}
        </Button>
      </div>
    </>
  );
}
