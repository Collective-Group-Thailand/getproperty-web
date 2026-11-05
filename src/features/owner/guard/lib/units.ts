import type { GuardUnit } from "./api";

/**
 * The houses of the estate on the tablet (JW4): the API answers by house number (`GET /v1/guard/units?q=`, up to 100);
 * the desk keeps the last full list so the guard can still pick a house while offline — numbers, soi and the house
 * rule only (the household note is left out of storage).
 */
export const UNITS_CACHE_KEY = "gp.gate.units";
export const UNITS_PAGE = 100;

/** Matches the house number as typed (spaces ignored, Thai digits accepted) and an optional soi / building. */
export function filterUnits(units: readonly GuardUnit[], query: string, group: string | null): GuardUnit[] {
  const q = query
    .replace(/[๐-๙]/g, (digit) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit)))
    .replace(/\s+/g, "")
    .toLowerCase();
  return units.filter(
    (unit) =>
      (!group || unit.buildingName === group) && (!q || unit.unitNo.replace(/\s+/g, "").toLowerCase().includes(q)),
  );
}

/** Soi / buildings in the order they first appear (the API orders units by building, then number). */
export function groupsOf(units: readonly GuardUnit[]): string[] {
  return [...new Set(units.map((unit) => unit.buildingName).filter(Boolean))];
}

export function readCachedUnits(
  gateId: string,
  storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage,
): GuardUnit[] {
  try {
    const parsed = JSON.parse(storage?.getItem(UNITS_CACHE_KEY) ?? "null") as {
      gateId?: string;
      units?: GuardUnit[];
    } | null;
    return parsed?.gateId === gateId && Array.isArray(parsed.units) ? parsed.units : [];
  } catch {
    return [];
  }
}

export function writeCachedUnits(
  gateId: string,
  units: readonly GuardUnit[],
  storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage,
): void {
  try {
    const slim = units.map((unit) => ({ ...unit, policy: { ...unit.policy, householdNote: null } }));
    storage?.setItem(UNITS_CACHE_KEY, JSON.stringify({ gateId, units: slim }));
  } catch {
    // storage full / private mode: offline search simply has nothing to show
  }
}
