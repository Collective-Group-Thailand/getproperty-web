"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/ui/components/Button";
// eslint-disable-next-line no-restricted-imports -- this module is itself loaded on first open (DeviceLock, D-179)
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

import { LOCK_AFTER_MINUTES, MAX_PIN_ATTEMPTS, PIN_PATTERN, recordActivity, setPin, verifyPin } from "./pin";
import { signOutStaff } from "../pwa/leaveDevice";
import { lockStore } from "./store";

export interface DeviceLockDialogsProps {
  /** True while either dialog is open — what `lazyOverlay` loads this module on. */
  open: boolean;
  setupOpen: boolean;
  onSetupOpenChange: (open: boolean) => void;
  locked: boolean;
  loginHref: string;
}

/**
 * The PIN set-up dialog and the lock screen of `DeviceLock`, loaded the first time one opens (D-179):
 * most staff sessions never show either.
 */
export function DeviceLockDialogs({ setupOpen, onSetupOpenChange, locked, loginHref }: DeviceLockDialogsProps) {
  const t = useTranslations("staff.lock");
  const common = useTranslations("common");
  const [pin, setPinValue] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [pending, startTransition] = useTransition();
  const [lastSetupOpen, setLastSetupOpen] = useState(setupOpen);

  // A fresh form every time the set-up dialog opens.
  if (setupOpen !== lastSetupOpen) {
    setLastSetupOpen(setupOpen);
    if (setupOpen) {
      setPinValue("");
      setAgain("");
      setError(null);
    }
  }

  const save = () =>
    startTransition(async () => {
      if (!PIN_PATTERN.test(pin)) return setError(t("pinInvalid"));
      if (pin !== again) return setError(t("pinMismatch"));
      await setPin(pin);
      recordActivity();
      lockStore.setEnabled(true);
      onSetupOpenChange(false);
    });

  const unlock = () =>
    startTransition(async () => {
      if (await verifyPin(pin)) {
        recordActivity();
        lockStore.unlock();
        setAttempts(0);
        setPinValue("");
        setError(null);
        return;
      }
      const used = attempts + 1;
      setAttempts(used);
      setPinValue("");
      if (used >= MAX_PIN_ATTEMPTS) {
        await signOutStaff(loginHref); // also clears the PIN, the queue, caches and push (review H2, M4)
        return;
      }
      setError(t("wrongPin", { count: MAX_PIN_ATTEMPTS - used }));
    });

  return (
    <>
      <Dialog
        open={setupOpen}
        onOpenChange={onSetupOpenChange}
        title={t("setupTitle")}
        description={t("setupBody", { minutes: LOCK_AFTER_MINUTES })}
        closeLabel={common("close")}
        footer={
          <Button size="lg" loading={pending} onClick={save}>
            {t("save")}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label={t("pin")} error={error ?? undefined}>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={pin}
              onChange={(e) => setPinValue(e.target.value)}
            />
          </Field>
          <Field label={t("pinAgain")}>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={again}
              onChange={(e) => setAgain(e.target.value)}
            />
          </Field>
        </div>
      </Dialog>
      <Dialog open={locked} onOpenChange={() => {}} title={t("lockedTitle")} description={t("lockedBody")}>
        <form
          className="flex flex-col gap-4"
          data-testid="device-lock"
          onSubmit={(event) => {
            event.preventDefault();
            unlock();
          }}
        >
          <Field label={t("pin")} error={error ?? undefined}>
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              autoFocus
              value={pin}
              onChange={(e) => setPinValue(e.target.value)}
            />
          </Field>
          <Button type="submit" size="lg" block loading={pending}>
            {t("unlock")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() =>
              startTransition(async () => {
                await signOutStaff(loginHref);
              })
            }
          >
            {t("signOutInstead")}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
