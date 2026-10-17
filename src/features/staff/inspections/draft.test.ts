// @vitest-environment node
import "fake-indexeddb/auto";

import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import type { Schemas } from "@/lib/api/types";

import { editItem, emptyDraft, loadDraft, mergedItem, patchFor, resetDraftDb, saveDraft, settle } from "./draft";

const line = (itemKey: string, photos: string[] = []): Schemas["InspectionItemDto"] => ({
  id: `id-${itemKey}`,
  itemKey,
  label: itemKey,
  area: "room",
  condition: null,
  notes: null,
  photoDocumentIds: photos,
  meterRegister: null,
});

const inspection = {
  id: "i1",
  items: [line("walls", ["p1", "p2"]), line("floor"), line("meter:electric")],
} as unknown as Schemas["InspectionDto"];

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  resetDraftDb();
});

describe("inspection draft", () => {
  it("survives a reload: what is saved is what is loaded", async () => {
    const draft = editItem(emptyDraft("i1"), "walls", (item) => ({ ...item, condition: "fair", notes: "รอย" }));
    await saveDraft(draft);
    resetDraftDb();
    const loaded = await loadDraft("i1");
    expect(loaded.items.walls).toMatchObject({ condition: "fair", notes: "รอย" });
    expect(loaded.dirty).toEqual(["walls"]);
    expect((await loadDraft("other")).dirty).toEqual([]);
  });

  it("shows the API's line with this device's changes on top", () => {
    const draft = editItem(emptyDraft("i1"), "walls", (item) => ({ ...item, condition: "damaged", removed: ["p1"] }));
    const merged = mergedItem(inspection.items[0]!, draft.items.walls);
    expect(merged).toMatchObject({ condition: "damaged", notes: null, photoDocumentIds: ["p2"] });
  });

  it("patches only the dirty lines, with the full photo list, and waits for uploads", () => {
    let draft = editItem(emptyDraft("i1"), "walls", (item) => ({
      ...item,
      removed: ["p1"],
      added: [{ localId: "l1", blob: new Blob(["x"]) }],
    }));
    draft = editItem(draft, "floor", (item) => ({ ...item, condition: "good" }));
    expect(patchFor(inspection, draft)).toEqual({ items: [{ itemKey: "floor", condition: "good" }], keys: ["floor"] });

    draft = editItem(draft, "walls", (item) => ({ ...item, added: [{ localId: "l1", fileId: "p9" }] }));
    expect(patchFor(inspection, draft).items).toEqual([
      { itemKey: "walls", photoDocumentIds: ["p2", "p9"] },
      { itemKey: "floor", condition: "good" },
    ]);
  });

  it("settles the lines the API accepted unless they changed meanwhile", () => {
    const sent = editItem(
      editItem(emptyDraft("i1"), "floor", (i) => ({ ...i, condition: "good" })),
      "walls",
      (i) => ({
        ...i,
        notes: "a",
      }),
    );
    const meanwhile = editItem(sent, "walls", (i) => ({ ...i, notes: "ab" }));
    const settled = settle(meanwhile, sent, ["floor", "walls"]);
    expect(settled.dirty).toEqual(["walls"]);
    expect(settled.items.floor).toBeUndefined();
    expect(settled.items.walls?.notes).toBe("ab");
  });
});
