import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { CSRF_HEADER, IDEMPOTENCY_HEADER } from "@/lib/api/headers";
import type { Schemas } from "@/lib/api/types";

/**
 * The staff PWA's offline queue (ADR-0007, F1 1.3 §5). A submission that must not be lost — a meter
 * reading with its photo — is written to IndexedDB *first*, with its `Idempotency-Key` fixed at that
 * moment, and then replayed until the API answers:
 *
 * - 2xx → kept as **sent** with the API's answer for a day, so the screen that queued it (the reading
 *   round) can show what became of it — a replay of an accepted request returns the original response
 *   (contract §3); sent entries are pruned after `SENT_TTL_MS` and never replayed again;
 * - a refusal (409, 412, 422 and other 4xx) → kept as a **conflict** with the API's problem, shown to the
 *   staff member, never retried blindly;
 * - 401 → replay stops until the staff member signs in again (nothing is dropped);
 * - offline, 408, 429, 5xx, and "not yet" refusals (`document.scan_pending`, `idempotency.in_progress`)
 *   → retried with backoff.
 *
 * The photo goes to object storage by presign (never through the BFF body): presign → PUT → complete,
 * once; the resulting `fileId` is stored on the entry so a retry does not upload twice.
 *
 * One replayer per device (review M3): every window of the PWA shares this IndexedDB, and the service worker asks
 * all of them to replay, so a replay runs under the cross-tab lock `gp-offline-queue` (Web Locks API; an IndexedDB
 * lease where it is missing). Each entry is re-read before it is sent and every write re-reads it inside its
 * transaction, so a `sent` entry is never sent again or overwritten by a stale copy.
 *
 * Every entry belongs to the staff member and tenant that queued it (`owner`): it is replayed only while that same
 * identity is signed in (`setQueueIdentity`, set by the staff shell), and held — never sent as somebody else, never
 * into another tenant — otherwise. Sign-out clears the queue (`clearQueue`, ADR-0007).
 */

export type QueueState = "pending" | "conflict" | "sent";

/** What a queued submission is about, so screens can find their own entries (round items, …). */
export type QueueMeta = {
  kind: "meter-reading";
  assetItemId: string;
  buildingId: string;
  /** Billing period of the round (`RoundBuildingDto.periodKey`). */
  periodKey: string;
  unitNo: string | null;
  code: string;
  utility: Schemas["Utility"];
  /** The value typed on the keypad, or null when OCR reads the photo. */
  typedValue: string | null;
};

export interface QueuedPhoto {
  /** The compressed photo; dropped once uploaded and sent. */
  blob?: Blob;
  fileName: string;
  kind: Schemas["UploadKind"];
  scopeType: Schemas["DocumentScope"];
  scopeId: string | null;
  /** The body field that receives the uploaded `fileId`. */
  bodyField: string;
  /** Set once uploaded and completed. */
  fileId?: string;
}

/** Who queued an entry: replayed only while the same staff member is signed in to the same tenant. */
export interface QueueOwner {
  userId: string;
  tenantId: string;
}

export interface QueueEntry {
  id: string;
  /** Absent only on entries queued before review M3 — those are held like another person's. */
  owner?: QueueOwner;
  /** Fixed at enqueue time and sent on every replay (contract §3 idempotency). */
  idempotencyKey: string;
  method: "POST" | "PUT" | "PATCH";
  /** Upstream path, e.g. `/v1/staff/readings` — sent through this host's BFF. */
  path: string;
  body: Record<string, unknown>;
  photo?: QueuedPhoto;
  /** What the staff member sees in the sync sheet (unit code, meter). */
  label: string;
  meta?: QueueMeta;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  state: QueueState;
  problem?: { status: number; code: string; detail: string; requestId?: string };
  /** The API's answer (JSON) once sent. */
  result?: unknown;
  sentAt?: number;
}

interface QueueLease {
  name: string;
  holder: string;
  expiresAt: number;
}

interface QueueDb extends DBSchema {
  entries: { key: string; value: QueueEntry; indexes: { byCreated: number } };
  /** The cross-tab replay lease where the Web Locks API is missing. */
  leases: { key: string; value: QueueLease };
}

const DB_NAME = "gp-staff-queue";
const BACKOFF_MS = [5_000, 15_000, 60_000, 5 * 60_000, 15 * 60_000];
/** How long a sent entry (and its answer) stays visible. */
export const SENT_TTL_MS = 24 * 3600_000;
export const QUEUE_EVENT = "gp:offline-queue";

export const QUEUE_LOCK = "gp-offline-queue";
/** How long a fallback lease lives without renewal (a tab that died while replaying frees it after this). */
const LEASE_MS = 60_000;

