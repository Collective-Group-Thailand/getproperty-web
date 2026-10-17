// @vitest-environment node
import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { discard, enqueue, getEntry, listQueue, replayQueue, resetQueueDb, retry, SENT_TTL_MS } from "./queue";

type Call = { url: string; method: string; headers: Headers; body: unknown };

function api(answer: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
    };
    calls.push(call);
    return answer(call);
  });
  return { calls, fetchImpl: fetchImpl as unknown as typeof fetch };
}

const reading = {
  method: "POST" as const,
  path: "/v1/staff/meter-readings",
  body: { assetItemId: "m1", typedValue: "123.4" },
  label: "A-201 ไฟ",
};

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetQueueDb();
});

describe("offline queue (ADR-0007)", () => {
  it("replays through the BFF with the Idempotency-Key fixed at enqueue time, then keeps the answer", async () => {
    const entry = await enqueue(reading);
    const { calls, fetchImpl } = api(() => Response.json({ id: "r1", reviewState: "accepted" }, { status: 201 }));
    const result = await replayQueue(fetchImpl);
    expect(result).toMatchObject({ sent: 1, conflicts: 0, remaining: 0 });
    expect(calls[0]!.url).toBe("/bff/v1/staff/meter-readings");
    expect(calls[0]!.headers.get("idempotency-key")).toBe(entry.idempotencyKey);
    expect(calls[0]!.headers.get("x-getproperty-csrf")).toBe("1");
    expect(await getEntry(entry.id)).toMatchObject({ state: "sent", result: { id: "r1", reviewState: "accepted" } });

    // Sent is final: never replayed again, and pruned after a day.
    await replayQueue(fetchImpl);
    expect(calls).toHaveLength(1);
    expect(await listQueue(Date.now() + SENT_TTL_MS + 1)).toEqual([]);
  });

  it("keeps what an entry is about (meta) for the screen that queued it", async () => {
    const meta = {
      kind: "meter-reading" as const,
      assetItemId: "m1",
      buildingId: "b1",
      periodKey: "2026-10",
      unitNo: "A-201",
      code: "E-A-201",
      utility: "electric" as const,
      typedValue: "123.4",
    };
    const entry = await enqueue({ ...reading, meta });
    expect((await getEntry(entry.id))?.meta).toEqual(meta);
  });

  it("keeps the same key across retries after a network failure or a 5xx", async () => {
    const entry = await enqueue(reading);
    let clock = Date.now();
    const now = () => clock;
    const down = api(() => {
      throw new TypeError("Failed to fetch");
    });
    expect((await replayQueue(down.fetchImpl, now)).remaining).toBe(1);
    const busy = api(() => new Response("", { status: 503 }));
    clock += 60_000;
    await replayQueue(busy.fetchImpl, now);
    clock += 10 * 60_000;
    const ok = api(() => Response.json({}, { status: 201 }));
    expect((await replayQueue(ok.fetchImpl, now)).sent).toBe(1);
    expect(ok.calls[0]!.headers.get("idempotency-key")).toBe(entry.idempotencyKey);
    expect(busy.calls[0]!.headers.get("idempotency-key")).toBe(entry.idempotencyKey);
  });

  it("does not resend before the backoff is over", async () => {
    await enqueue(reading);
    let clock = Date.now();
    const failing = api(() => new Response("", { status: 500 }));
    await replayQueue(failing.fetchImpl, () => clock);
    clock += 1_000;
    await replayQueue(failing.fetchImpl, () => clock);
    expect(failing.calls).toHaveLength(1);
  });

  it("turns a refusal into a conflict with the API's problem, never retried blindly", async () => {
    const entry = await enqueue(reading);
    const { fetchImpl, calls } = api(() =>
      Response.json(
        { code: "reading.lower_than_previous", detail: "ต่ำกว่าครั้งก่อน", requestId: "rq-1" },
        { status: 422, headers: { "content-type": "application/problem+json" } },
      ),
    );
    expect((await replayQueue(fetchImpl)).conflicts).toBe(1);
    await replayQueue(fetchImpl);
    expect(calls).toHaveLength(1);
    const [stored] = await listQueue();
    expect(stored).toMatchObject({
      state: "conflict",
      problem: { status: 422, code: "reading.lower_than_previous", requestId: "rq-1" },
    });

    const ok = api(() => Response.json({}, { status: 201 }));
    await retry(entry.id);
    expect((await replayQueue(ok.fetchImpl)).sent).toBe(1);
  });

  it("retries a photo still being virus-scanned (or a key still in progress) instead of a conflict", async () => {
    const entry = await enqueue(reading);
    let clock = Date.now();
    for (const code of ["document.scan_pending", "idempotency.in_progress"]) {
      const notYet = api(() =>
        Response.json(
          { code, detail: "", requestId: "r" },
          { status: 409, headers: { "content-type": "application/problem+json" } },
        ),
      );
      expect(await replayQueue(notYet.fetchImpl, () => clock)).toMatchObject({ conflicts: 0, remaining: 1 });
      expect((await getEntry(entry.id))!.state).toBe("pending");
      clock += 20 * 60_000;
    }
    const ok = api(() => Response.json({ id: "r1" }, { status: 201 }));
    expect((await replayQueue(ok.fetchImpl, () => clock)).sent).toBe(1);
    expect(ok.calls[0]!.headers.get("idempotency-key")).toBe(entry.idempotencyKey);
  });

  it("stops at a 401 and keeps everything for after the next sign-in", async () => {
    await enqueue(reading);
    await enqueue({ ...reading, label: "A-202 ไฟ" });
    const { fetchImpl, calls } = api(() => new Response("", { status: 401 }));
    const result = await replayQueue(fetchImpl);
    expect(result.stopped).toBe("signed-out");
    expect(calls).toHaveLength(1);
    expect((await listQueue()).every((entry) => entry.state === "pending")).toBe(true);
  });

  it("uploads the photo by presign once, then sends its fileId", async () => {
    const photo = new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" });
    await enqueue({
      ...reading,
      photo: {
        blob: photo,
        fileName: "a201.jpg",
        kind: "meter_photo",
        scopeType: "unit",
        scopeId: null,
        bodyField: "photoDocumentId",
      },
    });
    let readingAttempts = 0;
    const { calls, fetchImpl } = api((call) => {
      if (call.url === "/bff/v1/staff/files/presign") {
        return Response.json({
          file: { id: "f1" },
          uploadUrl: "https://storage.test/put",
          headers: { "Content-Type": "image/jpeg" },
          multipart: null,
          expiresAt: "x",
        });
      }
      if (call.url === "https://storage.test/put") return new Response(null, { status: 200 });
      if (call.url.endsWith("/actions/complete")) return Response.json({});
      readingAttempts += 1;
      return readingAttempts === 1 ? new Response("", { status: 503 }) : Response.json({}, { status: 201 });
    });
    await replayQueue(fetchImpl, () => Date.now());
    await replayQueue(fetchImpl, () => Date.now() + 10 ** 9);
    expect(calls.filter((call) => call.url.endsWith("/presign"))).toHaveLength(1);
    const presign = calls.find((call) => call.url.endsWith("/presign"))!.body as Record<string, unknown>;
    expect(presign).toMatchObject({ kind: "meter_photo", sizeBytes: 3, mimeType: "image/jpeg" });
    expect(presign.sha256).toMatch(/^[0-9a-f]{64}$/);
    const sent = calls.filter((call) => call.url === "/bff/v1/staff/meter-readings");
    expect(sent).toHaveLength(2);
    expect((sent[1]!.body as Record<string, unknown>).photoDocumentId).toBe("f1");
    // The photo bytes are dropped once sent; the file id stays.
    const [stored] = await listQueue();
    expect(stored!.photo).toMatchObject({ fileId: "f1" });
    expect(stored!.photo!.blob).toBeUndefined();
  });

  it("discards on request", async () => {
    const entry = await enqueue(reading);
    await discard(entry.id);
    expect(await listQueue()).toEqual([]);
  });
});
