import type { Schemas } from "./types";

/*
 * CONTRACT-REQUEST — response shapes of endpoints this app needs that the pinned contract does not
 * publish yet (docs/contract-requests.md). Built from generated types wherever the contract already
 * has the parts; each is deleted for the generated type the day the contract adopts the endpoint.
 * The mock API implements them (mocks/handlers/contract-requests.ts).
 */

/** `GET /v1/staff/buildings` — the buildings of my scope (Staff: `currentTenant.buildingIds`, D-090). */
export interface StaffBuilding {
  id: string;
  code: string;
  name: string;
  floorsCount: number | null;
  unitCount: number;
}

/** The open gateway channel of a meter point, for binding and the per-unit device list (D-033). */
export interface StaffMeterChannel {
  channelId: string;
  gatewayDeviceId: string;
  meterDeviceId: string | null;
  meterDeviceSerial: string | null;
  busId: string;
  busType: Schemas["BusType"];
  address: number | null;
  pin: number | null;
}

/**
 * `GET /v1/staff/buildings/{buildingId}/meters` — the owner's `MeterDto` (meter positions of a building)
 * for the staff surface, plus the floor, the last accepted register and the open channel.
 */
export type StaffMeterPoint = Schemas["MeterDto"] & {
  floorName: string | null;
  lastRegister: string | null;
  channel: StaffMeterChannel | null;
};
