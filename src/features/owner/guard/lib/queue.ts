import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Schemas } from "@/lib/api/types";

import type { GuardProblem, GuardResult, VisitCreate, VisitCreated } from "./api";
import { UNITS_CACHE_KEY } from "./units";

/**
 * The gate tablet's offline queue (JW4, D-327 "offline replay"). The guard never waits for the network: every visit
 * the tablet records — and every invite it scans — is written here **first**, with its `clientRef` (uuid, the API's
 * replay key per gate) and its `Idempotency-Key` fixed at that moment, then sent in order:
 *
 * - 2xx → **sent** (the API answers `replayed: true` for a `clientRef` it already holds, never a duplicate); a photo
 *   waiting for the visit goes next (`POST /v1/guard/visits/{id}/photo`), once;
 * - a refusal (4xx other than 401 / 408 / 429) → **conflict**, kept with the API's problem for the guard to see;
 *   never retried blindly;
 * - offline, 408, 429, 5xx, 423 `gate.locked` → retried with backoff (2 s → 60 s);
 * - 401 → replay stops until a guard signs in again (nothing is dropped).
 *
 * Entries belong to the gate that recorded them (`gateId`): a tablet re-enrolled at another gate never sends them
 * there — and another gate's entries are deleted. Sent entries are kept `SENT_TTL_MS` so the lists can show what became
 * of them, then pruned; pending and conflict entries are deleted after `OFFLINE_KEEP_MS` (PDPA, review W4): the API
 * refuses an offline record older than `gate.offline_max_hours` (default 24), so the plate, name and ID digits would
 * only sit on the tablet. Forgetting the tablet (or the API revoking it) deletes the whole database
 * (`forgetGateTablet`).
 */

export type GateQueueState = "pending" | "sent" | "conflict";

export interface GateQueueLabel {
  plate: string | null;
  unitNo: string | null;
  kind: Schemas["VisitKind"] | "invite";
}

export interface GateQueueEntry {
  /** = the request's `clientRef`. */
  id: string;
  gateId: string;
  kind: "visit" | "scan";
  createdAt: number;
  idempotencyKey: string;
  body: VisitCreate | Schemas["InviteScanDto"];
  photo?: { contentBase64: string; mimeType: Schemas["ResidentUploadContentType"] };
  label: GateQueueLabel;
  state: GateQueueState;
  attempts: number;
  nextAttemptAt: number;
  visitId?: string;
  photoSent?: boolean;
  problem?: GuardProblem | null;
  /** The answer the API gave once sent (state, entry basis), for the row. */
  result?: Pick<VisitCreated, "id" | "state" | "replayed" | "entryBasis" | "decisionReason"> | null;
}

interface GateQueueDb extends DBSchema {
  entries: { key: string; value: GateQueueEntry; indexes: { createdAt: number } };
}

export const GATE_QUEUE_DB = "gp-gate-queue";
export const SENT_TTL_MS = 10 * 60_000;
/**
 * `gate.offline_max_hours` default (24, D-327). The guard surface does not return the setting (contract request
 * CR-W4): a tenant may lower it, and the API then refuses older entries as conflicts, which are pruned here at 24 h.
 */
export const OFFLINE_KEEP_MS = 24 * 3600_000;
export const BACKOFF_MS = [2_000, 5_000, 15_000, 30_000, 60_000];

let dbPromise: Promise<IDBPDatabase<GateQueueDb>> | null = null;

function db(): Promise<IDBPDatabase<GateQueueDb>> {
  dbPromise ??= openDB<GateQueueDb>(GATE_QUEUE_DB, 1, {
    upgrade(database) {
      const store = database.createObjectStore("entries", { keyPath: "id" });
      store.createIndex("createdAt", "createdAt");
    },
  });
  return dbPromise;
}

/** Tests: forget the open connection (a fresh fake IndexedDB per test). */
export function resetGateQueueDb(): void {
  dbPromise = null;
}

/**
 * Deletes what is past keeping (review W4): another gate's entries, sent ones after `SENT_TTL_MS`, pending and
 * conflicts after `OFFLINE_KEEP_MS`.
 */
export async function pruneGateQueue(gateId: string, now: number = Date.now()): Promise<void> {
  const database = await db();
  const tx = database.transaction("entries", "readwrite");
  for (const entry of await tx.store.getAll()) {
    const age = now - entry.createdAt;
    if (entry.gateId !== gateId || age > (entry.state === "sent" ? SENT_TTL_MS : OFFLINE_KEEP_MS)) {
      await tx.store.delete(entry.id);
    }
  }
  await tx.done;
}

/**
 * The tablet is forgotten or revoked (review W4): the queue database and the cached houses go with it — nothing of
 * the gate's visitors stays in this browser.
 */
export async function forgetGateTablet(
  storage: Pick<Storage, "removeItem"> | undefined = globalThis.localStorage,
): Promise<void> {
  try {
    storage?.removeItem(UNITS_CACHE_KEY);
  } catch {
    // storage blocked: nothing was cached either
  }
  const open = dbPromise;
  dbPromise = null;
  await open?.then((database) => database.close()).catch(() => undefined);
  await deleteDB(GATE_QUEUE_DB).catch(() => undefined);
}

