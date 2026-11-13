"use client";

import { Suspense, type ComponentProps } from "react";

import { lazyWarm } from "@/ui/lib/lazy";

import type { ZoneError as ZoneErrorType } from "./ZoneError";

type ZoneErrorProps = ComponentProps<typeof ZoneErrorType>;

const ZoneErrorImpl = lazyWarm(() => import("./ZoneError").then((module) => module.ZoneError));

/**
 * `error.tsx` of every zone. Next loads each segment's error boundary with the page, so a boundary that
 * imports `ZoneError` directly puts Button, Slot and ErrorState (≈ 4 KB gz) into every first load of
 * a zone that is almost never in error. The body is warmed on the first interaction like an overlay
 * (D-179) — cached by the staff PWA's service worker for an error that happens offline.
 */
export function LazyZoneError(props: ZoneErrorProps) {
  return (
    <Suspense fallback={null}>
      <ZoneErrorImpl {...props} />
    </Suspense>
  );
}
