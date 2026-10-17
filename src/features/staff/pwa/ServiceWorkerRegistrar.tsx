"use client";

import { useEffect } from "react";

import { registerStaffServiceWorker } from "@/lib/pwa/register";

/** Registers the staff service worker once the page is interactive (production builds only). */
export function ServiceWorkerRegistrar({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (enabled) void registerStaffServiceWorker();
  }, [enabled]);
  return null;
}