let dbPromise: Promise<IDBPDatabase<QueueDb>> | undefined;

function db(): Promise<IDBPDatabase<QueueDb>> {
  dbPromise ??= openDB<QueueDb>(DB_NAME, 2, {
    upgrade(database, oldVersion) {
      if (oldVersion < 1) {
        const store = database.createObjectStore("entries", { keyPath: "id" });
        store.createIndex("byCreated", "createdAt");
      }
      if (oldVersion < 2) database.createObjectStore("leases", { keyPath: "name" });
    },
    blocking() {
      // A newer version (another tab after an update) wants the database: let it.
      void dbPromise?.then((open) => open.close());
      dbPromise = undefined;
    },
  });
  return dbPromise;
}

/** Test hook: forget the open connection (fake-indexeddb is reset between tests). */
export function resetQueueDb(): void {
  dbPromise = undefined;
  identity = null;
}

let identity: QueueOwner | null = null;

/**
 * The signed-in staff member and tenant (the staff shell sets it on every render; `null` when signed out). Entries
 * of anybody else are held, and a change of identity asks the queue to replay what is now this person's.
 */
export function setQueueIdentity(owner: QueueOwner | null): void {
  const changed = identity?.userId !== owner?.userId || identity?.tenantId !== owner?.tenantId;
  identity = owner ? { userId: owner.userId, tenantId: owner.tenantId } : null;
  if (changed) notify();
}

export function queueIdentity(): QueueOwner | null {
  return identity;
}

/** Whose an entry is, from the signed-in identity's point of view. */
export function ownership(entry: Pick<QueueEntry, "owner">, current: QueueOwner | null = identity) {
  if (!current || !entry.owner || entry.owner.userId !== current.userId) return "someone-else" as const;
  return entry.owner.tenantId === current.tenantId ? ("mine" as const) : ("other-tenant" as const);
}

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
}

/** Queuing needs a signed-in identity: an entry nobody owns could be replayed as anybody (review M3). */
export class NoQueueIdentityError extends Error {
  constructor() {
    super("no signed-in staff identity for the offline queue");
    this.name = "NoQueueIdentityError";
  }
}

export async function enqueue(
  entry: Pick<QueueEntry, "method" | "path" | "body" | "label" | "photo" | "meta"> & { idempotencyKey?: string },
): Promise<QueueEntry> {
  if (!identity) throw new NoQueueIdentityError();
  const now = Date.now();
  const stored: QueueEntry = {
    id: crypto.randomUUID(),
    owner: { ...identity },
    idempotencyKey: entry.idempotencyKey ?? crypto.randomUUID(),
    method: entry.method,
    path: entry.path,
    body: entry.body,
    photo: entry.photo,
    label: entry.label,
    meta: entry.meta,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
    state: "pending",
  };
  await (await db()).put("entries", stored);
  notify();
  return stored;
}

/** Every entry, oldest first; sent entries older than `SENT_TTL_MS` are pruned on the way. */
export async function listQueue(now = Date.now()): Promise<QueueEntry[]> {
  const database = await db();
  const all = await database.getAllFromIndex("entries", "byCreated");
  const expired = all.filter((entry) => entry.state === "sent" && (entry.sentAt ?? 0) < now - SENT_TTL_MS);
  for (const entry of expired) await database.delete("entries", entry.id);
  return all.filter((entry) => !expired.includes(entry));
}

export async function getEntry(id: string): Promise<QueueEntry | undefined> {
  return (await db()).get("entries", id);
}

export async function discard(id: string): Promise<void> {
  await (await db()).delete("entries", id);
  notify();
}

/** Puts a conflict back in line (after the staff member fixed what the API refused, e.g. re-signed in). */
export async function retry(id: string): Promise<void> {
  await updateEntry(id, (entry) =>
    entry.state === "conflict" ? { ...entry, state: "pending", problem: undefined, nextAttemptAt: Date.now() } : null,
  );
  notify();
}

/**
 * Deletes every entry and lease (sign-out, the device lock's forced sign-out — ADR-0007, review H2): what was not
 * sent is gone with the session that queued it.
 */
export async function clearQueue(): Promise<void> {
  const database = await db();
  const tx = database.transaction(["entries", "leases"], "readwrite");
  await Promise.all([tx.objectStore("entries").clear(), tx.objectStore("leases").clear(), tx.done]);
  notify();
}

/**
 * Read-modify-write of one entry inside a single transaction (review M3): the change is computed from the entry as
 * it is *now*, never from a stale copy; a `sent` entry is final and never overwritten; `null` writes nothing.
 */
