"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "gp:sidebar";

function read(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Sidebar collapse, remembered per zone in localStorage (a per-browser convenience only). */
export function useSidebarCollapsed(zone: string): [boolean, () => void] {
  const key = `gp_sidebar_${zone}`;
  const collapsed = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => false,
  );
  const toggle = useCallback(() => {
    try {
      window.localStorage.setItem(key, read(key) ? "0" : "1");
    } catch {
      // storage unavailable: the toggle does nothing
    }
    window.dispatchEvent(new Event(EVENT));
  }, [key]);
  return [collapsed, toggle];
}
