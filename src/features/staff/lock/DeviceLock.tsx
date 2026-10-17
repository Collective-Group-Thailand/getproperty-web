"use client";

import { useTranslations } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { signOut } from "@/lib/auth/actions";
import { Button } from "@/ui/components/Button";
import { Dialog } from "@/ui/components/Dialog";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

import {
  clearPin,
  lastActivity,
  LOCK_AFTER_MINUTES,
  MAX_PIN_ATTEMPTS,
  PIN_PATTERN,
  recordActivity,
  setPin,
  verifyPin,
} from "./pin";
import { lockStore } from "./store";

interface DeviceLockContext {
  enabled: boolean;
  openSetup: () => void;
  remove: () => void;
}

const Context = createContext<DeviceLockContext>({ enabled: false, openSetup: () => {}, remove: () => {} });

export function useDeviceLock(): DeviceLockContext {
  return useContext(Context);
}

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

/**
 * Optional re-lock of the staff PWA after `LOCK_AFTER_MINUTES` without use (00-master-plan.md §4).
 * The overlay cannot be dismissed; the PIN unlocks it, five wrong tries sign the device out.
 */
export function DeviceLock({ loginHref, children }: { loginHref: string; children: React.ReactNode }) {
  const t = useTranslations("staff.lock");
  const common = useTranslations("common");
  const { enabled, locked } = useSyncExternalStore(
    lockStore.subscribe,
    lockStore.getSnapshot,
    lockStore.getServerSnapshot,
  );
  const [setupOpen, setSetupOpen] = useState(false);
  const [pin, setPinValue] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [pending, startTransition] = useTransition();
  const lastTouch = useRef(0);
  const limit = LOCK_AFTER_MINUTES * 60_000;

  useEffect(() => {
    if (!enabled || locked) return;
    const touch = () => {
      const now = Date.now();
      if (now - lastTouch.current > 5_000) {
        lastTouch.current = now;
        recordActivity(now);
      }
    };
    const check = () => {
      const last = lastActivity();
      if (last !== null && Date.now() - last > limit) lockStore.lock();
    };
    for (const event of ACTIVITY_EVENTS) window.addEventListener(event, touch, { passive: true });
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 15_000);
    return () => {
      for (const event of ACTIVITY_EVENTS) window.removeEventListener(event, touch);
      document.removeEventListener("visibilitychange", check);
      window.clearInterval(timer);
    };
  }, [enabled, locked, limit]);

  const openSetup = useCallback(() => {
    setPinValue("");
    setAgain("");
    setError(null);
    setSetupOpen(true);
  }, []);
  const remove = useCallback(() => {
    clearPin();
    lockStore.setEnabled(false);
  }, []);

  const save = () =>
    startTransition(async () => {
      if (!PIN_PATTERN.test(pin)) return setError(t("pinInvalid"));
      if (pin !== again) return setError(t("pinMismatch"));
      await setPin(pin);
      recordActivity();
      lockStore.setEnabled(true);
      setSetupOpen(false);
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
        clearPin();
        await signOut();
        window.location.assign(loginHref);
        return;
      }
      setError(t("wrongPin", { count: MAX_PIN_ATTEMPTS - used }));
    });

  return (
    <Context.Provider value={{ enabled, openSetup, remove }}>
      <div aria-hidden={locked || undefined} inert={locked || undefined}>
        {children}
      </div>
      <Dialog
        open={setupOpen}
        onOpenChange={setSetupOpen}
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
                clearPin();
                await signOut();
                window.location.assign(loginHref);
              })
            }
          >
            {t("signOutInstead")}
          </Button>
        </form>
      </Dialog>
    </Context.Provider>
  );
}
