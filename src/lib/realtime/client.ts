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
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const setStatus = (status: RealtimeStatus) => onStatus?.(status);

  const schedule = () => {
    if (stopped) return;
    setStatus("closed");
    const delay = BACKOFF_MS[Math.min(attempt, BACKOFF_MS.length - 1)]!;
    attempt += 1;
    timer = setTimeout(run, delay);
  };

  const dispatch = (message: ServerSentEvent) => {
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

  async function run() {
    if (stopped) return;
    setStatus("connecting");
    controller = new AbortController();
    try {
      const auth = await fetchImpl(`/bff/v1/${zone}/realtime/auth`, {
        method: "POST",
        headers: { [CSRF_HEADER]: "1", accept: "application/json" },
        signal: controller.signal,
      });
      if (auth.status === 401 || auth.status === 403) {
        // Signed out or not entitled: stay closed until the page reloads.
        stopped = true;
        setStatus("closed");
        return;
      }
      if (!auth.ok) return schedule();
      const { streamUrl } = (await auth.json()) as { streamUrl: string };
      const stream = await fetchImpl(`/bff${streamUrl}`, {
        headers: { accept: "text/event-stream" },
        signal: controller.signal,
      });
      if (!stream.ok || !stream.body) return schedule();
      const reader = stream.body.pipeThrough(new TextDecoderStream()).getReader();
      const parser = new SseParser();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const message of parser.push(value)) dispatch(message);
      }
      schedule();
    } catch {
      if (!stopped) schedule();
    }
  }

  const online = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    attempt = 0;
    controller?.abort();
    void run();
  };
  if (typeof window !== "undefined") window.addEventListener("online", online);
  void run();

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    controller?.abort();
    if (typeof window !== "undefined") window.removeEventListener("online", online);
    setStatus("closed");
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