async function updateEntry(
  id: string,
  change: (entry: QueueEntry) => QueueEntry | null,
): Promise<QueueEntry | undefined> {
  const database = await db();
  const tx = database.transaction("entries", "readwrite");
  const current = await tx.store.get(id);
  if (!current || current.state === "sent") {
    await tx.done;
    return current;
  }
  const next = change(current);
  if (next) await tx.store.put(next);
  await tx.done;
  return next ?? current;
}

async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

class ReplayStop extends Error {}
class Refused extends Error {
  constructor(readonly problem: NonNullable<QueueEntry["problem"]>) {
    super(problem.code);
  }
}
class Transient extends Error {}

const jsonHeaders = { "content-type": "application/json", accept: "application/json", [CSRF_HEADER]: "1" };

/**
 * Refusals that only mean "not yet": the photo is still being virus-scanned (D-025 — the API reads it
 * for OCR only once clean), or the first attempt with this key is still running. Retried with backoff
 * like a 503, never shown as a conflict.
 */
const NOT_YET = new Set(["document.scan_pending", "idempotency.in_progress"]);

async function classify(response: Response): Promise<never> {
  if (response.status === 401) throw new ReplayStop("signed out");
  if (response.status === 408 || response.status === 429 || response.status >= 500)
    throw new Transient(String(response.status));
  const problem = (await response.json().catch(() => ({}))) as { code?: string; detail?: string; requestId?: string };
  if (problem.code && NOT_YET.has(problem.code)) throw new Transient(problem.code);
  throw new Refused({
    status: response.status,
    code: problem.code ?? `http.${response.status}`,
    detail: problem.detail ?? "",
    requestId: problem.requestId ?? response.headers.get("x-request-id") ?? undefined,
  });
}

async function upload(photo: QueuedPhoto, fetchImpl: typeof fetch): Promise<string> {
  if (!photo.blob) throw new Refused({ status: 422, code: "document.not_uploaded", detail: "" });
  const blob = photo.blob;
  const presign = await fetchImpl("/bff/v1/staff/files/presign", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      kind: photo.kind,
      scopeType: photo.scopeType,
      scopeId: photo.scopeId,
      fileName: photo.fileName,
      mimeType: blob.type || "image/jpeg",
      sizeBytes: blob.size,
      sha256: await sha256Hex(blob),
    }),
  });
  if (!presign.ok) await classify(presign);
  const signed = (await presign.json()) as Schemas["FilePresignedDto"];
  if (!signed.uploadUrl) throw new Refused({ status: 422, code: "document.multipart_unsupported", detail: "" });
  const put = await fetchImpl(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: blob });
  if (!put.ok) throw new Transient(`upload ${put.status}`);
  const complete = await fetchImpl(`/bff/v1/staff/files/${encodeURIComponent(signed.file.id)}/actions/complete`, {
    method: "POST",
    headers: jsonHeaders,
    body: "{}",
  });
  if (!complete.ok) await classify(complete);
  return signed.file.id;
}

/** A photo upload that did not complete: the API's problem, or `network` when there was no answer. */
export class UploadError extends Error {
  constructor(readonly problem: NonNullable<QueueEntry["problem"]>) {
    super(problem.code);
    this.name = "UploadError";
  }
}

/**
 * Presign → PUT → complete for screens that upload directly (inspection photos, install photos) rather
 * than through a queued submission; returns the document id. Errors are `UploadError`s.
 */
export async function uploadFile(photo: QueuedPhoto, fetchImpl: typeof fetch = fetch): Promise<string> {
  try {
    return await upload(photo, fetchImpl);
  } catch (error) {
    if (error instanceof Refused) throw new UploadError(error.problem);
    if (error instanceof ReplayStop) throw new UploadError({ status: 401, code: "auth.unauthenticated", detail: "" });
    throw new UploadError({ status: 0, code: "network", detail: "" });
  }
}

export interface ReplayResult {
  sent: number;
  conflicts: number;
  remaining: number;
  /** Entries of another staff member or tenant, kept but not sent (review M3). */
  held: number;
  stopped: "signed-out" | null;
}

let replaying: Promise<ReplayResult> | undefined;

/**
 * Sends what is due, oldest first (sent entries are skipped): one replay at a time per tab, and one per device
 * under the cross-tab lock — a second tab waits for the first and then finds its entries already sent.
 */
export function replayQueue(fetchImpl: typeof fetch = fetch, now = Date.now): Promise<ReplayResult> {
  replaying ??= withQueueLock(() => run(fetchImpl, now)).finally(() => {
    replaying = undefined;
  });
  return replaying;
}

