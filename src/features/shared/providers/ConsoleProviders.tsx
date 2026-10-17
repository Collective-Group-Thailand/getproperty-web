"use client";

import { Toaster } from "@/ui/components/Toast";

/**
 * What every console page needs on top of the root document. Kept out of `ZoneDocument` so the owner
 * host's public pages do not ship it (marketing budget, F1 1.3 §8), and lean by design (D-179):
 * - the toast viewport loads with the first toast;
 * - TanStack Query loads with the first component that needs a cache — wrap it in `QueryProvider`
 *   (pages with lists do, as do the notification panel and search); realtime invalidation and the
 *   read-only switch attach through `@/lib/api/query-runtime` once it exists;
 * - tooltips bring their own provider, overlays load on first open (`@/ui/components/overlays`).
 */
export function ConsoleProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}
