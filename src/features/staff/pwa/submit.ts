import { enqueue, getEntry, replayQueue, type QueueEntry } from "@/lib/pwa/queue";

/**
 * Every submission that must not be lost goes through the offline queue (ADR-0007): written to
 * IndexedDB first with its Idempotency-Key, then — when the device is online — sent at once. The
 * caller gets the entry as it stands afterwards: `sent` (with the API's answer), `conflict` (with the
 * API's problem) or still `pending` (offline, or the API was unreachable; the shell replays it).
 */
export async function submitThroughQueue(input: Parameters<typeof enqueue>[0]): Promise<QueueEntry> {
  const entry = await enqueue(input);
  if (typeof navigator !== "undefined" && !navigator.onLine) return entry;
  await replayQueue().catch(() => undefined);
  // A replay that was already running when this entry was added may not have picked it up.
  let latest = await getEntry(entry.id);
  if (latest?.state === "pending" && latest.attempts === 0) {
    await replayQueue().catch(() => undefined);
    latest = await getEntry(entry.id);
  }
  return latest ?? entry;
}
