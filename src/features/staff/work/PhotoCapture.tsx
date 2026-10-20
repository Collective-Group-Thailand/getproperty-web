"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/ui/components/Button";
import { CameraCapture } from "@/ui/components/CameraCapture";
import { IconClose } from "@/ui/icons/glyphs/close";

import { useCameraLabels } from "../shared/labels";

/** The camera for a work order's before / after photos (multi-shot, compressed on the device). */
export function PhotoCapture({
  label,
  fileBaseName,
  onPhotos,
  onClose,
}: {
  label: string;
  fileBaseName: string;
  onPhotos: (files: File[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations("staff.work.photos");
  const labels = useCameraLabels();
  return (
    <div className="flex flex-col gap-3" data-testid="work-camera">
      <CameraCapture
        multiple
        guide="document"
        label={label}
        labels={labels}
        fileBaseName={fileBaseName}
        onCapture={onPhotos}
      />
      <Button variant="ghost" size="lg" iconStart={IconClose} onClick={onClose}>
        {t("close")}
      </Button>
    </div>
  );
}
