"use client";

import { TooltipProvider } from "@/ui/components/Tooltip";
import { Toaster } from "@/ui/components/Toast";

import { QueryProvider } from "./QueryProvider";

/**
 * What the consoles need on top of the root document: TanStack Query, tooltips, toasts. Kept out of
 * `ZoneDocument` so the owner host's public pages do not ship them (marketing budget, F1 1.3 §8).
 */
export function ConsoleProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryProvider>
  );
}
