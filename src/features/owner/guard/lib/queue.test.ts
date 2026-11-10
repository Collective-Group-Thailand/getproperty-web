// @vitest-environment node
import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GuardResult } from "./api";
import {
  enqueueGate,
  forgetGateTablet,
  GATE_QUEUE_DB,
  OFFLINE_KEEP_MS,
  listGateQueue,
  pendingCount,
  replayGateQueue,
  resetGateQueueDb,
  retryGateEntry,
  SENT_TTL_MS,
  type GateSend,
} from "./queue";

const GATE = "a1b2c3d4-0000-4000-8000-000000000001";

function visit(id: string, extra: Record<string, unknown> = {}) {
  return enqueueGate({
    id,
    gateId: GATE,
    kind: "visit",
    idempotencyKey: `key-${id}`,
    body: { clientRef: id, kind: "guest" },
    label: { plate: "1กข 4521", unitNo: "99/11", kind: "guest" },
    ...extra,
  });
}

const ok = (id: string): GuardResult<unknown> => ({
  ok: true,
  status: 201,
  data: { id: `visit-${id}`, state: "requested", replayed: false },
});

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetGateQueueDb();
});

describe("gate offline queue", () => {
  it("sends in order with the fixed Idempotency-Key and clientRef", async () => {
    await visit("v1", { createdAt: 1 });
    await visit("v2", { createdAt: 2 });
    const calls: { path: string; key?: string; body: unknown }[] = [];
    const send = vi.fn(async (path: string, init: { body: unknown; idempotencyKey?: string }) => {
      calls.push({ path, key: init.idempotencyKey, body: init.body });
      return ok((init.body as { clientRef: string }).clientRef);
    }) as unknown as GateSend;
    expect(await replayGateQueue(GATE, send, () => 10)).toBe("done");
    expect(calls.map((c) => [c.path, c.key])).toEqual([
      ["/v1/guard/visits", "key-v1"],
      ["/v1/guard/visits", "key-v2"],
    ]);
    const entries = await listGateQueue(GATE);
    expect(entries.map((e) => e.state)).toEqual(["sent", "sent"]);
    expect(entries[0]!.result).toEqual({
      id: "visit-v1",
      state: "requested",
      replayed: false,
      entryBasis: null,
      decisionReason: null,
    });
    expect(pendingCount(entries)).toBe(0);
  });

  it("keeps an entry pending with backoff while offline, and the same key on the retry", async () => {
    await visit("v1");
    let now = 1_000;
    const keys: (string | undefined)[] = [];
    let online = false;
    const send = (async (_path: string, init: { idempotencyKey?: string; body: unknown }) => {
      keys.push(init.idempotencyKey);
      return online ? ok("v1") : { ok: false, status: 0, problem: null, offline: true };
    }) as GateSend;
    expect(await replayGateQueue(GATE, send, () => now)).toBe("offline");
    let [entry] = await listGateQueue(GATE);
    expect(entry).toMatchObject({ state: "pending", attempts: 1, nextAttemptAt: 3_000 });
    // Not due yet: nothing is sent.
    expect(await replayGateQueue(GATE, send, () => now)).toBe("done");
    expect(keys).toHaveLength(1);
    now = 3_000;
    online = true;
    expect(await replayGateQueue(GATE, send, () => now)).toBe("done");
    [entry] = await listGateQueue(GATE);
    expect(entry!.state).toBe("sent");
    expect(keys).toEqual(["key-v1", "key-v1"]);
  });

  it("sends at once when the network comes back, without waiting out the offline backoff", async () => {
    await visit("v1");
    const now = 1_000;
    let online = false;
    const send = (async () =>
      online ? ok("v1") : { ok: false, status: 0, problem: null, offline: true }) as unknown as GateSend;
    expect(await replayGateQueue(GATE, send, () => now)).toBe("offline");
    online = true;
    // The browser's `online` event: the backoff was only a guess at when the network returns.
    expect(await replayGateQueue(GATE, send, () => now, { ignoreBackoff: true })).toBe("done");
    const [entry] = await listGateQueue(GATE);
    expect(entry!.state).toBe("sent");
  });

  it("marks a refusal as a conflict with the API's problem and goes on with the next", async () => {
    await visit("v1", { createdAt: 1 });
    await visit("v2", { createdAt: 2 });
    const send = (async (_path: string, init: { body: unknown }) =>
      (init.body as { clientRef: string }).clientRef === "v1"
        ? { ok: false, status: 409, problem: { code: "visit.offline_too_old" }, offline: false }
        : ok("v2")) as GateSend;
    expect(await replayGateQueue(GATE, send, () => 10)).toBe("done");
    const [first, second] = await listGateQueue(GATE);
    expect(first).toMatchObject({ state: "conflict", problem: { code: "visit.offline_too_old" } });
    expect(second!.state).toBe("sent");
    await retryGateEntry("v1");
    expect((await listGateQueue(GATE))[0]!.state).toBe("pending");
  });

  it("keeps an entry pending when the desk was locked under it (423 gate.locked, review W1)", async () => {
    await visit("v1");
    const send = (async () => ({
      ok: false,
      status: 423,
      problem: { code: "gate.locked" },
      offline: false,
    })) as unknown as GateSend;
    await replayGateQueue(GATE, send, () => 10);
    expect((await listGateQueue(GATE))[0]).toMatchObject({ state: "pending", attempts: 1 });
  });

  it("stops at a 401 and leaves the entry for the next guard", async () => {
    await visit("v1");
    const send = (async () => ({ ok: false, status: 401, problem: null, offline: false })) as GateSend;
    expect(await replayGateQueue(GATE, send)).toBe("unauthorised");
    expect((await listGateQueue(GATE))[0]).toMatchObject({ state: "pending", attempts: 0 });
  });

  it("sends the photo after the visit, once, and the visit is not created twice on a photo retry", async () => {
    await visit("v1", { photo: { contentBase64: "AAAA", mimeType: "image/jpeg" } });
    const paths: string[] = [];
    let photoFails = true;
    const send = (async (path: string) => {
      paths.push(path);
      if (path.endsWith("/photo")) {
        return photoFails
          ? { ok: false, status: 503, problem: null, offline: true }
          : { ok: true, status: 200, data: {} };
      }
      return ok("v1");
    }) as GateSend;
    let now = 0;
    expect(await replayGateQueue(GATE, send, () => now)).toBe("offline");
    photoFails = false;
    now = 10_000;
    expect(await replayGateQueue(GATE, send, () => now)).toBe("done");
    expect(paths).toEqual(["/v1/guard/visits", "/v1/guard/visits/visit-v1/photo", "/v1/guard/visits/visit-v1/photo"]);
    const [entry] = await listGateQueue(GATE);
    expect(entry).toMatchObject({ state: "sent", photoSent: true });
    expect(entry!.photo).toBeUndefined();
  });

  it("never sends another gate's entries and prunes old sent ones", async () => {
    await enqueueGate({
      id: "other",
      gateId: "b0000000-0000-4000-8000-000000000002",
      kind: "visit",
      idempotencyKey: "k",
      body: { clientRef: "other", kind: "guest" },
      label: { plate: null, unitNo: null, kind: "guest" },
    });
    await visit("v1", { createdAt: 0 });
    const send = vi.fn(async () => ok("v1")) as unknown as GateSend;
    await replayGateQueue(GATE, send, () => 0);
    expect(send).toHaveBeenCalledTimes(1);
    await replayGateQueue(GATE, send, () => SENT_TTL_MS + 1);
    expect(await listGateQueue(GATE)).toHaveLength(0);
    // Review W4: another gate's entries can never be sent from here — they are not kept either.
    expect(await listGateQueue()).toHaveLength(0);
  });
});

