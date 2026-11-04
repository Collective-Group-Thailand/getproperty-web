"use client";

import { useEffect, useSyncExternalStore } from "react";

/** The record the navigation column is showing (redesign G8): its name and short key, set by the record's page. */
export interface RailRecordInfo {
  id: string;
  name: string;
  slug?: string;
}

let current: RailRecordInfo | null = null;
const listeners = new Set<() => void>();

function set(next: RailRecordInfo | null) {
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The record named by the page on screen, or null (server render, other pages). */
export function useRailRecord(): RailRecordInfo | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/**
 * Names the record in the navigation column (the column switches to the record's sections on its pages). Renders
 * nothing; the record page renders it once.
 */
export function RailRecord({ id, name, slug }: RailRecordInfo) {
  useEffect(() => {
    set({ id, name, slug });
    return () => set(null);
  }, [id, name, slug]);
  return null;
}
