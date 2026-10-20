"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import type { Schemas } from "@/lib/api/types";
import { FileDropzone } from "@/ui/components/FileDropzone";

import { uploadOwnerFile, type UploadTarget } from "./upload";

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Photos uploaded one by one as they are chosen (presign → PUT → complete, `uploadOwnerFile`); the form
 * sends their document ids. Kept until the form succeeds (`reset`).
 */
export function usePhotoUploads(target: UploadTarget) {
  const [photos, setPhotos] = useState<{ id: string; name: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const add = async (files: File[]) => {
    setUploading(true);
    setFailed(false);
    try {
      for (const file of files) {
        const stored: Schemas["FileDto"] = await uploadOwnerFile(file, target);
        setPhotos((current) => [...current, { id: stored.id, name: file.name }]);
      }
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
    }
  };
  return {
    ids: photos.map((photo) => photo.id),
    photos,
    uploading,
    failed,
    add,
    reset: () => {
      setPhotos([]);
      setFailed(false);
    },
  };
}

/** The dropzone of `usePhotoUploads` with the names of what was uploaded and the upload state. */
export function PhotoUploadField({
  uploads,
  label,
  multiple = true,
  testId,
}: {
  uploads: ReturnType<typeof usePhotoUploads>;
  label: string;
  multiple?: boolean;
  testId?: string;
}) {
  const t = useTranslations("owner.common.photos");
  return (
    <div className="flex flex-col gap-2">
      <FileDropzone
        label={label}
        hint={t("hint")}
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        maxBytes={MAX_BYTES}
        tooLargeText={t("tooLarge")}
        chooseText={t("choose")}
        disabled={uploads.uploading}
        onFiles={(files) => void uploads.add(files)}
        data-testid={testId}
      />
      <p className="text-muted text-sm" role="status" data-testid={testId ? `${testId}-state` : undefined}>
        {uploads.uploading
          ? t("uploading")
          : uploads.failed
            ? t("failed")
            : uploads.photos.length
              ? t("uploaded", { count: uploads.photos.length, names: uploads.photos.map((p) => p.name).join(", ") })
              : null}
      </p>
    </div>
  );
}