export async function enqueueGate(
  entry: Omit<GateQueueEntry, "state" | "attempts" | "nextAttemptAt" | "createdAt"> & { createdAt?: number },
): Promise<GateQueueEntry> {
  const full: GateQueueEntry = {
    ...entry,
    createdAt: entry.createdAt ?? Date.now(),
    state: "pending",
    attempts: 0,
    nextAttemptAt: 0,
  };
  await (await db()).put("entries", full);
  return full;
}

export async function listGateQueue(gateId?: string): Promise<GateQueueEntry[]> {
  const all = await (await db()).getAllFromIndex("entries", "createdAt");
  return gateId ? all.filter((entry) => entry.gateId === gateId) : all;
}

export async function discardGateEntry(id: string): Promise<void> {
  await (await db()).delete("entries", id);
}

/** Waiting to be sent (pending), for the header's "ออฟไลน์ · จะส่งเมื่อกลับมาออนไลน์ (n)". */
export function pendingCount(entries: readonly GateQueueEntry[]): number {
  return entries.filter((entry) => entry.state === "pending").length;
}

async function update(id: string, patch: (entry: GateQueueEntry) => GateQueueEntry | null): Promise<void> {
  const database = await db();
  const tx = database.transaction("entries", "readwrite");
  const current = await tx.store.get(id);
  if (current) {
    const next = patch(current);
    if (next) await tx.store.put(next);
  }
  await tx.done;
}

export type GateSend = <T>(
  path: string,
  init: { method: "POST"; body: unknown; idempotencyKey?: string },
) => Promise<GuardResult<T>>;

export type ReplayOutcome = "done" | "offline" | "unauthorised" | "busy";

let replaying = false;

function retriable(result: Extract<GuardResult<unknown>, { ok: false }>): boolean {
  return (
    result.offline ||
    result.status === 0 ||
    result.status === 408 ||
    result.status === 429 ||
    result.status >= 500 ||
    // The desk was locked between the record and its send (review W1): it goes once the PIN is in.
    (result.status === 423 && result.problem?.code === "gate.locked")
  );
}

/**
 * Sends what is due, oldest first. Stops at the first network failure (everything after it would fail too) and at a
 * 401; a conflict does not stop the others. One replay at a time per page. `ignoreBackoff` (the browser said the
 * network is back) sends every pending entry now: the backoff only guessed when the network would return.
 */
export async function replayGateQueue(
  gateId: string,
  send: GateSend,
  now: () => number = Date.now,
  { ignoreBackoff = false }: { ignoreBackoff?: boolean } = {},
): Promise<ReplayOutcome> {
  if (replaying) return "busy";
  replaying = true;
  try {
    await pruneGateQueue(gateId, now());
    const entries = await listGateQueue(gateId);
    for (const entry of entries) {
      if (entry.state !== "pending" || (!ignoreBackoff && entry.nextAttemptAt > now())) continue;
      const outcome = await sendOne(entry, send, now);
      if (outcome !== "done") return outcome;
    }
    return "done";
  } finally {
    replaying = false;
  }
}

async function sendOne(entry: GateQueueEntry, send: GateSend, now: () => number): Promise<ReplayOutcome> {
  let visitId = entry.visitId;
  if (!visitId) {
    const path = entry.kind === "visit" ? "/v1/guard/visits" : "/v1/guard/invites/actions/scan";
    const result = await send<VisitCreated>(path, {
      method: "POST",
      body: entry.body,
      idempotencyKey: entry.idempotencyKey,
    });
    if (!result.ok) return failed(entry, result, now);
    visitId = result.data.id;
    const answer = {
      id: result.data.id,
      state: result.data.state,
      replayed: result.data.replayed,
      entryBasis: result.data.entryBasis ?? null,
      decisionReason: result.data.decisionReason ?? null,
    };
    await update(entry.id, (current) => ({
      ...current,
      visitId,
      result: answer,
      problem: null,
      state: current.photo && !current.photoSent ? "pending" : "sent",
    }));
  }
  if (entry.photo && !entry.photoSent) {
    const result = await send<unknown>(`/v1/guard/visits/${visitId}/photo`, { method: "POST", body: entry.photo });
    if (!result.ok) return failed({ ...entry, visitId }, result, now);
    await update(entry.id, (current) => ({ ...current, photoSent: true, photo: undefined, state: "sent" }));
  }
  return "done";
}

async function failed(
  entry: GateQueueEntry,
  result: Extract<GuardResult<unknown>, { ok: false }>,
  now: () => number,
): Promise<ReplayOutcome> {
  if (result.status === 401) return "unauthorised";
  if (retriable(result)) {
    const attempts = entry.attempts + 1;
    const delay = result.retryAfterS
      ? result.retryAfterS * 1000
      : BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]!;
    await update(entry.id, (current) => ({ ...current, attempts, nextAttemptAt: now() + delay }));
    return "offline";
  }
  // A photo the API refused does not undo the visit: the visit is sent, the photo is dropped with its problem.
  await update(entry.id, (current) =>
    current.visitId
      ? { ...current, photo: undefined, photoSent: false, state: "sent", problem: result.problem }
      : { ...current, state: "conflict", problem: result.problem, attempts: current.attempts + 1 },
  );
  return "done";
}

/** A conflict the guard chose to try again (after fixing nothing: e.g. the house was unknown for a moment). */
export async function retryGateEntry(id: string): Promise<void> {
  await update(id, (current) =>
    current.state === "conflict" ? { ...current, state: "pending", nextAttemptAt: 0, problem: null } : current,
  );
}
