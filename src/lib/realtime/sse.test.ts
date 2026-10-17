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
});
