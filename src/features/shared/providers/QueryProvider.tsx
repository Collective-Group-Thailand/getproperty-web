"use client";

import { QueryClientProvider } from "@tanstack/react-query";

import { getQueryClient } from "@/lib/api/query-client";

/**
 * TanStack Query for the client components below it — one client per tab, so every `QueryProvider`
 * shares one cache. Not mounted by the console shells (D-179): a page or lazily loaded panel that
 * uses queries wraps itself, and TanStack ships only with them.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={getQueryClient()}>{children}</QueryClientProvider>;
}
