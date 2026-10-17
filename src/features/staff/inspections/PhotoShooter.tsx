"use client";

import { useTranslations } from "next-intl";

import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { CameraCapture } from "@/ui/components/CameraCapture";
import { IconClose } from "@/ui/icons/glyphs/close";

import { useCameraLabels } from "../shared/labels";
import { PhotoThumb } from "../shared/PhotoThumb";

/**
 * Multi-shot photos of one checklist line (F4 4.2): compressed on the device by `CameraCapture`. On a
 * move-out the line's move-in photo stays beside the camera, so the same angle can be taken again.
 */
export function PhotoShooter({
  label,
  before,
  onPhotos,
  onClose,
}: {
  label: string;
  before: Schemas["InspectionItemDto"] | null;
  onPhotos: (files: File[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations("staff.inspections");
  const labels = useCameraLabels();
  return (
    <div className="mt-3 flex flex-col gap-3" data-testid="photo-shooter">
      {before && before.photoDocumentIds.length > 0 ? (
        <figure className="flex flex-col gap-1">
          <PhotoThumb
            fileId={before.photoDocumentIds[0]!}
            alt={t("moveInPhoto", { item: label, index: 1 })}
            size="lg"
          />
          <figcaption className="text-muted text-sm">{t("sameAngle")}</figcaption>
        </figure>
      ) : null}
      <CameraCapture
        multiple
        guide="document"
        label={t("shoot", { item: label })}
        labels={labels}
        fileBaseName="inspection"
        onCapture={onPhotos}
      />
      <Button variant="ghost" size="lg" iconStart={IconClose} onClick={onClose}>
        {t("closeCamera")}
      </Button>
    </div>
  );
}
