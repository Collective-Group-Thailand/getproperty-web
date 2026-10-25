"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ProblemNotice } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { IconChevronLeft } from "@/ui/icons/glyphs/chevron-left";
import { IconChevronRight } from "@/ui/icons/glyphs/chevron-right";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconUpload } from "@/ui/icons/glyphs/upload";

import { uploadOwnerFile } from "../shared/upload";

type Photo = Schemas["ListingPhotoDto"];

/** The scan job cleans a photo a moment after upload; attaching before that answers `listing.photo_invalid`. */
async function attachWhenClean(listingId: string, documentId: string, attempts = 20, delayMs = 750) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await unwrap(
        browserApi().POST("/v1/owner/listings/{listingId}/photos", {
          params: { path: { listingId } },
          body: { documentId },
        }),
      );
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== "listing.photo_invalid" || attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Photos of a listing (F6.2, D-252): add several at once (each is uploaded, cleaned of its location data by the API
 * and attached), put them in order — the first is the cover — caption them and remove the ones that do not help.
 * Order and captions are saved together.
 */
export function ListingPhotos({ listingId, unitId, photos }: { listingId: string; unitId: string; photos: Photo[] }) {
  const t = useTranslations("owner.listings.photos");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [order, setOrder] = useState(photos);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const changed =
    order.length === photos.length &&
    order.some((p, i) => p.id !== photos[i]?.id || (p.caption ?? "") !== (photos[i]?.caption ?? ""));

  // A refresh from the server (after upload or removal) replaces the local order.
  const signature = photos.map((p) => p.id).join();
  const [seen, setSeen] = useState(signature);
  if (seen !== signature) {
    setSeen(signature);
    setOrder(photos);
  }

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setSaved(false);
    const list = [...files];
    setProgress({ done: 0, total: list.length });
    for (const [index, file] of list.entries()) {
      try {
        const doc = await uploadOwnerFile(file, { kind: "listing_photo", scopeType: "unit", scopeId: unitId });
        await attachWhenClean(listingId, doc.id);
      } catch (failure) {
        setError(failure);
        break;
      }
      setProgress({ done: index + 1, total: list.length });
    }
    setProgress(null);
    if (input.current) input.current.value = "";
    router.refresh();
  };

  const move = (index: number, by: -1 | 1) => {
    const next = [...order];
    const [photo] = next.splice(index, 1);
    next.splice(index + by, 0, photo!);
    setOrder(next);
    setSaved(false);
  };

  const saveOrder = async () => {
    setSaving(true);
    setError(null);
    try {
      await unwrap(
        browserApi().PUT("/v1/owner/listings/{listingId}/photos", {
          params: { path: { listingId } },
          body: { photos: order.map((p) => ({ id: p.id, caption: p.caption?.trim() || null })) },
        }),
      );
      setSaved(true);
      router.refresh();
    } catch (failure) {
      setError(failure);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (photoId: string) => {
    setError(null);
    try {
      await unwrap(
        browserApi().DELETE("/v1/owner/listings/{listingId}/photos/{photoId}", {
          params: { path: { listingId, photoId } },
        }),
      );
      router.refresh();
    } catch (failure) {
      setError(failure);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="listing-photos">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          id={`photos-${listingId}`}
          onChange={(event) => void upload(event.target.files)}
          data-testid="listing-photo-input"
          aria-label={t("add")}
          tabIndex={-1}
        />
        <Button
          variant="secondary"
          iconStart={IconUpload}
          loading={progress !== null}
          onClick={() => input.current?.click()}
          data-testid="listing-photo-add"
        >
          {progress ? t("uploading", progress) : t("add")}
        </Button>
        <span className="text-muted text-sm" data-testid="listing-photo-count">
          {t("count", { count: order.length })}
        </span>
        {changed ? (
          <Button onClick={() => void saveOrder()} loading={saving} data-testid="listing-photo-save">
            {t("saveOrder")}
          </Button>
        ) : saved ? (
          <span className="text-muted text-sm" role="status">
            {t("orderSaved")}
          </span>
        ) : null}
      </div>

      {order.length === 0 ? (
        <p className="text-muted border-border rounded-card border border-dashed p-6 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <ol className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 lg:grid-cols-4">
          {order.map((photo, index) => (
            <li key={photo.id} className="flex flex-col gap-2" data-testid="listing-photo">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed object-storage preview */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? ""}
                  className="rounded-card bg-bg-subtle aspect-[4/3] w-full object-cover"
                />
                {index === 0 ? (
                  <span className="absolute start-2 top-2">
                    <Badge tone="primary" size="sm">
                      {t("cover")}
                    </Badge>
                  </span>
                ) : null}
              </div>
              <Input
                inputSize="sm"
                value={order[index]!.caption ?? ""}
                placeholder={t("caption")}
                aria-label={t("caption")}
                maxLength={200}
                onChange={(event) => {
                  const next = [...order];
                  next[index] = { ...photo, caption: event.target.value };
                  setOrder(next);
                  setSaved(false);
                }}
              />
              <div className="flex items-center justify-between">
                <span className="flex gap-1">
                  <IconButton
                    icon={IconChevronLeft}
                    label={t("moveLeft")}
                    size="sm"
                    variant="ghost"
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <IconButton
                    icon={IconChevronRight}
                    label={t("moveRight")}
                    size="sm"
                    variant="ghost"
                    disabled={index === order.length - 1}
                    onClick={() => move(index, 1)}
                  />
                </span>
                <IconButton
                  icon={IconDelete}
                  label={t("remove")}
                  size="sm"
                  variant="ghost"
                  onClick={() => void remove(photo.id)}
                  data-testid="listing-photo-remove"
                />
              </div>
            </li>
          ))}
        </ol>
      )}
      <ProblemNotice error={error} />
    </div>
  );
}
