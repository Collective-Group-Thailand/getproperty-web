/**
 * Device event types (`DeviceEventDto.type`, a string in the contract) the API records — getproperty-api
 * `smart.device_event_type` (B3.1, D-034; `meter_status_changed` since T-13 / D-241: the per-meter change a
 * gateway heartbeat reports, `data { meterId, from, to, lastReadAt }`, severity `warning` / `info`).
 *
 * The contract types `type` as a free string, so the list is presentation only: a type it does not name is
 * shown as its code, never hidden. Labels live in `glossary.deviceEvent.<type>` (th / en).
 */
export const DEVICE_EVENT_TYPES = [
  "meter_offline",
  "meter_status_changed",
  "pulse_overflow",
  "config_applied",
  "config_rejected",
  "config_drift",
  "ota_started",
  "ota_applied",
  "ota_rolled_back",
  "ota_failed",
  "tamper",
  "power_loss",
  "restart",
  "seq_gap",
  "invalid_payload",
  "batch_too_large",
  "unbound_meter",
  "battery_low",
  "gateway_online",
  "gateway_offline",
] as const;

export type DeviceEventType = (typeof DEVICE_EVENT_TYPES)[number];

const KNOWN = new Set<string>(DEVICE_EVENT_TYPES);

export function isKnownDeviceEvent(type: string): type is DeviceEventType {
  return KNOWN.has(type);
}

/** The message key of a device event type's label, or `null` for a type this app does not know yet. */
export function deviceEventLabelKey(type: string): `glossary.deviceEvent.${DeviceEventType}` | null {
  return isKnownDeviceEvent(type) ? `glossary.deviceEvent.${type}` : null;
}

/** Row tone of a device event by its severity (`info` | `warning` | `critical`; `error` from older rows). */
export function deviceEventTone(severity: string): "default" | "warning" | "danger" {
  if (severity === "critical" || severity === "error") return "danger";
  if (severity === "warning") return "warning";
  return "default";
}
