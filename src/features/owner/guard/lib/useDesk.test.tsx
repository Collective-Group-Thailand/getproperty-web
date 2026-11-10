import "fake-indexeddb/auto";

import { act, renderHook } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GuardMe } from "./api";
import { listGateQueue, resetGateQueueDb } from "./queue";
import { useDesk } from "./useDesk";

// The stream is up the whole time: the reviewed bug was that nothing retried a queued visit while it was.
vi.mock("./stream", () => ({
  connectGateStream: (options: { onStatus?: (status: string) => void }) => {
    options.onStatus?.("open");
    return { stop: () => undefined };
  },
}));

const GATE = "a1b2c3d4-0000-4000-8000-000000000001";
const ME = { gateId: GATE, guardId: "g", guardName: "สมชาย", autoLockMinutes: 5 } as unknown as GuardMe;
const SNAPSHOT = { waiting: [], inside: [], hardware: [], detections: [], incidents: [] };

type Answer = { status: number; body?: unknown } | "offline";
let answers: Answer[] = [];
let posts: { path: string; key: string | null; body: unknown }[] = [];

function respond(answer: Answer): Response {
  if (answer === "offline") throw new TypeError("Failed to fetch");
  return new Response(answer.body === undefined ? null : JSON.stringify(answer.body), {
    status: answer.status,
    headers: { "content-type": "application/json" },
  });
}

const flush = async () => {
  for (let i = 0; i < 30; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
  globalThis.indexedDB = new IDBFactory();
  resetGateQueueDb();
  answers = [];
  posts = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if ((init?.method ?? "GET") === "GET") return respond({ status: 200, body: [] });
      const headers = new Headers(init?.headers);
      posts.push({
        path: url.replace("/bff/guard", ""),
        key: headers.get("idempotency-key"),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return respond(answers.shift() ?? { status: 500 });
    }),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const created = (state = "requested") => ({ status: 201, body: { id: "visit-1", state, replayed: false } });

async function mount() {
  const hook = renderHook(() => useDesk(ME, () => undefined, SNAPSHOT));
  await act(flush);
  return hook;
}

/** Review W2: a visit queued after a 5xx / 429 / 408 is sent again when its backoff ends, stream or no stream. */
describe("gate desk retries queued visits while the stream is open (review W2)", () => {
  it("re-sends after the backoff with the same Idempotency-Key and clientRef", async () => {
    const { result } = await mount();
    expect(result.current.state.stream).toBe("open");
    answers = [{ status: 503 }, created()];
    let outcome: Awaited<ReturnType<typeof result.current.actions.record>> | undefined;
    await act(async () => {
      const pending = result.current.actions.record({ kind: "guest", unitNo: "99/12" }, false);
      await flush();
      outcome = await pending;
    });
    expect(outcome).toEqual({ kind: "queued" });
    expect(posts).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
      await flush();
    });
    expect(posts).toHaveLength(2);
    expect(posts[1]!.key).toBe(posts[0]!.key);
    expect((posts[1]!.body as { clientRef: string }).clientRef).toBe(
      (posts[0]!.body as { clientRef: string }).clientRef,
    );
    const [entry] = await listGateQueue(GATE);
    expect(entry!.state).toBe("sent");
  });

  it("honours Retry-After of a 429 the same way", async () => {
    const { result } = await mount();
    answers = [{ status: 429 }, created()];
    await act(async () => {
      const pending = result.current.actions.record({ kind: "guest" }, false);
      await flush();
      await pending;
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
      await flush();
    });
    expect(posts).toHaveLength(2);
  });

  it("holds the queue while the desk is locked and sends once it is unlocked (review W1)", async () => {
    let locked = false;
    const { result, rerender } = renderHook(() => useDesk(ME, () => undefined, SNAPSHOT, { paused: locked }));
    await act(flush);
    answers = [{ status: 503 }, created()];
    await act(async () => {
      const pending = result.current.actions.record({ kind: "guest" }, false);
      await flush();
      await pending;
    });
    locked = true;
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      await flush();
    });
    expect(posts).toHaveLength(1);
    locked = false;
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
      await flush();
    });
    expect(posts).toHaveLength(2);
  });
});

/** Review W3: "saved, will send" is said only when the visit is really kept or sent. */
describe("gate desk says when a visit was not saved (review W3)", () => {
  beforeEach(() => {
    // Private mode / storage blocked: no IndexedDB at all.
    vi.stubGlobal("indexedDB", undefined);
    resetGateQueueDb();
  });

  it("offline without storage: not saved (never 'queued')", async () => {
    const { result } = await mount();
    answers = ["offline"];
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.record({ kind: "guest" }, true);
    });
    expect(outcome).toEqual({ kind: "unsaved" });
  });

  it("a refusal without storage is shown as the API's refusal", async () => {
    const { result } = await mount();
    answers = [{ status: 422, body: { code: "visit.unit_unknown", detail: "ไม่พบบ้านเลขที่นี้" } }];
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.record({ kind: "guest" }, false);
    });
    expect(outcome).toMatchObject({ kind: "refused", problem: { code: "visit.unit_unknown" } });
  });

  it("a scan offline without storage is not saved either", async () => {
    const { result } = await mount();
    answers = ["offline"];
    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.actions.scan("gpv1.token");
    });
    expect(outcome).toEqual({ unsaved: true });
  });
});
