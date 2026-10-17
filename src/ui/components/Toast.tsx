"use client";

import { Suspense, useEffect, useState } from "react";
import type { ExternalToast, toast as SonnerToast } from "sonner";

import { lazyWarm } from "../lib/lazy";

/**
 * Toasts on sonner (design-system.md §3): a confirmation on the current page, with an undo where the
 * action is reversible. Mounted once per zone shell.
 *
 * Loaded on first use (D-179): `<Toaster>` renders nothing and `toast` is a small facade until the
 * first toast is shown; then sonner and the viewport load and the queued call runs. Calls return a
 * promise of sonner's toast id.
 */

type Sonner = typeof SonnerToast;
type Message = Parameters<Sonner>[0];
type ToastId = string | number;

const Viewport = lazyWarm(() => import("./ToastViewport").then((module) => module.ToastViewport));

let requested = false;
const hosts = new Set<() => void>();
let resolveReady: (sonner: Sonner) => void = () => undefined;
const ready = new Promise<Sonner>((resolve) => {
  resolveReady = resolve;
});

function call<R>(run: (sonner: Sonner) => R): Promise<R> {
  if (!requested) {
    requested = true;
    for (const show of hosts) show();
  }
  return ready.then(run);
}

type Variant = (message: Message, data?: ExternalToast) => Promise<ToastId>;

export const toast: Variant & {
  success: Variant;
  error: Variant;
  warning: Variant;
  info: Variant;
  message: Variant;
  loading: Variant;
  dismiss: (id?: ToastId) => Promise<ToastId>;
} = Object.assign((message: Message, data?: ExternalToast) => call((sonner) => sonner(message, data)), {
  success: (message: Message, data?: ExternalToast) => call((sonner) => sonner.success(message, data)),
  error: (message: Message, data?: ExternalToast) => call((sonner) => sonner.error(message, data)),
  warning: (message: Message, data?: ExternalToast) => call((sonner) => sonner.warning(message, data)),
  info: (message: Message, data?: ExternalToast) => call((sonner) => sonner.info(message, data)),
  message: (message: Message, data?: ExternalToast) => call((sonner) => sonner.message(message, data)),
  loading: (message: Message, data?: ExternalToast) => call((sonner) => sonner.loading(message, data)),
  dismiss: (id?: ToastId) => call((sonner) => sonner.dismiss(id)),
});

/** Where toasts appear. Renders nothing until the first `toast(…)`. */
export function Toaster({ position = "bottom-center" }: { position?: "bottom-center" | "top-right" | "bottom-right" }) {
  const [shown, setShown] = useState(requested);
  useEffect(() => {
    const show = () => setShown(true);
    hosts.add(show);
    if (requested) show();
    return () => {
      hosts.delete(show);
    };
  }, []);
  if (!shown) return null;
  return (
    <Suspense fallback={null}>
      <Viewport position={position} />
      <Ready />
    </Suspense>
  );
}

/** Resolves the queued calls once the viewport is mounted and subscribed to sonner's store. */
function Ready() {
  useEffect(() => {
    void import("sonner").then((module) => resolveReady(module.toast));
  }, []);
  return null;
}
