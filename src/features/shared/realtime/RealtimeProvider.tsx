"use client";

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";

import { connectRealtime, invalidationKeys, type RealtimeStatus } from "@/lib/realtime/client";
import type { Zone } from "@/lib/zones";

const StatusContext = createContext<RealtimeStatus>("closed");

/**
 * One realtime stream per tab and zone (contract §6). Events carry ids only: each one invalidates the
 * TanStack Query keys it concerns (`invalidationKeys`) and the screens refetch through the API.
 */
export function RealtimeProvider({
  zone,
  tenantId,
  children,
}: {
  zone: Zone;
  tenantId: string | null;
  children: React.ReactNode;
}) {
  const client = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  useEffect(
    () =>
      connectRealtime({
        zone,
        onStatus: setStatus,
        onEvent: (event) => {
          for (const queryKey of invalidationKeys(zone, tenantId, event.type)) {
            void client.invalidateQueries({ queryKey });
          }
        },
      }),
    [client, tenantId, zone],
  );

  return <StatusContext.Provider value={status}>{children}</StatusContext.Provider>;
}

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(StatusContext);
}
