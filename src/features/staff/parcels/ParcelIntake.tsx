"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { uploadFile } from "@/lib/pwa/queue";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconParcel } from "@/ui/icons/glyphs/parcel";
import { lazyWarm } from "@/ui/lib/lazy";

import { problemText } from "../shared/problem";
import type { StaffUnitChoice } from "./server";

const PhotoCapture = lazyWarm(() => import("../work/PhotoCapture").then((module) => module.PhotoCapture));

/**
 * Parcel intake at the desk (F4 4.4, D-212): photo of the label → unit → carrier / tracking (optional) →
 * `POST /v1/staff/parcels`; the API notifies the recipient (or the unit's residents) with a pick-up PIN in
 * their app. The photo is uploaded first (`service_photo`).
 */
export function ParcelIntake({ buildingId, units }: { buildingId: string; units: StaffUnitChoice[] }) {
  const t = useTranslations("staff.parcels.intake");
  const router = useRouter();
  const [camera, setCamera] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [unitId, setUnitId] = useState("");
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const preview = photo ? URL.createObjectURL(photo) : null;

  const submit = async () => {
    if (!photo || !unitId) return;
    setBusy(true);
    setError(null);
    try {
      const photoDocumentId = await uploadFile({
        blob: photo,
        fileName: photo.name,
        kind: "service_photo",
        scopeType: "building",
        scopeId: buildingId,
        bodyField: "photoDocumentId",
      });
      const parcel = await unwrap(
        browserApi().POST("/v1/staff/parcels", {
          body: { photoDocumentId, unitId, carrier: carrier.trim() || null, trackingNo: trackingNo.trim() || null },
        }),
      );
      setSaved(parcel.unitNo);
      setPhoto(null);
      setUnitId("");
      setCarrier("");
      setTrackingNo("");
      router.refresh();
    } catch (failure) {
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="intake" className="flex flex-col gap-3" data-testid="parcel-intake">
      <h2 id="intake" className="text-lg font-semibold">
        {t("title")}
      </h2>
      {saved ? (
        <Callout tone="success">
          <span data-testid="intake-saved">{t("saved", { unit: saved })}</span>
        </Callout>
      ) : null}
      {camera ? (
        <Suspense fallback={null}>
          <PhotoCapture
            label={t("photo")}
            fileBaseName="parcel"
            onPhotos={(files) => {
              setPhoto(files[0] ?? null);
              setSaved(null);
              setCamera(false);
            }}
            onClose={() => setCamera(false)}
          />
        </Suspense>
      ) : (
        <Button
          variant={photo ? "secondary" : "primary"}
          size="xl"
          block
          iconStart={IconCamera}
          onClick={() => setCamera(true)}
          data-testid="intake-photo"
        >
          {photo ? t("retake") : t("photo")}
        </Button>
      )}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local preview of the photo just taken
        <img
          src={preview}
          alt={t("previewAlt")}
          className="rounded-card max-h-48 w-auto self-start"
          data-testid="intake-preview"
        />
      ) : null}
      <Field label={t("unit")} required>
        <NativeSelect
          inputSize="lg"
          value={unitId}
          onChange={(event) => setUnitId(event.target.value)}
          placeholder={t("chooseUnit")}
          options={units.map((unit) => ({
            value: unit.id,
            label: unit.floorName ? `${unit.unitNo} · ${unit.floorName}` : unit.unitNo,
          }))}
          data-testid="intake-unit"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("carrier")}>
          <Input
            inputSize="lg"
            value={carrier}
            onChange={(event) => setCarrier(event.target.value)}
            data-testid="intake-carrier"
          />
        </Field>
        <Field label={t("trackingNo")}>
          <Input inputSize="lg" value={trackingNo} onChange={(event) => setTrackingNo(event.target.value)} />
        </Field>
      </div>
      <Button
        size="xl"
        block
        iconStart={IconParcel}
        loading={busy}
        disabled={!photo || !unitId}
        onClick={() => void submit()}
        data-testid="intake-submit"
      >
        {t("submit")}
      </Button>
      {error ? (
        <Callout tone="danger">
          <span role="alert" data-testid="intake-problem">
            {problemText(error, t("offline"))}
          </span>
        </Callout>
      ) : null}
    </section>
  );
}
