import { describe, expect, it, vi } from "vitest";

import { SseParser } from "@/lib/realtime/sse";

import { backoffDelay, connectGateStream, parseStreamEvent, STREAM_BACKOFF_MS, type StreamStatus } from "./stream";

function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(body, { status, headers: { "content-type": "text/event-stream" } });
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("SSE parsing of the gate stream", () => {
  it("parses events split across chunks with their ids", () => {
    const parser = new SseParser();
    const first = parser.push('id: e1\nevent: gate.visit.answered\ndata: {"type":"gate.visit.answered",');
    expect(first).toEqual([]);
    const [message] = parser.push('"ids":{"visitId":"v1"}}\n\n');
    expect(parseStreamEvent(message!)).toEqual({ type: "gate.visit.answered", ids: { visitId: "v1" }, id: "e1" });
  });
  it("skips ready and heartbeats, keeps a malformed event by its name", () => {
    expect(parseStreamEvent({ event: "heartbeat", data: "{}" })).toBeNull();
    expect(parseStreamEvent({ event: "ready", data: "{}" })).toBeNull();
    expect(parseStreamEvent({ event: "gate.incident.raised", data: "oops" })).toEqual({
      type: "gate.incident.raised",
      ids: {},
    });
  });
  it("backs off with jitter inside ±20 %", () => {
    expect(backoffDelay(0, () => 0.5)).toBe(1_000);
    expect(backoffDelay(10, () => 0)).toBe(STREAM_BACKOFF_MS.at(-1)! * 0.8);
    expect(backoffDelay(2, () => 1)).toBe(6_000);
  });
});

describe("connectGateStream", () => {
  it("delivers events, reconnects with Last-Event-ID and asks for a refetch after the break", async () => {
    const requests: Headers[] = [];
    let call = 0;
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      requests.push(new Headers(init?.headers));
      call += 1;
      if (call === 1) {
        return streamResponse([
          "event: ready\ndata: {}\n\n",
          'id: e7\nevent: gate.visit.requested\ndata: {"type":"gate.visit.requested","ids":{"visitId":"v7"}}\n\n',
        ]);
      }
      if (call === 2) return streamResponse(["event: ready\ndata: {}\n\n"]);
      return new Promise<Response>(() => undefined);
    });
    const timers: (() => void)[] = [];
    const events: string[] = [];
    const statuses: StreamStatus[] = [];
    const onReconnect = vi.fn();
    const stream = connectGateStream({
      fetch: fetchImpl as typeof fetch,
      onEvent: (event) => events.push(`${event.type}:${event.ids.visitId}`),
      onStatus: (status) => statuses.push(status),
      onReconnect,
      random: () => 0.5,
      setTimer: (fn) => timers.push(fn),
      clearTimer: () => undefined,
    });
    await flush();
    await flush();
    expect(events).toEqual(["gate.visit.requested:v7"]);
    expect(stream.lastEventId()).toBe("e7");
    expect(statuses).toContain("open");
    expect(statuses.at(-1)).toBe("closed");
    expect(onReconnect).not.toHaveBeenCalled();
    timers.shift()!();
    await flush();
    await flush();
    expect(requests[1]!.get("last-event-id")).toBe("e7");
    expect(onReconnect).toHaveBeenCalledTimes(1);
    stream.stop();
  });

  it("stops for good on 401", async () => {
    const statuses: StreamStatus[] = [];
    const timers: (() => void)[] = [];
    connectGateStream({
      fetch: (async () => new Response(null, { status: 401 })) as typeof fetch,
      onEvent: () => undefined,
      onStatus: (status) => statuses.push(status),
      setTimer: (fn) => timers.push(fn),
      clearTimer: () => undefined,
    });
    await flush();
    expect(statuses).toEqual(["connecting", "unauthorised"]);
    expect(timers).toHaveLength(0);
  });

  it("retries a failed connection with growing delays", async () => {
    const delays: number[] = [];
    const timers: (() => void)[] = [];
    connectGateStream({
      fetch: (async () => {
        throw new TypeError("offline");
      }) as typeof fetch,
      onEvent: () => undefined,
      random: () => 0.5,
      setTimer: (fn, ms) => {
        delays.push(ms);
        timers.push(fn);
      },
      clearTimer: () => undefined,
    });
    await flush();
    timers.shift()!();
    await flush();
    timers.shift()!();
    await flush();
    expect(delays).toEqual([1_000, 2_000, 5_000]);
  });
});
