/**
 * Thai licence plates on the gate tablet (JW4, J-DESIGN §4 "plate keypad"). A plate is three parts, as printed:
 * the category (`1กข`, `กข`, `70` for some vans — 1–4 characters of digits and Thai consonants with at least one
 * consonant on private cars), the number (1–4 digits) and the province as written on the plate.
 *
 * The keypad offers the consonants grouped by their class (กลาง · สูง · ต่ำคู่ · ต่ำเดี่ยว), the order every Thai
 * reader learnt them in, so a guard finds a letter by its sound group instead of hunting through 42 keys. ฃ and ฅ are
 * left out: they are obsolete and never issued on plates.
 *
 * Normalisation mirrors the API's (J4.2 plate matching): Thai digits become Arabic, spaces / dashes / dots go,
 * the province is trimmed. The API checks again; this only keeps the form honest before a request.
 */

export const CONSONANT_GROUPS = [
  { key: "mid", letters: ["ก", "จ", "ฎ", "ฏ", "ด", "ต", "บ", "ป", "อ"] },
  { key: "high", letters: ["ข", "ฉ", "ฐ", "ถ", "ผ", "ฝ", "ศ", "ษ", "ส", "ห"] },
  { key: "lowPaired", letters: ["ค", "ฆ", "ช", "ซ", "ฌ", "ฑ", "ฒ", "ท", "ธ", "พ", "ฟ", "ภ", "ฮ"] },
  { key: "lowSingle", letters: ["ง", "ญ", "ณ", "น", "ม", "ย", "ร", "ล", "ว", "ฬ"] },
] as const;

export type ConsonantGroup = (typeof CONSONANT_GROUPS)[number]["key"];

const CONSONANTS = new Set<string>(CONSONANT_GROUPS.flatMap((group) => [...group.letters]));
const THAI_DIGITS = "๐๑๒๓๔๕๖๗๘๙";

export const CATEGORY_MAX = 4;
export const NUMBER_MAX = 4;

export interface PlateDraft {
  category: string;
  number: string;
  province: string;
}

export const EMPTY_PLATE: PlateDraft = { category: "", number: "", province: "" };

/** Thai digits → Arabic; spaces, dashes, dots and other separators dropped. */
export function normaliseChars(value: string): string {
  let out = "";
  for (const char of value) {
    const thai = THAI_DIGITS.indexOf(char);
    if (thai >= 0) out += String(thai);
    else if (/[0-9]/.test(char) || CONSONANTS.has(char) || /[ก-ฮ]/.test(char)) out += char;
  }
  return out;
}

export function normalisePlate(plate: PlateDraft): PlateDraft {
  return {
    category: normaliseChars(plate.category).slice(0, CATEGORY_MAX),
    number: normaliseChars(plate.number).replace(/\D/g, "").slice(0, NUMBER_MAX),
    province: plate.province.trim(),
  };
}

export function isConsonant(char: string): boolean {
  return CONSONANTS.has(char);
}

export type PlateField = "category" | "number" | "province";

/** What the keypad does with a key press on the field in focus (pure, unit-tested). */
export type KeypadAction =
  | { type: "key"; value: string }
  | { type: "backspace" }
  | { type: "clear" }
  | { type: "province"; value: string }
  | { type: "focus"; field: PlateField };

export interface KeypadState {
  plate: PlateDraft;
  field: PlateField;
}

export function keypadReducer(state: KeypadState, action: KeypadAction): KeypadState {
  const { plate, field } = state;
  switch (action.type) {
    case "focus":
      return { ...state, field: action.field };
    case "clear":
      return { plate: EMPTY_PLATE, field: "category" };
    case "province":
      return { plate: { ...plate, province: action.value }, field: "province" };
    case "backspace": {
      if (field === "number") {
        if (plate.number) return { ...state, plate: { ...plate, number: [...plate.number].slice(0, -1).join("") } };
        // An empty number steps back into the category, as the plate reads.
        return { plate: { ...plate, category: [...plate.category].slice(0, -1).join("") }, field: "category" };
      }
      if (field === "category") {
        return { ...state, plate: { ...plate, category: [...plate.category].slice(0, -1).join("") } };
      }
      return { ...state, plate: { ...plate, province: "" } };
    }
    case "key": {
      const value = normaliseChars(action.value);
      if (!value) return state;
      if (field === "category") {
        if ([...plate.category].length >= CATEGORY_MAX) {
          // A full category: a digit is the start of the number.
          return /\d/.test(value) ? keypadReducer({ plate, field: "number" }, action) : state;
        }
        return { ...state, plate: { ...plate, category: plate.category + value } };
      }
      if (field === "number") {
        if (!/^\d$/.test(value)) {
          // A letter while on the number belongs to the category (the guard reads left to right).
          return keypadReducer({ plate, field: "category" }, action);
        }
        if (plate.number.length >= NUMBER_MAX) return state;
        return { ...state, plate: { ...plate, number: plate.number + value } };
      }
      return state;
    }
  }
}

export type PlateProblem = "categoryInvalid" | "numberInvalid" | "provinceMissing";

/**
 * Field problems of a plate the guard typed. An empty plate is fine (walk-in, motorbike without a readable plate):
 * the API takes a visit without one. A started plate must be complete.
 */
export function plateProblems(input: PlateDraft): Partial<Record<PlateField, PlateProblem>> {
  const plate = normalisePlate(input);
  if (!plate.category && !plate.number && !plate.province) return {};
  const problems: Partial<Record<PlateField, PlateProblem>> = {};
  const chars = [...plate.category];
  if (
    chars.length < 1 ||
    chars.length > CATEGORY_MAX ||
    !chars.some(isConsonant) ||
    !/^[0-9ก-ฮ]+$/.test(plate.category)
  ) {
    problems.category = "categoryInvalid";
  }
  if (!/^\d{1,4}$/.test(plate.number)) problems.number = "numberInvalid";
  if (!plate.province) problems.province = "provinceMissing";
  return problems;
}

export function isPlateEmpty(plate: PlateDraft): boolean {
  return !plate.category && !plate.number && !plate.province;
}

/** `3กท 8812` — how a plate is read aloud and shown in rows (province apart). */
export function formatPlate(plate: { category: string; number: string } | null | undefined): string {
  if (!plate) return "";
  return `${plate.category} ${plate.number}`.trim();
}
