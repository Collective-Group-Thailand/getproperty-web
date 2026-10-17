import type { Schemas } from "@/lib/api/types";

/**
 * Meter drivers of getproperty-edge (D-013: `eastron_sdm120`, `eastron_sdm230` on Modbus RTU,
 * `pulse_counter` on GPIO). The wizard offers the API's catalogue (`GET /v1/staff/meter-drivers`); this
 * list is the fallback when that read fails.
 */
export const KNOWN_DRIVERS = ["eastron_sdm120", "eastron_sdm230", "pulse_counter"] as const;

export interface WiringDraft {
  gatewayDeviceId: string;
  busType: "modbus_rtu" | "gpio";
  busId: string;
  /** Typed digits (validated before use). */
  address: string;
  pin: string;
  litresPerPulse: string;
}

export type WiringError = "busId" | "address" | "pin" | "litresPerPulse" | "gateway";

/** Field problems the installer can fix before sending (the API's own limits: 1–247, 0–64, 1–1000). */
export function validateWiring(draft: WiringDraft): WiringError[] {
  const errors: WiringError[] = [];
  const int = (value: string) => (/^\d{1,4}$/.test(value) ? Number(value) : NaN);
  if (!draft.gatewayDeviceId) errors.push("gateway");
  if (!/^[A-Za-z0-9_-]{1,32}$/.test(draft.busId)) errors.push("busId");
  if (draft.busType === "modbus_rtu") {
    const address = int(draft.address);
    if (!(address >= 1 && address <= 247)) errors.push("address");
  } else {
    const pin = int(draft.pin);
    if (!(pin >= 0 && pin <= 64)) errors.push("pin");
    if (draft.litresPerPulse) {
      const litres = int(draft.litresPerPulse);
      if (!(litres >= 1 && litres <= 1000)) errors.push("litresPerPulse");
    }
  }
  return errors;
}

/** The contract's `WiringInputDto` from a valid draft. */
export function wiringInput(draft: WiringDraft): Schemas["WiringInputDto"] {
  return draft.busType === "modbus_rtu"
    ? { busId: draft.busId, busType: "modbus_rtu", address: Number(draft.address), registerMap: "driver_default" }
    : {
        busId: draft.busId,
        busType: "gpio",
        pin: Number(draft.pin),
        litresPerPulse: draft.litresPerPulse ? Number(draft.litresPerPulse) : null,
        registerMap: "driver_default",
      };
}

export interface MeterDeviceDraft {
  serial: string;
  model: string;
  vendor: string;
  driver: string;
}

export function validateMeterDevice(draft: MeterDeviceDraft): (keyof MeterDeviceDraft)[] {
  const errors: (keyof MeterDeviceDraft)[] = [];
  if (!draft.serial.trim()) errors.push("serial");
  if (!draft.model.trim()) errors.push("model");
  if (!draft.vendor.trim()) errors.push("vendor");
  if (!/^[a-z][a-z0-9_]{1,63}$/.test(draft.driver)) errors.push("driver");
  return errors;
}
