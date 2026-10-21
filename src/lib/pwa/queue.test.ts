// @vitest-environment node
import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearQueue,
  discard,
  enqueue,
  getEntry,
  listQueue,
  NoQueueIdentityError,
  replayQueue,
  resetQueueDb,
  retry,
  SENT_TTL_MS,
  setQueueIdentity,
} from "./queue";

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

const ALICE = { userId: "u-alice", tenantId: "t-1" };

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetQueueDb();
  setQueueIdentity(ALICE);
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

const photoEntry = () => ({
  ...reading,
  photo: {
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/jpeg" }),
    fileName: "a201.jpg",
    kind: "meter_photo" as const,
    scopeType: "unit" as const,
    scopeId: null,
    bodyField: "photoDocumentId",
  },
});

/**
 * An API stub with the real idempotency rule (contract §3): the first body per key is stored and its answer
 * replayed for the same body; another body with that key is `422 idempotency.key_reused`. Each presign gets a new
 * file id, like the API.
 */
function idempotentApi(delayMs = 20) {
  const seen = new Map<string, string>();
  let files = 0;
  return api(async (call) => {
    if (call.url.endsWith("/presign")) {
      files += 1;
      return Response.json({ file: { id: `file-${files}` }, uploadUrl: "https://storage.test/put", headers: {} });
    }
    if (call.url === "https://storage.test/put") return new Response(null, { status: 200 });
    if (call.url.endsWith("/actions/complete")) return Response.json({});
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    const key = call.headers.get("idempotency-key")!;
    const body = JSON.stringify(call.body);
    const previous = seen.get(key);
    if (previous !== undefined && previous !== body) {
      return Response.json({ code: "idempotency.key_reused", detail: "" }, { status: 422 });
    }
    seen.set(key, body);
    return Response.json({ id: "r1", reviewState: "accepted" }, { status: 201 });
  });
}

describe("one replayer per device (review M3)", () => {
  it("two tabs replaying at once send the reading once and it ends sent, not conflict", async () => {
    const entry = await enqueue(photoEntry());
    // Two windows of the PWA: two instances of this module over the same IndexedDB.
    vi.resetModules();
    const tabB = await import("./queue");
    tabB.setQueueIdentity(ALICE);
    const { calls, fetchImpl } = idempotentApi();
    const [a, b] = await Promise.all([replayQueue(fetchImpl), tabB.replayQueue(fetchImpl)]);
    expect(a.sent + b.sent).toBe(1);
    expect(a.conflicts + b.conflicts).toBe(0);
    expect(calls.filter((call) => call.url.endsWith("/presign"))).toHaveLength(1);
    expect(calls.filter((call) => call.url === "/bff/v1/staff/meter-readings")).toHaveLength(1);
    expect(await getEntry(entry.id)).toMatchObject({ state: "sent" });
  });

  it("without the Web Locks API, an IndexedDB lease serialises the tabs", async () => {
    const locks = Object.getOwnPropertyDescriptor(globalThis.navigator, "locks");
    Object.defineProperty(globalThis.navigator, "locks", { value: undefined, configurable: true });
    try {
      const entry = await enqueue(photoEntry());
      vi.resetModules();
      const tabB = await import("./queue");
      tabB.setQueueIdentity(ALICE);
      const { calls, fetchImpl } = idempotentApi();
      const [a, b] = await Promise.all([replayQueue(fetchImpl), tabB.replayQueue(fetchImpl)]);
      expect(a.sent + b.sent).toBe(1);
      expect(calls.filter((call) => call.url === "/bff/v1/staff/meter-readings")).toHaveLength(1);
      expect(await getEntry(entry.id)).toMatchObject({ state: "sent" });
    } finally {
      if (locks) Object.defineProperty(globalThis.navigator, "locks", locks);
      else delete (globalThis.navigator as { locks?: unknown }).locks;
    }
  });

  it("never turns a sent entry back into a conflict from a stale copy", async () => {
    const entry = await enqueue(reading);
    vi.resetModules();
    const tabB = await import("./queue");
    tabB.setQueueIdentity(ALICE);
    await replayQueue(api(() => Response.json({ id: "r1" }, { status: 201 })).fetchImpl);
    // A late refusal in another tab (it read the entry before it was sent) changes nothing.
    await tabB.retry(entry.id);
    expect(await getEntry(entry.id)).toMatchObject({ state: "sent", result: { id: "r1" } });
  });
});

describe("entries belong to who queued them (review M3)", () => {
  it("cannot queue without a signed-in identity", async () => {
    setQueueIdentity(null);
    await expect(enqueue(reading)).rejects.toBeInstanceOf(NoQueueIdentityError);
  });

  it("holds another staff member's entries and sends them only when that person is back", async () => {
    const entry = await enqueue(reading);
    expect(entry.owner).toEqual(ALICE);
    setQueueIdentity({ userId: "u-bob", tenantId: "t-1" });
    const { calls, fetchImpl } = api(() => Response.json({}, { status: 201 }));
    expect(await replayQueue(fetchImpl)).toMatchObject({ sent: 0, held: 1 });
    expect(calls).toHaveLength(0);
    setQueueIdentity(ALICE);
    expect(await replayQueue(fetchImpl)).toMatchObject({ sent: 1, held: 0 });
  });

  it("holds the entries of another tenant of the same staff member until they switch back", async () => {
    await enqueue(reading);
    setQueueIdentity({ ...ALICE, tenantId: "t-2" });
    const { calls, fetchImpl } = api(() => Response.json({}, { status: 201 }));
    expect(await replayQueue(fetchImpl)).toMatchObject({ sent: 0, held: 1 });
    expect(calls).toHaveLength(0);
  });

  it("holds entries queued before entries had an owner", async () => {
    const entry = await enqueue(reading);
    const { openDB } = await import("idb");
    const database = await openDB("gp-staff-queue", 2);
    await database.put("entries", { ...(await database.get("entries", entry.id)), owner: undefined });
    database.close();
    expect(await replayQueue(api(() => Response.json({}, { status: 201 })).fetchImpl)).toMatchObject({ held: 1 });
  });

  it("sign-out clears the queue", async () => {
    await enqueue(reading);
    await enqueue(photoEntry());
    await clearQueue();
    expect(await listQueue()).toEqual([]);
  });
});
