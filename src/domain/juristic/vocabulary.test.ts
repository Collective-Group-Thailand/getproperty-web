import { describe, expect, it } from "vitest";

import en from "@/i18n/messages/en/owner/juristic.json";
import th from "@/i18n/messages/th/owner/juristic.json";

import {
  KIND_TRAITS,
  kindOf,
  PROPERTY_KINDS,
  SUGGESTED_LEGAL_FORM,
  VOCABULARY_WORDS,
  vocabularyKeys,
} from "./vocabulary";

function lookup(messages: Record<string, unknown>, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages);
}

describe("property-kind vocabulary (J-DESIGN §1.3)", () => {
  it("names every word of every kind in Thai and English", () => {
    for (const kind of PROPERTY_KINDS)
      for (const key of Object.values(vocabularyKeys(kind))) {
        expect(typeof lookup(th, key), `th ${key}`).toBe("string");
        expect(typeof lookup(en, key), `en ${key}`).toBe("string");
      }
    expect(VOCABULARY_WORDS).toEqual(["unit", "units", "group", "size", "share"]);
  });

  it("uses the J-DESIGN words for the four families", () => {
    const word = (kind: (typeof PROPERTY_KINDS)[number], name: (typeof VOCABULARY_WORDS)[number]) =>
      lookup(th, vocabularyKeys(kind)[name]);
    expect(word("condo", "unit")).toBe("ห้องชุด");
    expect(word("condo", "share")).toBe("อัตราส่วนกรรมสิทธิ์");
    expect(word("village", "unit")).toBe("บ้าน");
    expect(word("village", "group")).toBe("ซอย");
    expect(word("village", "size")).toContain("ตร.วา");
    expect(word("office", "unit")).toBe("พื้นที่เช่า");
    expect(word("apartment", "unit")).toBe("ห้อง");
  });

  it("lays out estates by plot with land, condominiums by floor with the ratio", () => {
    expect(KIND_TRAITS.village).toEqual({ layout: "plots", size: "landAreaSqwa", ratio: false });
    expect(KIND_TRAITS.community.layout).toBe("plots");
    expect(KIND_TRAITS.condo).toEqual({ layout: "floors", size: "areaSqm", ratio: true });
    expect(KIND_TRAITS.office.ratio).toBe(false);
    for (const kind of PROPERTY_KINDS) expect(KIND_TRAITS[kind]).toBeDefined();
  });

  it("falls back to the condominium's words when the API has no kind", () => {
    expect(kindOf(null)).toBe("condo");
    expect(kindOf({ kind: null })).toBe("condo");
    expect(kindOf({ kind: "village" })).toBe("village");
  });

  it("suggests the usual legal form per kind", () => {
    expect(SUGGESTED_LEGAL_FORM.condo).toBe("condo_act");
    expect(SUGGESTED_LEGAL_FORM.village).toBe("land_allocation_act");
  });
});
