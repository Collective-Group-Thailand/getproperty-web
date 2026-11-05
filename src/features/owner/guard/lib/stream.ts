import { SseParser, type ServerSentEvent } from "@/lib/realtime/sse";

import { bffUrl } from "./api";

/**
 * The gate's live stream (`GET /v1/guard/events`, D-327 §5) through the guard BFF, read with fetch so the request
 * carries the guard's session (the BFF adds the Bearer) and `Last-Event-ID` — `EventSource` can send neither.
 *
 * - Every event carries `id:` = the visit / incident event id; the last one seen is sent back on reconnect, so the
 *   API replays what the tablet missed (last 24 h, ≤ 500) and nothing is lost across a dropped connection.
 * - Reconnects with exponential backoff and jitter (1 s → 30 s), at once when the browser comes back online.
 * - `onReconnect` fires on every `ready` after the first: the desk refetches its lists and the open incidents
 *   (an SOS raised while the stream was down must take over the screen, J4.2 §5).
 * - 401 / 403 stop the stream (`onStatus("unauthorised")`): the desk goes back to the PIN pad.
 */
export type StreamStatus = "connecting" | "open" | "closed" | "unauthorised";

export interface GateStreamEvent {
  type: string;
  ids: Record<string, string>;
  id?: string;
}

export interface GateStreamOptions {
  onEvent: (event: GateStreamEvent) => void;
  onStatus?: (status: StreamStatus) => void;
  onReconnect?: () => void;
  fetch?: typeof fetch;
  /** Resume after this event id (kept by the caller across page reloads if it wishes). */
  lastEventId?: string;
  /** Tests: deterministic jitter. */
  random?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export const STREAM_BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

/** Backoff for the n-th consecutive failure (0-based) with ±20 % jitter so a fleet of tablets does not reconnect in step. */
export function backoffDelay(attempt: number, random: () => number = Math.random): number {
  const base = STREAM_BACKOFF_MS[Math.min(attempt, STREAM_BACKOFF_MS.length - 1)]!;
  return Math.round(base * (0.8 + random() * 0.4));
}

export function parseStreamEvent(message: ServerSentEvent): GateStreamEvent | null {
  if (message.event === "heartbeat" || message.event === "ready" || message.event === "close") return null;
  try {
    const payload = JSON.parse(message.data) as { type?: string; ids?: Record<string, string> };
    return { type: payload.type ?? message.event, ids: payload.ids ?? {}, ...(message.id ? { id: message.id } : {}) };
  } catch {
    return { type: message.event, ids: {}, ...(message.id ? { id: message.id } : {}) };
  }
}

export function connectGateStream(options: GateStreamOptions): {
  stop: () => void;
  lastEventId: () => string | undefined;
} {
  const fetchImpl = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const setTimer = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = options.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  let lastEventId = options.lastEventId;
  let stopped = false;
  let attempt = 0;
  let readyCount = 0;
  let generation = 0;
  let controller: AbortController | undefined;
  let timer: unknown;

  const status = (value: StreamStatus) => {
    if (!stopped) options.onStatus?.(value);
  };

  const supersede = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
    controller?.abort();
    controller = undefined;
    generation += 1;
    return generation;
  };

  const schedule = (gen: number) => {
    if (stopped || gen !== generation) return;
    status("closed");
    const delay = backoffDelay(attempt, options.random);
    attempt += 1;
    timer = setTimer(() => {
      timer = undefined;
      start();
    }, delay);
  };

  async function run(gen: number, own: AbortController) {
    const current = () => !stopped && gen === generation;
    status("connecting");
    try {
      const headers: Record<string, string> = { accept: "text/event-stream" };
      if (lastEventId) headers["last-event-id"] = lastEventId;
      const response = await fetchImpl(bffUrl("/v1/guard/events"), {
        headers,
        cache: "no-store",
        credentials: "same-origin",
        signal: own.signal,
      });
      if (!current()) {
        await response.body?.cancel().catch(() => undefined);
        return;
      }
      if (response.status === 401 || response.status === 403) {
        status("unauthorised");
        stopped = true;
        supersede();
        return;
      }
      if (!response.ok || !response.body) return schedule(gen);
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      const parser = new SseParser();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done || !current()) break;
          for (const message of parser.push(value)) {
            if (message.id) lastEventId = message.id;
            if (message.event === "ready") {
              attempt = 0;
              readyCount += 1;
              status("open");
              if (readyCount > 1) options.onReconnect?.();
              continue;
            }
            const event = parseStreamEvent(message);
            if (event) options.onEvent(event);
          }
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      schedule(gen);
    } catch {
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

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      supersede();
      if (typeof window !== "undefined") window.removeEventListener("online", online);
      options.onStatus?.("closed");
    },
    lastEventId: () => lastEventId,
  };
}
