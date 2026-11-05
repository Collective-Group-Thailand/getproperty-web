/**
 * Provinces as printed on Thai plates (77, Thai alphabetical order). The API takes the province as text (1–60
 * characters, "from the web list"), so this list is the tablet's vocabulary; the plate is Thai in either UI language.
 *
 * The picker shows the provinces this tablet used most recently first (J-DESIGN §4): most cars at an estate gate carry
 * one or two provinces. Recent ones are kept in `localStorage` — plain words, no personal data.
 */
export const PROVINCES = [
  "กรุงเทพมหานคร",
  "กระบี่",
  "กาญจนบุรี",
  "กาฬสินธุ์",
  "กำแพงเพชร",
  "ขอนแก่น",
  "จันทบุรี",
  "ฉะเชิงเทรา",
  "ชลบุรี",
  "ชัยนาท",
  "ชัยภูมิ",
  "ชุมพร",
  "เชียงราย",
  "เชียงใหม่",
  "ตรัง",
  "ตราด",
  "ตาก",
  "นครนายก",
  "นครปฐม",
  "นครพนม",
  "นครราชสีมา",
  "นครศรีธรรมราช",
  "นครสวรรค์",
  "นนทบุรี",
  "นราธิวาส",
  "น่าน",
  "บึงกาฬ",
  "บุรีรัมย์",
  "ปทุมธานี",
  "ประจวบคีรีขันธ์",
  "ปราจีนบุรี",
  "ปัตตานี",
  "พระนครศรีอยุธยา",
  "พะเยา",
  "พังงา",
  "พัทลุง",
  "พิจิตร",
  "พิษณุโลก",
  "เพชรบุรี",
  "เพชรบูรณ์",
  "แพร่",
  "ภูเก็ต",
  "มหาสารคาม",
  "มุกดาหาร",
  "แม่ฮ่องสอน",
  "ยโสธร",
  "ยะลา",
  "ร้อยเอ็ด",
  "ระนอง",
  "ระยอง",
  "ราชบุรี",
  "ลพบุรี",
  "ลำปาง",
  "ลำพูน",
  "เลย",
  "ศรีสะเกษ",
  "สกลนคร",
  "สงขลา",
  "สตูล",
  "สมุทรปราการ",
  "สมุทรสงคราม",
  "สมุทรสาคร",
  "สระแก้ว",
  "สระบุรี",
  "สิงห์บุรี",
  "สุโขทัย",
  "สุพรรณบุรี",
  "สุราษฎร์ธานี",
  "สุรินทร์",
  "หนองคาย",
  "หนองบัวลำภู",
  "อ่างทอง",
  "อำนาจเจริญ",
  "อุดรธานี",
  "อุตรดิตถ์",
  "อุทัยธานี",
  "อุบลราชธานี",
] as const;

export const RECENT_PROVINCES_KEY = "gp.gate.recentProvinces";
export const RECENT_PROVINCES_MAX = 6;

/** The recent list after using `province`: it moves to the front, the list stays short and known. */
export function rememberProvince(recent: readonly string[], province: string): string[] {
  if (!(PROVINCES as readonly string[]).includes(province)) return [...recent];
  return [province, ...recent.filter((value) => value !== province)].slice(0, RECENT_PROVINCES_MAX);
}

/** Recent provinces first, then the rest in plate order; `query` narrows both (contains, ignoring spaces). */
export function orderedProvinces(recent: readonly string[], query = ""): { recent: string[]; rest: string[] } {
  const q = query.replace(/\s+/g, "");
  const match = (value: string) => !q || value.includes(q);
  const known = recent.filter((value) => (PROVINCES as readonly string[]).includes(value));
  return {
    recent: known.filter(match),
    rest: PROVINCES.filter((value) => !known.includes(value) && match(value)),
  };
}

export function readRecentProvinces(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage): string[] {
  try {
    const parsed = JSON.parse(storage?.getItem(RECENT_PROVINCES_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function writeRecentProvinces(
  recent: readonly string[],
  storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage,
): void {
  try {
    storage?.setItem(RECENT_PROVINCES_KEY, JSON.stringify(recent));
  } catch {
    // private mode / full storage: the list is a convenience only
  }
}
