"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrapWithETag } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { uploadFile, UploadError } from "@/lib/pwa/queue";

import { emptyDraft, loadDraft, patchFor, saveDraft, settle, type InspectionDraft } from "./draft";

export type SyncState = "loading" | "idle" | "local" | "saving" | "saved" | "offline" | "error";

export interface SyncProblem {
  code: string;
  detail: string;
  requestId?: string;
}

const DEBOUNCE_MS = 1200;

/**
 * The checklist's state: the API's inspection (and its ETag), this device's draft, and a sync that
 * uploads new photos and sends the dirty lines with `If-Match` — debounced after each change, on
 * reconnect, and on demand. A stale ETag (412) refetches and sends again once: lines changed on this
 * device win over the server's copy of the same lines (recorded assumption, F4 4.2).
 */
export function useInspectionDraft(initial: Schemas["InspectionDto"], initialEtag: string | null) {
  const [server, setServer] = useState(initial);
  const [draft, setDraft] = useState<InspectionDraft>(() => emptyDraft(initial.id));
  const [state, setState] = useState<SyncState>("loading");
  const [problem, setProblem] = useState<SyncProblem | null>(null);
  const serverRef = useRef(initial);
  const etagRef = useRef(initialEtag);
  const draftRef = useRef(draft);
  const syncing = useRef<Promise<void> | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const commit = useCallback(async (next: InspectionDraft) => {
    draftRef.current = next;
    setDraft(next);
    await saveDraft(next);
  }, []);

  const refetch = useCallback(async () => {
    const { data, etag } = await unwrapWithETag(
      browserApi().GET("/v1/staff/inspections/{inspectionId}", { params: { path: { inspectionId: initial.id } } }),
    );
    serverRef.current = data;
    etagRef.current = etag;
    setServer(data);
  }, [initial.id]);

  const run = useCallback(async () => {
    if (!navigator.onLine) {
      setState(draftRef.current.dirty.length > 0 ? "offline" : "idle");
      return;
    }
    if (draftRef.current.dirty.length === 0) return;
    setState("saving");
    setProblem(null);
    try {
      // 1. Photos first: each new photo is uploaded once and keeps only its document id.
      for (const key of draftRef.current.dirty) {
        for (const photo of draftRef.current.items[key]?.added ?? []) {
          if (photo.fileId || !photo.blob) continue;
          const fileId = await uploadFile({
            blob: photo.blob,
            fileName: `inspection-${key.replace(/[^a-z0-9]+/gi, "-")}-${photo.localId.slice(0, 8)}.jpg`,
            kind: "inspection_photo",
            scopeType: "unit",
            scopeId: serverRef.current.unitId,
            bodyField: "photoDocumentIds",
          });
          const current = draftRef.current;
          const item = current.items[key]!;
          await commit({
            ...current,
            items: {
              ...current.items,
              [key]: {
                ...item,
                added: item.added.map((p) => (p.localId === photo.localId ? { localId: p.localId, fileId } : p)),
              },
            },
          });
        }
      }
      // 2. The dirty lines, with If-Match; a stale ETag refetches and tries once more.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const sent = draftRef.current;
        const { items, keys } = patchFor(serverRef.current, sent);
        if (items.length === 0) break;
        try {
          const { data, etag } = await unwrapWithETag(
            browserApi().PATCH("/v1/staff/inspections/{inspectionId}/items", {
              params: { path: { inspectionId: initial.id }, header: { "If-Match": etagRef.current ?? "" } },
              body: { items },
            }),
          );
          serverRef.current = data;
          etagRef.current = etag;
          setServer(data);
          await commit(settle(draftRef.current, sent, keys));
          break;
        } catch (error) {
          if (attempt === 0 && isApiError(error) && error.code === "concurrency.stale") {
            await refetch();
            continue;
          }
          throw error;
        }
      }
      setState(draftRef.current.dirty.length > 0 ? "local" : "saved");
    } catch (error) {
      if (error instanceof UploadError && error.problem.code === "network") setState("offline");
      else if (isApiError(error)) {
        setProblem({ code: error.code, detail: error.detail, requestId: error.requestId });
        setState("error");
      } else if (error instanceof UploadError) {
        setProblem({ code: error.problem.code, detail: error.problem.detail, requestId: error.problem.requestId });
        setState("error");
      } else setState("offline");
    }
  }, [commit, initial.id, refetch]);

  /** One sync at a time; a call during a sync runs once more after it (changes made meanwhile). */
  const sync = useCallback((): Promise<void> => {
    const start = (): Promise<void> => {
      const running = run().finally(() => {
        if (syncing.current === running) syncing.current = null;
      });
      syncing.current = running;
      return running;
    };
    if (syncing.current) return syncing.current.then(start);
    return start();
  }, [run]);

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void sync(), DEBOUNCE_MS);
  }, [sync]);

  /** Applies a change: written to IndexedDB at once, sent to the API shortly after. */
  const update = useCallback(
    async (change: (current: InspectionDraft) => InspectionDraft) => {
      await commit(change(draftRef.current));
      setState(navigator.onLine ? "local" : "offline");
      schedule();
    },
    [commit, schedule],
  );

  useEffect(() => {
    let alive = true;
    void loadDraft(initial.id).then((stored) => {
      if (!alive) return;
      draftRef.current = stored;
      setDraft(stored);
      setState(stored.dirty.length > 0 ? (navigator.onLine ? "local" : "offline") : "idle");
      if (stored.dirty.length > 0) void sync();
    });
    const online = () => void sync();
    window.addEventListener("online", online);
    return () => {
      alive = false;
      window.removeEventListener("online", online);
      window.clearTimeout(timer.current);
    };
  }, [initial.id, sync]);

  /** Merges fields into the latest draft (signatures, completion notes) without touching the lines. */
  const patch = useCallback(
    (
      fields: Partial<
        Pick<InspectionDraft, "staffSignature" | "residentSignature" | "notes" | "completeKey" | "completeFingerprint">
      >,
    ) => commit({ ...draftRef.current, ...fields }),
    [commit],
  );

  return { server, draft, state, problem, update, sync, patch, refetch };
}
