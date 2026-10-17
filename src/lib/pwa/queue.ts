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

interface QueueDb extends DBSchema {
  entries: { key: string; value: QueueEntry; indexes: { byCreated: number } };
}

const DB_NAME = "gp-staff-queue";
const BACKOFF_MS = [5_000, 15_000, 60_000, 5 * 60_000, 15 * 60_000];
/** How long a sent entry (and its answer) stays visible. */
export const SENT_TTL_MS = 24 * 3600_000;
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
  entry: Pick<QueueEntry, "method" | "path" | "body" | "label" | "photo" | "meta"> & { idempotencyKey?: string },
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
  stopped: "signed-out" | null;
}

let replaying: Promise<ReplayResult> | undefined;

/** Sends what is due, oldest first (sent entries are skipped); one replay at a time per tab. */
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
      const answer: unknown = await response.json().catch(() => null);
      await database.put("entries", {
        ...entry,
        state: "sent",
        result: answer,
        sentAt: now(),
        problem: undefined,
        photo: entry.photo ? { ...entry.photo, blob: undefined } : undefined,
      });
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
