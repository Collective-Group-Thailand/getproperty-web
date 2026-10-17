"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { lazyOverlay } from "@/ui/lib/lazy";

import type { DeviceLockDialogsProps } from "./DeviceLockDialogs";
import { clearPin, lastActivity, LOCK_AFTER_MINUTES, recordActivity } from "./pin";
import { lockStore } from "./store";

/** The set-up dialog and lock screen load when one first opens (D-179). */
const DeviceLockDialogs = lazyOverlay<DeviceLockDialogsProps>(() =>
  import("./DeviceLockDialogs").then((module) => module.DeviceLockDialogs),
);

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
  const { enabled, locked } = useSyncExternalStore(
    lockStore.subscribe,
    lockStore.getSnapshot,
    lockStore.getServerSnapshot,
  );
  const [setupOpen, setSetupOpen] = useState(false);
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

  const openSetup = useCallback(() => setSetupOpen(true), []);
  const remove = useCallback(() => {
    clearPin();
    lockStore.setEnabled(false);
  }, []);

  return (
    <Context.Provider value={{ enabled, openSetup, remove }}>
      <div aria-hidden={locked || undefined} inert={locked || undefined}>
        {children}
      </div>
      <DeviceLockDialogs
        open={setupOpen || locked}
        setupOpen={setupOpen}
        onSetupOpenChange={setSetupOpen}
        locked={locked}
        loginHref={loginHref}
      />
    </Context.Provider>
  );
}
