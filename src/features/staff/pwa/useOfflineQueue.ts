"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  discard,
  listQueue,
  ownership,
  QUEUE_EVENT,
  replayQueue,
  retry,
  type QueueEntry,
  type ReplayResult,
} from "@/lib/pwa/queue";
import { requestBackgroundSync } from "@/lib/pwa/register";

import { markMeaningfulAction } from "./PushPrompt";

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** `navigator.onLine` as React state (server render assumes online). */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

/**
 * The signed-in staff member's own entries (this tenant) as React state, kept fresh on every queue change
 * (`QUEUE_EVENT`, also fired when the identity changes) — without replaying anything (the shell's `SyncCenter` owns
 * the replay timer). Entries of anybody else are never shown on a screen (review M3).
 */
export function useQueueEntries(): QueueEntry[] {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  useEffect(() => {
    let alive = true;
    const refresh = () => {
      listQueue().then(
        (list) => alive && setEntries(list.filter((entry) => ownership(entry) === "mine")),
        () => alive && setEntries([]),
      );
    };
    refresh();
    window.addEventListener(QUEUE_EVENT, refresh);
    return () => {
      alive = false;
      window.removeEventListener(QUEUE_EVENT, refresh);
    };
  }, []);
  return entries;
}

const REPLAY_EVERY_MS = 30_000;

/**
 * The offline queue as the staff shell sees it: entries (pending + conflicts), a replay that runs on
 * start, when the browser comes back online, every 30 s while something waits, and on demand.
 */
export function useOfflineQueue(): {
  /** This person's entries in this tenant. */
  entries: QueueEntry[];
  /** Waiting entries this person queued in another tenant (sent after switching back). */
  otherTenant: QueueEntry[];
  /** How many waiting entries somebody else queued on this device (never listed, never sent as this person). */
  othersHeld: number;
  pending: number;
  conflicts: number;
  lastResult: ReplayResult | null;
  replayNow: () => Promise<void>;
  retry: (id: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
  /** Removes what somebody else left unsent on this device. */
  discardOthers: () => Promise<void>;
} {
  const [all, setEntries] = useState<QueueEntry[]>([]);
  const [lastResult, setLastResult] = useState<ReplayResult | null>(null);
  const online = useOnlineStatus();
  const entries = all.filter((entry) => ownership(entry) === "mine");
  const otherTenant = all.filter((entry) => entry.state !== "sent" && ownership(entry) === "other-tenant");
  const othersHeld = all.filter((entry) => entry.state !== "sent" && ownership(entry) === "someone-else").length;

  const refresh = useCallback(() => {
    listQueue().then(setEntries, () => setEntries([]));
  }, []);

  const replayNow = useCallback(async () => {
    if (!navigator.onLine) return;
    try {
      const result = await replayQueue();
      setLastResult(result);
      if (result.sent > 0) markMeaningfulAction();
    } finally {
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    listQueue().then(setEntries, () => setEntries([]));
    window.addEventListener(QUEUE_EVENT, refresh);
    return () => window.removeEventListener(QUEUE_EVENT, refresh);
  }, [refresh]);

  const pending = entries.filter((entry) => entry.state === "pending").length;
  const conflicts = entries.filter((entry) => entry.state === "conflict").length;

  useEffect(() => {
    if (!online) return;
    void replayNow();
    if (pending === 0) return;
    void requestBackgroundSync();
    const timer = window.setInterval(() => void replayNow(), REPLAY_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [online, pending, replayNow]);

  return {
    entries,
    otherTenant,
    othersHeld,
    pending,
    conflicts,
    lastResult,
    replayNow,
    retry: async (id) => {
      await retry(id);
      await replayNow();
    },
    discard,
    discardOthers: async () => {
      for (const entry of all) if (ownership(entry) === "someone-else") await discard(entry.id);
    },
  };
}
