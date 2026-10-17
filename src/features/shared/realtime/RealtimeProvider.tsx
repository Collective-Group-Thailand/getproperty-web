"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

import { peekQueryClient } from "@/lib/api/query-runtime";
import { connectRealtime, invalidationKeys, type DomainEvent, type RealtimeStatus } from "@/lib/realtime/client";
import type { Zone } from "@/lib/zones";

const StatusContext = createContext<RealtimeStatus>("closed");

type Listener = (event: DomainEvent) => void;
const ListenersContext = createContext<Set<Listener> | null>(null);

/**
 * One realtime stream per tab and zone (contract §6). Events carry ids only: each one invalidates the
 * TanStack Query keys it concerns (`invalidationKeys`) and the screens refetch through the API.
 * Query Client loads on demand (D-179): before it exists nothing is cached, so there is nothing to
 * invalidate. Components that keep their own state (the notification badge) listen with
 * `useRealtimeEvents`.
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
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const [listeners] = useState(() => new Set<Listener>());

  useEffect(
    () =>
      connectRealtime({
        zone,
        onStatus: setStatus,
        onEvent: (event) => {
          const client = peekQueryClient();
          if (client) {
            for (const queryKey of invalidationKeys(zone, tenantId, event.type)) {
              void client.invalidateQueries({ queryKey });
            }
          }
          for (const listener of listeners) listener(event);
        },
      }),
    [listeners, tenantId, zone],
  );

  return (
    <ListenersContext.Provider value={listeners}>
      <StatusContext.Provider value={status}>{children}</StatusContext.Provider>
    </ListenersContext.Provider>
  );
}

/** Calls `listener` for every realtime event of this tab (latest callback, no resubscribe per render). */
export function useRealtimeEvents(listener: Listener): void {
  const listeners = useContext(ListenersContext);
  const latest = useRef(listener);
  useEffect(() => {
    latest.current = listener;
  });
  useEffect(() => {
    if (!listeners) return;
    const forward: Listener = (event) => latest.current(event);
    listeners.add(forward);
    return () => {
      listeners.delete(forward);
    };
  }, [listeners]);
}

export function useRealtimeStatus(): RealtimeStatus {
  return useContext(StatusContext);
}
