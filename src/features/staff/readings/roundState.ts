import type { Schemas } from "@/lib/api/types";
import type { QueueEntry, QueueMeta } from "@/lib/pwa/queue";

export type ReadingMeta = Extract<QueueMeta, { kind: "meter-reading" }>;
export type ReadingEntry = QueueEntry & { meta: ReadingMeta };

export function isReadingEntry(entry: QueueEntry): entry is ReadingEntry {
  return entry.meta?.kind === "meter-reading";
}

export interface RoundView {
  /** Items still to read, in the API's floor → unit order (without those this device already queued). */
  remaining: { floor: Schemas["RoundFloorDto"]; items: Schemas["RoundItemDto"][] }[];
  /** This device's submissions of the round, newest per meter: sent, waiting, or refused. */
  local: ReadingEntry[];
  /**
   * Entries read before the round's window (`windowStart`): the API does not count them for this
   * round (D-187), so their meter stays in the list and they are shown as "read early".
   */
  early: ReadonlySet<string>;
  /** Read so far (sent or waiting to send) out of the round's meters this device knows of. */
  done: number;
  total: number;
  /** The first item still to read after `assetItemId` (round order), for "next meter". */
  next: (assetItemId: string | null) => Schemas["RoundItemDto"] | null;
}

/**
 * Merges the API's round (meters still to read) with this device's queue (readings sent or waiting):
 * a meter with a local reading of the same building and period leaves the list at once — offline too —
 * and shows in "done" with its sync state; a refused one stays visible until it is resolved. The
 * round's own count is the API's; progress is what this device knows (a contract request asks for the
 * round's read count, docs/contract-requests.md). A reading taken before the round's window opens does
 * not count for the round (the API keeps asking for it) and is kept visible as "read early".
 */
export function roundView(round: Schemas["RoundBuildingDto"], entries: QueueEntry[]): RoundView {
  const windowStart = Date.parse(round.windowStart);
  const latest = new Map<string, ReadingEntry>();
  for (const entry of entries) {
    if (!isReadingEntry(entry)) continue;
    if (entry.meta.buildingId !== round.buildingId || entry.meta.periodKey !== round.periodKey) continue;
    const previous = latest.get(entry.meta.assetItemId);
    if (!previous || previous.createdAt <= entry.createdAt) latest.set(entry.meta.assetItemId, entry);
  }
  const early = new Set<string>();
  for (const entry of latest.values()) {
    const readAt = Date.parse(String((entry.body as { readAt?: unknown }).readAt ?? ""));
    if (Number.isFinite(readAt) && Number.isFinite(windowStart) && readAt < windowStart) early.add(entry.id);
  }
  const handled = (assetItemId: string) => {
    const entry = latest.get(assetItemId);
    return entry !== undefined && entry.state !== "conflict" && !early.has(entry.id);
  };
  const remaining = round.floors
    .map((floor) => ({ floor, items: floor.items.filter((item) => !handled(item.assetItemId)) }))
    .filter((group) => group.items.length > 0);
  const order = round.floors.flatMap((floor) => floor.items);
  const local = [...latest.values()].sort((a, b) => b.createdAt - a.createdAt);
  const done = local.filter((entry) => entry.state !== "conflict" && !early.has(entry.id)).length;
  const left = remaining.reduce((sum, group) => sum + group.items.length, 0);
  return {
    remaining,
    local,
    early,
    done,
    total: done + left,
    next(assetItemId) {
      const start = assetItemId ? order.findIndex((item) => item.assetItemId === assetItemId) : -1;
      const after = [...order.slice(start + 1), ...order.slice(0, Math.max(start, 0))];
      return after.find((item) => !handled(item.assetItemId) && item.assetItemId !== assetItemId) ?? null;
    },
  };
}
