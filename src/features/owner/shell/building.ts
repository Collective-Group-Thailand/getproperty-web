/**
 * The building the owner console is focused on (top-bar switcher). A view preference, not identity:
 * a JS-readable, host-only cookie so the server renders the same focus; the API still scopes every
 * call by the tenant and checks the building id itself. Absent or unknown = all buildings.
 */
export const BUILDING_COOKIE = "gp_building";

export function writeBuildingCookie(buildingId: string | null): void {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = buildingId
    ? `${BUILDING_COOKIE}=${buildingId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${secure}`
    : `${BUILDING_COOKIE}=; path=/; max-age=0; samesite=lax${secure}`;
}
