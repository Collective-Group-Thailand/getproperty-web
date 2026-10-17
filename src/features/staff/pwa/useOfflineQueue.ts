"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  discard,
  listQueue,
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

const REPLAY_EVERY_MS = 30_000;

/**
 * The offline queue as the staff shell sees it: entries (pending + conflicts), a replay that runs on
 * start, when the browser comes back online, every 30 s while something waits, and on demand.
 */
export function useOfflineQueue(): {
  entries: QueueEntry[];
  pending: number;
  conflicts: number;
  lastResult: ReplayResult | null;
  replayNow: () => Promise<void>;
  retry: (id: string) => Promise<void>;
  discard: (id: string) => Promise<void>;
} {
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [lastResult, setLastResult] = useState<ReplayResult | null>(null);
  const online = useOnlineStatus();

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
    pending,
    conflicts,
    lastResult,
    replayNow,
    retry: async (id) => {
      await retry(id);
      await replayNow();
    },
    discard,
  };
}
