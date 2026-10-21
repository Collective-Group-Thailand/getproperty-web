import { describe, expect, it, vi } from "vitest";

import { connectRealtime, invalidationKeys } from "./client";
import { SseParser } from "./sse";

describe("SseParser", () => {
  it("parses named events across chunk boundaries, comments and CRLF", () => {
    const parser = new SseParser();
    expect(parser.push('event: ready\ndata: {"channels":[]}\n')).toEqual([]);
    expect(parser.push('\n: keep-alive\r\nevent: invoice.paid\r\ndata: {"a":')).toEqual([
      { event: "ready", data: '{"channels":[]}', id: undefined },
    ]);
    expect(parser.push("1}\r\n\r\n")).toEqual([{ event: "invoice.paid", data: '{"a":1}', id: undefined }]);
  });

  it("joins multi-line data and defaults the event name", () => {
    expect(new SseParser().push("data: a\ndata: b\nid: 7\n\n")).toEqual([{ event: "message", data: "a\nb", id: "7" }]);
  });
});

describe("invalidationKeys", () => {
  it("maps an event type to the entity, the dashboard and the inbox", () => {
    expect(invalidationKeys("owner", "t1", "invoice.paid")).toEqual([
      ["owner", "tenant", "t1", "invoices"],
      ["owner", "tenant", "t1", "dashboard"],
      ["owner", "notifications"],
    ]);
    expect(invalidationKeys("admin", null, "notification.created")).toEqual([["admin", "notifications"]]);
    expect(invalidationKeys("staff", "t1", "something.new")).toEqual([["staff", "notifications"]]);
  });
});

describe("connectRealtime", () => {
  it("authorises through the BFF, opens the stream and delivers ids-only events", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        controller.enqueue(encoder.encode("event: ready\ndata: {}\n\nevent: heartbeat\ndata: {}\n\n"));
        controller.enqueue(
          encoder.encode('event: invoice.paid\ndata: {"type":"invoice.paid","ids":{"invoiceId":"i1"}}\n\n'),
        );
      },
    });
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input) === "/bff/v1/owner/realtime/auth") {
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get("x-getproperty-csrf")).toBe("1");
        return Response.json({ streamUrl: "/v1/owner/realtime/stream?token=t" });
      }
      expect(String(input)).toBe("/bff/v1/owner/realtime/stream?token=t");
      return new Response(body, { headers: { "content-type": "text/event-stream" } });
    });
    const events: unknown[] = [];
    const statuses: string[] = [];
    const stop = connectRealtime({
      zone: "owner",
      fetch: fetchImpl as unknown as typeof fetch,
      onEvent: (event) => events.push(event),
      onStatus: (status) => statuses.push(status),
    });
    await vi.waitFor(() => expect(events).toEqual([{ type: "invoice.paid", ids: { invoiceId: "i1" } }]));
    expect(statuses).toContain("open");
    stop();
  });

  it("stays closed when the session is gone", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 401 }));
    const statuses: string[] = [];
    connectRealtime({
      zone: "staff",
      fetch: fetchImpl as unknown as typeof fetch,
      onEvent: () => {},
      onStatus: (s) => statuses.push(s),
    });
    await vi.waitFor(() => expect(statuses.at(-1)).toBe("closed"));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  /** A BFF stub whose streams stay open until aborted or cancelled, counting the open ones (review M2). */
  function liveStreams() {
    let open = 0;
    let opened = 0;
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith("/realtime/auth")) return Response.json({ streamUrl: "/v1/staff/realtime/stream" });
      const signal = init?.signal;
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
      opened += 1;
      open += 1;
      let closed = false;
      const close = () => {
        if (!closed) {
          closed = true;
          open -= 1;
        }
      };
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode("event: ready\ndata: {}\n\n"));
          signal?.addEventListener("abort", () => {
            close();
            try {
              controller.error(new DOMException("aborted", "AbortError"));
            } catch {
              // already closed
            }
          });
        },
        cancel: close,
      });
      return new Response(body, { headers: { "content-type": "text/event-stream" } });
    });
    return { fetchImpl, open: () => open, opened: () => opened };
  }

  it("keeps exactly one stream across online events and closes it on stop()", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const api = liveStreams();
      const statuses: string[] = [];
      const stop = connectRealtime({
        zone: "staff",
        fetch: api.fetchImpl as unknown as typeof fetch,
        onEvent: () => {},
        onStatus: (status) => statuses.push(status),
      });
      await vi.waitFor(() => expect(api.open()).toBe(1));
      for (let flap = 0; flap < 3; flap += 1) {
        window.dispatchEvent(new Event("online"));
        await vi.advanceTimersByTimeAsync(35_000); // past every backoff step
        await vi.waitFor(() => expect(api.open()).toBe(1));
      }
      expect(api.opened()).toBe(4); // the first stream + one per `online`, each replacing the last
      stop();
      await vi.advanceTimersByTimeAsync(35_000);
      expect(api.open()).toBe(0);
      expect(api.opened()).toBe(4);
      expect(statuses.at(-1)).toBe("closed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("reconnects once after the stream drops, and never after stop()", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let streams = 0;
      const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
        if (String(input).endsWith("/realtime/auth")) return Response.json({ streamUrl: "/v1/owner/realtime/stream" });
        streams += 1;
        return new Response("event: ready\ndata: {}\n\n", { headers: { "content-type": "text/event-stream" } });
      });
      const stop = connectRealtime({ zone: "owner", fetch: fetchImpl as unknown as typeof fetch, onEvent: () => {} });
      await vi.waitFor(() => expect(streams).toBe(1));
      await vi.advanceTimersByTimeAsync(1_100);
      await vi.waitFor(() => expect(streams).toBe(2));
      stop();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(streams).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });
});
