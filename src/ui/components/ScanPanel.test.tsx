import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { barcodeDetectorClass, ScanPanel, scanUntilFound, supportedFormats } from "./ScanPanel";

const labels = {
  viewfinder: "Scanner",
  aim: "Aim",
  manualLabel: "Serial number",
  manualSubmit: "Use this serial",
  cancel: "Cancel",
  starting: "Starting",
  unsupported: "Type the serial",
};

describe("scanner helpers", () => {
  it("finds the platform detector only when there is one", () => {
    expect(barcodeDetectorClass({})).toBeNull();
    class Detector {}
    expect(barcodeDetectorClass({ BarcodeDetector: Detector })).toBe(Detector);
  });

  it("keeps the wanted formats the detector supports", async () => {
    const Detector = Object.assign(function () {}, {
      getSupportedFormats: async () => ["qr_code", "ean_13"],
    }) as never;
    expect(await supportedFormats(Detector, ["qr_code", "code_128"])).toEqual(["qr_code"]);
  });

  it("polls until a non-empty code is read, skipping failed frames", async () => {
    const detect = vi
      .fn()
      .mockRejectedValueOnce(new Error("not ready"))
      .mockResolvedValueOnce([{ rawValue: "  " }])
      .mockResolvedValueOnce([{ rawValue: " GP-GW-000123 " }]);
    expect(await scanUntilFound(detect, new AbortController().signal, 1)).toBe("GP-GW-000123");
    expect(detect).toHaveBeenCalledTimes(3);
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await scanUntilFound(async () => [], controller.signal, 1)).toBeNull();
  });
});

describe("<ScanPanel> without a detector", () => {
  it("falls back to the typed serial", async () => {
    const onValue = vi.fn();
    render(<ScanPanel labels={labels} onValue={onValue} onCancel={() => undefined} />);
    expect(await screen.findByText("Type the serial")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Serial number"), { target: { value: " GP-GW-1 " } });
    fireEvent.click(screen.getByRole("button", { name: "Use this serial" }));
    expect(onValue).toHaveBeenCalledWith("GP-GW-1");
  });
});
