"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { SubscriptionSuspendedError } from "@/lib/api/errors";
import { onQueryClient } from "@/lib/api/query-runtime";

const ReadOnlyContext = createContext(false);

/**
 * Read-only mode of a suspended tenant (D-082). Starts from `me.subscription.readOnly` and also turns
 * on the moment any mutation is refused with `tenant.read_only` (the subscription may be suspended
 * while the page is open). Screens read it with `useReadOnly()` to disable mutations; the API is the
 * enforcement point either way.
 */
export function ReadOnlyProvider({ initial, children }: { initial: boolean; children: React.ReactNode }) {
  const [readOnly, setReadOnly] = useState(initial);

  // Mutations run through TanStack Query, which loads on demand (D-179): watch its cache once it exists.
  useEffect(
    () =>
      onQueryClient((client) =>
        client.getMutationCache().subscribe((event) => {
          if (event.type === "updated" && event.mutation.state.error instanceof SubscriptionSuspendedError) {
            setReadOnly(true);
          }
        }),
      ),
    [],
  );

  return <ReadOnlyContext.Provider value={readOnly}>{children}</ReadOnlyContext.Provider>;
}

export function useReadOnly(): boolean {
  return useContext(ReadOnlyContext);
}
