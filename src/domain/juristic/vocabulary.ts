import type { Schemas } from "@/lib/api/types";

export type PropertyKind = Schemas["PropertyKind"];
export type BuildingLegalForm = Schemas["BuildingLegalForm"];

/** Every property kind of the contract, in the order pickers list them (D-302). */
export const PROPERTY_KINDS: readonly PropertyKind[] = [
  "condo",
  "village",
  "community",
  "office",
  "retail",
  "industrial",
  "mixed",
  "apartment",
];

/** Every legal form of the contract (D-302), in the order pickers list them. */
export const LEGAL_FORMS: readonly BuildingLegalForm[] = [
  "condo_act",
  "land_allocation_act",
  "voluntary",
  "lease_contract",
];

/**
 * What a property kind changes on screen besides words (J-DESIGN §1.3 "property kind changes words, not screens"): how
 * the register groups units (plots by soi, or floors of a building), which size the unit carries (ตร.ม. or ตร.วา) and
 * whether an ownership ratio is shown. Copy is never chosen here — the words are i18n keys
 * `owner.juristic.word.<word>.<kind>` (see `vocabularyKeys`).
 */
export interface KindTraits {
  layout: "plots" | "floors";
  size: "areaSqm" | "landAreaSqwa";
  ratio: boolean;
}

export const KIND_TRAITS: Readonly<Record<PropertyKind, KindTraits>> = {
  condo: { layout: "floors", size: "areaSqm", ratio: true },
  village: { layout: "plots", size: "landAreaSqwa", ratio: false },
  community: { layout: "plots", size: "landAreaSqwa", ratio: false },
  office: { layout: "floors", size: "areaSqm", ratio: false },
  retail: { layout: "floors", size: "areaSqm", ratio: false },
  industrial: { layout: "floors", size: "areaSqm", ratio: false },
  // A mixed-use project reads like a condominium (buildings and floors; a ratio where the condo part has one).
  mixed: { layout: "floors", size: "areaSqm", ratio: true },
  apartment: { layout: "floors", size: "areaSqm", ratio: false },
};

/** The words a property kind names (`owner.juristic.word.<word>.<kind>`). */
export const VOCABULARY_WORDS = ["unit", "units", "group", "size", "share"] as const;
export type VocabularyWord = (typeof VOCABULARY_WORDS)[number];

/** A property's kind, or the condominium's words when the API has none yet (non-juristic data, D-251 stubs). */
export function kindOf(property: Pick<Schemas["PropertyDto"], "kind"> | null | undefined): PropertyKind {
  return property?.kind ?? "condo";
}

/** The message keys of a kind's words, relative to `owner.juristic` (`word.unit.village`). */
export function vocabularyKeys(kind: PropertyKind): Record<VocabularyWord, `word.${VocabularyWord}.${PropertyKind}`> {
  return Object.fromEntries(VOCABULARY_WORDS.map((word) => [word, `word.${word}.${kind}`])) as Record<
    VocabularyWord,
    `word.${VocabularyWord}.${PropertyKind}`
  >;
}

/** The legal form a new building of a kind most likely has — the picker's first suggestion, never a silent default. */
export const SUGGESTED_LEGAL_FORM: Readonly<Record<PropertyKind, BuildingLegalForm>> = {
  condo: "condo_act",
  village: "land_allocation_act",
  community: "voluntary",
  office: "lease_contract",
  retail: "lease_contract",
  industrial: "lease_contract",
  mixed: "condo_act",
  apartment: "lease_contract",
};
