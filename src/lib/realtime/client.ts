import { CSRF_HEADER } from "@/lib/api/headers";
import type { Zone } from "@/lib/zones";

import { SseParser, type ServerSentEvent } from "./sse";

/**
 * Realtime (contract §6): `POST /v1/{surface}/realtime/auth` (through the zone BFF) returns a 60-second
 * stream token and the stream URL; the stream carries ids + type only, so the client invalidates the
 * matching queries and refetches through the normal API. On any break it re-authorises with backoff
 * (the stream token is single-use and short-lived), and it resumes when the browser comes back online.
 */
export type RealtimeStatus = "connecting" | "open" | "closed";

export interface DomainEvent {
  type: string;
  ids: Record<string, string>;
}

const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

export interface RealtimeOptions {
  zone: Zone;
  onEvent: (event: DomainEvent) => void;
  onStatus?: (status: RealtimeStatus) => void;
  fetch?: typeof fetch;
}

export function connectRealtime({ zone, onEvent, onStatus, fetch: fetchImpl = fetch }: RealtimeOptions): () => void {
  let stopped = false;
  let attempt = 0;
  /**
   * Generation of the current connection (review M2). Every `run()` captures it; `online`, a reconnect and `stop()`
   * bump it and abort the previous controller, so a superseded run neither schedules another one nor keeps a
   * stream open — there is never more than one stream, and none after `stop()`.
   */
  let generation = 0;
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const setStatus = (status: RealtimeStatus) => {
    if (!stopped) onStatus?.(status);
  };

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  /** Ends whatever connection is in flight and starts a new generation. */
  const supersede = (): number => {
    clearTimer();
    controller?.abort();
    controller = undefined;
    generation += 1;
    return generation;
  };

  const schedule = (gen: number) => {
    if (stopped || gen !== generation) return;
    setStatus("closed");
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!;
    attempt += 1;
    clearTimer();
    timer = setTimeout(() => {
      timer = undefined;
      start();
    }, delay);
  };

  const dispatch = (gen: number, message: ServerSentEvent) => {
    if (gen !== generation) return;
    if (message.event === "ready") {
      attempt = 0;
      setStatus("open");
      return;
    }
    if (message.event === "heartbeat" || message.event === "close") return;
    try {
      const payload = JSON.parse(message.data) as Partial<DomainEvent>;
      onEvent({ type: payload.type ?? message.event, ids: payload.ids ?? {} });
    } catch {
      // A malformed event is skipped; the next refetch reconciles anyway.
    }
  };

  async function run(gen: number, own: AbortController) {
    const current = () => !stopped && gen === generation;
    setStatus("connecting");
    try {
      const auth = await fetchImpl(`/bff/v1/${zone}/realtime/auth`, {
        method: "POST",
        headers: { [CSRF_HEADER]: "1", accept: "application/json" },
        signal: own.signal,
      });
      if (!current()) {
        await auth.body?.cancel().catch(() => undefined);
        return;
      }
      if (auth.status === 401 || auth.status === 403) {
        // Signed out or not entitled: stay closed until the page reloads.
        setStatus("closed");
        stopped = true;
        supersede();
        return;
      }
      if (!auth.ok) return schedule(gen);
      // The token itself stays in the BFF's httpOnly cookie (review L6); the URL carries none.
      const { streamUrl } = (await auth.json()) as { streamUrl: string };
      if (!current()) return;
      const stream = await fetchImpl(`/bff${streamUrl}`, {
        headers: { accept: "text/event-stream" },
        signal: own.signal,
      });
      if (!current()) {
        await stream.body?.cancel().catch(() => undefined);
        return;
      }
      if (!stream.ok || !stream.body) return schedule(gen);
      const reader = stream.body.pipeThrough(new TextDecoderStream()).getReader();
      const parser = new SseParser();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || !current()) break;
          for (const message of parser.push(value)) dispatch(gen, message);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      schedule(gen);
    } catch {
      // An abort from `online`/`stop()` belongs to a superseded generation: nothing to schedule.
      schedule(gen);
    }
  }

  function start() {
    if (stopped) return;
    const gen = supersede();
    const own = new AbortController();
    controller = own;
    void run(gen, own);
  }

  const online = () => {
    if (stopped) return;
    attempt = 0;
    start();
  };
  if (typeof window !== "undefined") window.addEventListener("online", online);
  start();

  return () => {
    if (stopped) return;
    onStatus?.("closed");
    stopped = true;
    supersede();
    if (typeof window !== "undefined") window.removeEventListener("online", online);
  };
}

/**
 * Which cached queries an event makes stale: the notification inbox for `notification.*`, otherwise
 * the tenant's queries of the entity the event names (`invoice.paid` → `invoices`) and the dashboard.
 */
const ENTITY_KEYS: Record<string, string> = {
  invoice: "invoices",
  payment: "payments",
  reading: "readings",
  meter: "meters",
  device: "devices",
  lease: "leases",
  unit: "units",
  building: "buildings",
  deposit: "deposits",
  service_request: "service-requests",
  work_order: "work-orders",
  support_grant: "support-grants",
};

export function invalidationKeys(zone: Zone, tenantId: string | null, type: string): readonly unknown[][] {
  const entity = type.split(".")[0] ?? "";
  if (entity === "notification") return [[zone, "notifications"]];
  const key = ENTITY_KEYS[entity];
  const scope = [zone, "tenant", tenantId ?? "-"];
  return key
    ? [
        [...scope, key],
        [...scope, "dashboard"],
        [zone, "notifications"],
      ]
    : [[zone, "notifications"]];
}