type LockManagerLike = {
  request<T>(name: string, options: { mode: "exclusive" }, callback: () => Promise<T>): Promise<T>;
};

/** Runs `task` while holding the device-wide replay lock (Web Locks API, else an IndexedDB lease). */
export async function withQueueLock<T>(task: () => Promise<T>): Promise<T> {
  const locks = (globalThis.navigator as (Navigator & { locks?: LockManagerLike }) | undefined)?.locks;
  if (locks?.request) return locks.request(QUEUE_LOCK, { mode: "exclusive" }, task);
  return withLease(task);
}

/**
 * The fallback lock: a lease record taken in a read-write transaction (IndexedDB serialises overlapping read-write
 * transactions across tabs, so check-and-take is atomic), renewed while the task runs and released after it. A
 * lease left by a tab that died expires after `LEASE_MS`.
 */
async function withLease<T>(task: () => Promise<T>): Promise<T> {
  const holder = crypto.randomUUID();
  const take = async (): Promise<boolean> => {
    const database = await db();
    const tx = database.transaction("leases", "readwrite");
    const lease = await tx.store.get(QUEUE_LOCK);
    const free = !lease || lease.holder === holder || lease.expiresAt <= Date.now();
    if (free) await tx.store.put({ name: QUEUE_LOCK, holder, expiresAt: Date.now() + LEASE_MS });
    await tx.done;
    return free;
  };
  for (let wait = 50; !(await take()); wait = Math.min(wait * 2, 1_000)) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  const renew = setInterval(() => void take(), LEASE_MS / 3);
  try {
    return await task();
  } finally {
    clearInterval(renew);
    const database = await db();
    const tx = database.transaction("leases", "readwrite");
    const lease = await tx.store.get(QUEUE_LOCK);
    if (lease?.holder === holder) await tx.store.delete(QUEUE_LOCK);
    await tx.done;
  }
}

async function run(fetchImpl: typeof fetch, now: () => number): Promise<ReplayResult> {
  const database = await db();
  const result: ReplayResult = { sent: 0, conflicts: 0, remaining: 0, held: 0, stopped: null };
  for (const listed of await database.getAllFromIndex("entries", "byCreated")) {
    // Another tab may have sent or changed it since the list was read.
    const entry = await database.get("entries", listed.id);
    if (!entry) continue;
    if (entry.state === "pending" && ownership(entry) !== "mine") {
      result.held += 1;
      continue;
    }
    if (entry.state !== "pending" || entry.nextAttemptAt > now()) {
      if (entry.state === "pending") result.remaining += 1;
      continue;
    }
    try {
      const body = { ...entry.body };
      if (entry.photo) {
        if (!entry.photo.fileId) {
          const fileId = await upload(entry.photo, fetchImpl);
          entry.photo = { ...entry.photo, fileId };
          await updateEntry(entry.id, (fresh) =>
            fresh.photo ? { ...fresh, photo: { ...fresh.photo, fileId: fresh.photo.fileId ?? fileId } } : null,
          );
        }
        body[entry.photo.bodyField] = entry.photo.fileId;
      }
      const response = await fetchImpl(`/bff${entry.path}`, {
        method: entry.method,
        headers: { ...jsonHeaders, [IDEMPOTENCY_HEADER]: entry.idempotencyKey },
        body: JSON.stringify(body),
      });
      if (!response.ok) await classify(response);
      const answer: unknown = await response.json().catch(() => null);
      await updateEntry(entry.id, (fresh) => ({
        ...fresh,
        state: "sent",
        result: answer,
        sentAt: now(),
        problem: undefined,
        photo: fresh.photo ? { ...fresh.photo, blob: undefined } : undefined,
      }));
      result.sent += 1;
    } catch (error) {
      if (error instanceof ReplayStop) {
        result.stopped = "signed-out";
        result.remaining += 1;
        break;
      }
      if (error instanceof Refused) {
        // `idempotency.key_reused`: probably sent elsewhere with this key — if so the entry is `sent` by now and
        // `updateEntry` leaves it alone; otherwise it is shown as a conflict like any refusal.
        const stored = await updateEntry(entry.id, (fresh) => ({
          ...fresh,
          state: "conflict",
          problem: error.problem,
        }));
        if (stored?.state === "conflict") result.conflicts += 1;
        continue;
      }
      // Offline, a transient answer, or an upload interrupted: try again later.
      await updateEntry(entry.id, (fresh) => {
        const attempts = fresh.attempts + 1;
        return {
          ...fresh,
          attempts,
          nextAttemptAt: now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]!,
        };
      });
      result.remaining += 1;
    }
  }
  notify();
  return result;
}