/** Review W4 (PDPA): plates, names and ID digits do not stay on the tablet longer than they can still be used. */
describe("gate offline queue retention (review W4)", () => {
  it("drops pending and conflict entries older than gate.offline_max_hours (24 h) without sending them", async () => {
    await visit("old-pending", { createdAt: 0 });
    await visit("old-conflict", { createdAt: 1 });
    await visit("fresh", { createdAt: OFFLINE_KEEP_MS });
    const refuse = (async () => ({
      ok: false,
      status: 422,
      problem: { code: "visit.invalid" },
      offline: false,
    })) as unknown as GateSend;
    // old-conflict becomes a conflict; the others too (all refused) — then a day passes.
    await replayGateQueue(GATE, refuse, () => 2);
    await retryGateEntry("old-pending");
    const send = vi.fn(async () => ok("fresh")) as unknown as GateSend;
    await replayGateQueue(GATE, send, () => OFFLINE_KEEP_MS + 2);
    expect((await listGateQueue()).map((entry) => entry.id)).toEqual(["fresh"]);
    expect(send).not.toHaveBeenCalledWith(
      "/v1/guard/visits",
      expect.objectContaining({ idempotencyKey: "key-old-pending" }),
    );
  });

  it("forgetting the tablet deletes the queue database and the cached houses", async () => {
    await visit("v1");
    const store = new Map<string, string>([
      ["gp.gate.units", "{}"],
      ["gp.gate.provinces", "[]"],
    ]);
    const storage = { removeItem: (k: string) => void store.delete(k) };
    await forgetGateTablet(storage);
    const names = (await indexedDB.databases()).map((database) => database.name);
    expect(names).not.toContain(GATE_QUEUE_DB);
    expect(store.has("gp.gate.units")).toBe(false);
    expect(await listGateQueue()).toEqual([]);
  });
});
