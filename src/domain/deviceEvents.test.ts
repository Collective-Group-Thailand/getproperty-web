import { describe, expect, it } from "vitest";

import en from "@/i18n/messages/en/common/glossary.json";
import th from "@/i18n/messages/th/common/glossary.json";

import { DEVICE_EVENT_TYPES, deviceEventLabelKey, deviceEventTone } from "./deviceEvents";

describe("device event labels", () => {
  it("labels every type the API records in Thai and English", () => {
    for (const type of DEVICE_EVENT_TYPES) {
      expect((th.deviceEvent as Record<string, string>)[type], `th ${type}`).toBeTruthy();
      expect((en.deviceEvent as Record<string, string>)[type], `en ${type}`).toBeTruthy();
    }
    expect(Object.keys(th.deviceEvent).sort()).toEqual([...DEVICE_EVENT_TYPES].sort());
  });

  it("names meter_status_changed (T-13, D-241)", () => {
    expect(deviceEventLabelKey("meter_status_changed")).toBe("glossary.deviceEvent.meter_status_changed");
    expect(th.deviceEvent.meter_status_changed).toBe("มิเตอร์เปลี่ยนสถานะ");
    expect(en.deviceEvent.meter_status_changed).toBe("Meter status changed");
  });

  it("shows an unknown type as its code and tones rows by severity", () => {
    expect(deviceEventLabelKey("something_new")).toBeNull();
    expect(deviceEventTone("critical")).toBe("danger");
    expect(deviceEventTone("warning")).toBe("warning");
    expect(deviceEventTone("info")).toBe("default");
  });
});
