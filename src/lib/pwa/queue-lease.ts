import type { IDBPDatabase } from "idb";

import { QUEUE_LOCK, type QueueDb } from "./queue";

/** How long a fallback lease lives without renewal (a tab that died while replaying frees it after this). */
const LEASE_MS = 60_000;

/**
 * The fallback lock: a lease record taken in a read-write transaction (IndexedDB serialises overlapping read-write
 * transactions across tabs, so check-and-take is atomic), renewed while the task runs and released after it. A
 * lease left by a tab that died expires after `LEASE_MS`.
 */
export async function withLease<T>(db: () => Promise<IDBPDatabase<QueueDb>>, task: () => Promise<T>): Promise<T> {
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
