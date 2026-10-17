import { openDB, type DBSchema, type IDBPDatabase } from "idb";

import type { Schemas } from "@/lib/api/types";

/**
 * The inspection checklist kept on the device while it is being filled in (F4 4.2, ADR-0007): every
 * change is written to IndexedDB first — conditions, notes, meter registers, new photos (compressed
 * blobs), signatures — so a checklist survives no signal, a reload, a closed tab. Lines changed here
 * are `dirty` until the API has them (`PATCH …/items` with `If-Match`); new photos keep their blob
 * until uploaded, then only their document id.
 */

export interface DraftPhoto {
  localId: string;
  blob?: Blob;
  /** Set once uploaded (presign → PUT → complete). */
  fileId?: string;
}

export interface DraftItem {
  condition?: Schemas["ItemCondition"] | null;
  notes?: string | null;
  meterRegister?: string | null;
  /** Photos taken on this device for the line. */
  added: DraftPhoto[];
  /** Server photo ids removed on this device. */
  removed: string[];
}

export interface InspectionDraft {
  inspectionId: string;
  items: Record<string, DraftItem>;
  /** Item keys with changes the API does not have yet. */
  dirty: string[];
  /** Signatures drawn on the device, until the inspection is completed. */
  staffSignature?: Blob;
  residentSignature?: Blob;
  notes?: string;
  /** The completion's Idempotency-Key, fixed at the first attempt so a retry is a replay. */
  completeKey?: string;
  updatedAt: number;
}

interface DraftDb extends DBSchema {
  drafts: { key: string; value: InspectionDraft };
}

let dbPromise: Promise<IDBPDatabase<DraftDb>> | undefined;
function db() {
  dbPromise ??= openDB<DraftDb>("gp-staff-inspections", 1, {
    upgrade(database) {
      database.createObjectStore("drafts", { keyPath: "inspectionId" });
    },
  });
  return dbPromise;
}

/** Test hook. */
export function resetDraftDb(): void {
  dbPromise = undefined;
}

export function emptyDraft(inspectionId: string): InspectionDraft {
  return { inspectionId, items: {}, dirty: [], updatedAt: Date.now() };
}

export async function loadDraft(inspectionId: string): Promise<InspectionDraft> {
  return (await (await db()).get("drafts", inspectionId)) ?? emptyDraft(inspectionId);
}

export async function saveDraft(draft: InspectionDraft): Promise<void> {
  await (await db()).put("drafts", { ...draft, updatedAt: Date.now() });
}

export async function deleteDraft(inspectionId: string): Promise<void> {
  await (await db()).delete("drafts", inspectionId);
}

/** Applies a change to one line and marks it dirty (pure: returns a new draft). */
export function editItem(
  draft: InspectionDraft,
  itemKey: string,
  change: (item: DraftItem) => DraftItem,
): InspectionDraft {
  const current = draft.items[itemKey] ?? { added: [], removed: [] };
  return {
    ...draft,
    items: { ...draft.items, [itemKey]: change(current) },
    dirty: draft.dirty.includes(itemKey) ? draft.dirty : [...draft.dirty, itemKey],
  };
}

/** The line as the screen shows it: the API's values with this device's changes on top. */
export function mergedItem(item: Schemas["InspectionItemDto"], draft: DraftItem | undefined) {
  return {
    ...item,
    condition: draft && draft.condition !== undefined ? draft.condition : item.condition,
    notes: draft && draft.notes !== undefined ? draft.notes : item.notes,
    meterRegister: draft && draft.meterRegister !== undefined ? draft.meterRegister : item.meterRegister,
    photoDocumentIds: item.photoDocumentIds.filter((id) => !draft?.removed.includes(id)),
    added: draft?.added ?? [],
  };
}

/**
 * The `PATCH …/items` body for the dirty lines: only what changed, with the line's full photo list
 * (the API replaces it) — server photos minus removed plus uploaded. Lines with photos not uploaded
 * yet are left out until they are.
 */
export function patchFor(
  inspection: Schemas["InspectionDto"],
  draft: InspectionDraft,
): { items: Schemas["InspectionItemPatchDto"][]; keys: string[] } {
  const items: Schemas["InspectionItemPatchDto"][] = [];
  const keys: string[] = [];
  for (const key of draft.dirty) {
    const line = inspection.items.find((item) => item.itemKey === key);
    const change = draft.items[key];
    if (!line || !change) continue;
    if (change.added.some((photo) => !photo.fileId)) continue;
    const patch: Schemas["InspectionItemPatchDto"] = { itemKey: key };
    if (change.condition !== undefined) patch.condition = change.condition;
    if (change.notes !== undefined) patch.notes = change.notes;
    if (change.meterRegister !== undefined) patch.meterRegister = change.meterRegister;
    if (change.added.length > 0 || change.removed.length > 0) {
      patch.photoDocumentIds = [
        ...line.photoDocumentIds.filter((id) => !change.removed.includes(id)),
        ...change.added.map((photo) => photo.fileId!),
      ].filter((id, index, all) => all.indexOf(id) === index);
    }
    items.push(patch);
    keys.push(key);
  }
  return { items, keys };
}

/**
 * After the API accepted `keys`: those lines are clean again unless they changed meanwhile (`sent`
 * is the draft as it was sent). The new server state already carries their values and photos.
 */
export function settle(current: InspectionDraft, sent: InspectionDraft, keys: string[]): InspectionDraft {
  const items = { ...current.items };
  const dirty = current.dirty.filter((key) => {
    if (!keys.includes(key)) return true;
    const unchanged = JSON.stringify(stripBlobs(current.items[key])) === JSON.stringify(stripBlobs(sent.items[key]));
    if (unchanged) delete items[key];
    return !unchanged;
  });
  return { ...current, items, dirty };
}

function stripBlobs(item: DraftItem | undefined) {
  return item ? { ...item, added: item.added.map(({ localId, fileId }) => ({ localId, fileId })) } : null;
}
