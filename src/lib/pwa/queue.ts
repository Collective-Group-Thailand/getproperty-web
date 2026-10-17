import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import { CSRF_HEADER, IDEMPOTENCY_HEADER } from "@/lib/api/headers";
import type { Schemas } from "@/lib/api/types";

/**
 * The staff PWA's offline queue (ADR-0007, F1 1.3 §5). A submission that must not be lost — a meter
 * reading with its photo — is written to IndexedDB *first*, with its `Idempotency-Key` fixed at that
 * moment, and then replayed until the API answers:
 *
 * - 2xx → removed (a replay of an already-accepted request returns the original response, contract §3);
 * - a refusal (409, 412, 422 and other 4xx) → kept as a **conflict** with the API's problem, shown to the
 *   staff member, never retried blindly;
 * - 401 → replay stops until the staff member signs in again (nothing is dropped);
 * - offline, 408, 429, 5xx → retried with backoff.
 *
 * The photo goes to object storage by presign (never through the BFF body): presign → PUT → complete,
 * once; the resulting `fileId` is stored on the entry so a retry does not upload twice.
 */

export type QueueState = "pending" | "conflict";

export interface QueuedPhoto {
  blob: Blob;
  fileName: string;
  kind: Schemas["UploadKind"];
  scopeType: Schemas["DocumentScope"];
  scopeId: string | null;
  /** The body field that receives the uploaded `fileId`. */
  bodyField: string;
  /** Set once uploaded and completed. */
  fileId?: string;
}

export interface QueueEntry {
  id: string;
  /** Fixed at enqueue time and sent on every replay (contract §3 idempotency). */
  idempotencyKey: string;
  method: "POST" | "PUT" | "PATCH";
  /** Upstream path, e.g. `/v1/staff/readings` — sent through this host's BFF. */
  path: string;
  body: Record<string, unknown>;
  photo?: QueuedPhoto;
  /** What the staff member sees in the sync sheet (unit code, meter). */
  label: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  state: QueueState;
  problem?: { status: number; code: string; detail: string; requestId?: string };
}

interface QueueDb extends DBSchema {
  entries: { key: string; value: QueueEntry; indexes: { byCreated: number } };
}

const DB_NAME = "gp-staff-queue";
const BACKOFF_MS = [5_000, 15_000, 60_000, 5 * 60_000, 15 * 60_000];
export const QUEUE_EVENT = "gp:offline-queue";

let dbPromise: Promise<IDBPDatabase<QueueDb>> | undefined;

function db(): Promise<IDBPDatabase<QueueDb>> {
  dbPromise ??= openDB<QueueDb>(DB_NAME, 1, {
    upgrade(database) {
      const store = database.createObjectStore("entries", { keyPath: "id" });
      store.createIndex("byCreated", "createdAt");
    },
  });
  return dbPromise;
}

/** Test hook: forget the open connection (fake-indexeddb is reset between tests). */
export function resetQueueDb(): void {
  dbPromise = undefined;
}

function notify(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
}

export async function enqueue(
  entry: Pick<QueueEntry, "method" | "path" | "body" | "label" | "photo"> & { idempotencyKey?: string },
): Promise<QueueEntry> {
  const now = Date.now();
  const stored: QueueEntry = {
    id: crypto.randomUUID(),
    idempotencyKey: entry.idempotencyKey ?? crypto.randomUUID(),
    method: entry.method,
    path: entry.path,
    body: entry.body,
    photo: entry.photo,
    label: entry.label,
    createdAt: now,
    attempts: 0,
    nextAttemptAt: now,
    state: "pending",
  };
  await (await db()).put("entries", stored);
  notify();
  return stored;
}

export async function listQueue(): Promise<QueueEntry[]> {
  return (await db()).getAllFromIndex("entries", "byCreated");
}

export async function discard(id: string): Promise<void> {
  await (await db()).delete("entries", id);
  notify();
}

