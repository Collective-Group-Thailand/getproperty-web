import { describe, expect, it } from "vitest";

import { validateMeterDevice, validateWiring, wiringInput, type WiringDraft } from "./wiring";

const modbus: WiringDraft = {
  gatewayDeviceId: "g1",
  busType: "modbus_rtu",
  busId: "bus1",
  address: "12",
  pin: "",
  litresPerPulse: "",
};

describe("binding wizard validation (F4 4.3)", () => {
  it("accepts a Modbus address 1–247 on a named bus and builds the contract's wiring", () => {
    expect(validateWiring(modbus)).toEqual([]);
    expect(wiringInput(modbus)).toEqual({
      busId: "bus1",
      busType: "modbus_rtu",
      address: 12,
      registerMap: "driver_default",
    });
  });

  it("refuses an address outside 1–247, a missing gateway and a bad bus id", () => {
    expect(validateWiring({ ...modbus, address: "0" })).toEqual(["address"]);
    expect(validateWiring({ ...modbus, address: "248" })).toEqual(["address"]);
    expect(validateWiring({ ...modbus, address: "" })).toEqual(["address"]);
    expect(validateWiring({ ...modbus, gatewayDeviceId: "", busId: "bus 1" })).toEqual(["gateway", "busId"]);
  });

  it("GPIO needs a pin 0–64 and an optional pulse weight 1–1000", () => {
    const gpio: WiringDraft = { ...modbus, busType: "gpio", address: "", pin: "4", litresPerPulse: "10" };
    expect(validateWiring(gpio)).toEqual([]);
    expect(wiringInput(gpio)).toEqual({
      busId: "bus1",
      busType: "gpio",
      pin: 4,
      litresPerPulse: 10,
      registerMap: "driver_default",
    });
    expect(validateWiring({ ...gpio, pin: "65" })).toEqual(["pin"]);
    expect(validateWiring({ ...gpio, litresPerPulse: "0" })).toEqual(["litresPerPulse"]);
  });

  it("the meter device needs serial, model, vendor and an edge driver key", () => {
    expect(
      validateMeterDevice({ serial: "SDM120-1", model: "SDM120", vendor: "Eastron", driver: "eastron_sdm120" }),
    ).toEqual([]);
    expect(validateMeterDevice({ serial: " ", model: "", vendor: "x", driver: "SDM 120" })).toEqual([
      "serial",
      "model",
      "driver",
    ]);
  });
});
