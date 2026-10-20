import type { Schemas } from "@/lib/api/types";

/** Device kinds of the contract (`DeviceKind`), in the order the fleet lists them. */
export const DEVICE_KINDS: Schemas["DeviceKind"][] = [
  "gateway",
  "electric_meter",
  "water_meter",
  "lock",
  "breaker",
  "sensor",
  "door_controller",
  "camera",
];

/** OTA rings, first to last (D-183). */
export const RINGS: Schemas["OtaRing"][] = ["canary", "pilot", "all"];

/** "อาคาร A · หอพักตัวอย่าง" — a building with its property, as the assign dialog and the device page show it. */
export function buildingLabel(building: Pick<Schemas["AdminBuildingDto"], "name" | "propertyName">): string {
  return building.propertyName ? `${building.name} · ${building.propertyName}` : building.name;
}