/** Puts a conflict back in line (after the staff member fixed what the API refused, e.g. re-signed in). */
export async function retry(id: string): Promise<void> {
  const database = await db();
  const entry = await database.get("entries", id);
  if (!entry) return;
  await database.put("entries", { ...entry, state: "pending", problem: undefined, nextAttemptAt: Date.now() });
  notify();
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

async function classify(response: Response): Promise<never> {
  if (response.status === 401) throw new ReplayStop("signed out");
  if (response.status === 408 || response.status === 429 || response.status >= 500)
    throw new Transient(String(response.status));
  const problem = (await response.json().catch(() => ({}))) as { code?: string; detail?: string; requestId?: string };
  throw new Refused({
    status: response.status,
    code: problem.code ?? `http.${response.status}`,
    detail: problem.detail ?? "",
    requestId: problem.requestId ?? response.headers.get("x-request-id") ?? undefined,
  });
}

async function upload(photo: QueuedPhoto, fetchImpl: typeof fetch): Promise<string> {
  const presign = await fetchImpl("/bff/v1/staff/files/presign", {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      kind: photo.kind,
      scopeType: photo.scopeType,
      scopeId: photo.scopeId,
      fileName: photo.fileName,
      mimeType: photo.blob.type || "image/jpeg",
      sizeBytes: photo.blob.size,
      sha256: await sha256Hex(photo.blob),
    }),
  });
  if (!presign.ok) await classify(presign);
  const signed = (await presign.json()) as Schemas["FilePresignedDto"];
  if (!signed.uploadUrl) throw new Refused({ status: 422, code: "document.multipart_unsupported", detail: "" });
  const put = await fetchImpl(signed.uploadUrl, { method: "PUT", headers: signed.headers, body: photo.blob });
  if (!put.ok) throw new Transient(`upload ${put.status}`);
  const complete = await fetchImpl(`/bff/v1/staff/files/${encodeURIComponent(signed.file.id)}/actions/complete`, {
    method: "POST",
    headers: jsonHeaders,
    body: "{}",
  });
  if (!complete.ok) await classify(complete);
  return signed.file.id;
}

export interface ReplayResult {
  sent: number;
  conflicts: number;
  remaining: number;
  stopped: "signed-out" | null;
}

let replaying: Promise<ReplayResult> | undefined;

/** Sends what is due, oldest first; one replay at a time per tab. */
export function replayQueue(fetchImpl: typeof fetch = fetch, now = Date.now): Promise<ReplayResult> {
  replaying ??= run(fetchImpl, now).finally(() => {
    replaying = undefined;
  });
  return replaying;
}

async function run(fetchImpl: typeof fetch, now: () => number): Promise<ReplayResult> {
  const database = await db();
  const result: ReplayResult = { sent: 0, conflicts: 0, remaining: 0, stopped: null };
  for (const entry of await database.getAllFromIndex("entries", "byCreated")) {
    if (entry.state !== "pending" || entry.nextAttemptAt > now()) {
      if (entry.state === "pending") result.remaining += 1;
      continue;
    }
    try {
      const body = { ...entry.body };
      if (entry.photo) {
        if (!entry.photo.fileId) {
          entry.photo.fileId = await upload(entry.photo, fetchImpl);
          await database.put("entries", entry);
        }
        body[entry.photo.bodyField] = entry.photo.fileId;
      }
      const response = await fetchImpl(`/bff${entry.path}`, {
        method: entry.method,
        headers: { ...jsonHeaders, [IDEMPOTENCY_HEADER]: entry.idempotencyKey },
        body: JSON.stringify(body),
      });
      if (!response.ok) await classify(response);
      await database.delete("entries", entry.id);
      result.sent += 1;
    } catch (error) {
      if (error instanceof ReplayStop) {
        result.stopped = "signed-out";
        result.remaining += 1;
        break;
      }
      if (error instanceof Refused) {
        await database.put("entries", { ...entry, state: "conflict", problem: error.problem });
        result.conflicts += 1;
        continue;
      }
      // Offline, a transient answer, or an upload interrupted: try again later.
      const attempts = entry.attempts + 1;
      await database.put("entries", {
        ...entry,
        attempts,
        nextAttemptAt: now() + BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]!,
      });
      result.remaining += 1;
    }
  }
  notify();
  return result;
}
