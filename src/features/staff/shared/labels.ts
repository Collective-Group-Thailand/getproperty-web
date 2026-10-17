"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";

import type { CameraCaptureLabels } from "@/ui/components/CameraCapture";
import type { ScanPanelLabels } from "@/ui/components/ScanPanel";
import type { SignaturePadLabels } from "@/ui/components/SignaturePad";

/** The `src/ui` capture components' copy, from `staff.capture` (they take labels, never strings of their own). */
export function useCameraLabels(): CameraCaptureLabels {
  const t = useTranslations("staff.capture.camera");
  return useMemo(
    () => ({
      viewfinder: t("viewfinder"),
      torchOn: t("torchOn"),
      torchOff: t("torchOff"),
      done: (count: number) => t("done", { count }),
      remove: (index: number) => t("remove", { index }),
      taken: (count: number) => t("taken", { count }),
      chooseFile: t("chooseFile"),
      starting: t("starting"),
      unavailable: t("unavailable"),
    }),
    [t],
  );
}

export function useScanLabels(): ScanPanelLabels {
  const t = useTranslations("staff.capture.scan");
  return useMemo(
    () => ({
      viewfinder: t("viewfinder"),
      aim: t("aim"),
      manualLabel: t("manualLabel"),
      manualSubmit: t("manualSubmit"),
      cancel: t("cancel"),
      starting: t("starting"),
      unsupported: t("unsupported"),
    }),
    [t],
  );
}

export function useSignatureLabels(): SignaturePadLabels {
  const t = useTranslations("staff.capture.signature");
  return useMemo(
    () => ({ placeholder: t("placeholder"), clear: t("clear"), undo: t("undo"), upload: t("upload") }),
    [t],
  );
}

export function useKeypadLabels(): { backspace: string; decimal: string } {
  const t = useTranslations("staff.capture.keypad");
  return useMemo(() => ({ backspace: t("backspace"), decimal: t("decimal") }), [t]);
}
