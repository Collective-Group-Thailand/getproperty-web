"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconPackageCheck } from "@/ui/icons/glyphs/package-check";

import { PhotoUploadField, usePhotoUploads } from "../shared/PhotoUploads";
import { Callout } from "@/ui/components/Callout";

/** Receives a parcel at the desk (D-212): photo → unit → the API notifies the recipient or the unit's residents. */
export function ReceiveParcel({ buildingId, units }: { buildingId: string; units: { id: string; unitNo: string }[] }) {
  const t = useTranslations("owner.community.parcels.receive");
  const photo = usePhotoUploads({ kind: "service_photo", scopeType: "building", scopeId: buildingId });
  return (
    <FormDialog
      label={t("action")}
      icon={IconAdd}
      variant="primary"
      testId="parcel-receive"
      title={t("title")}
      description={t("body")}
      submitLabel={t("submit")}
      successMessage={t("done")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/parcels", {
            body: {
              unitId: text(data, "unitId") ?? "",
              photoDocumentId: photo.ids[0] ?? "",
              carrier: text(data, "carrier") ?? null,
              trackingNo: text(data, "trackingNo") ?? null,
              notes: text(data, "notes") ?? null,
            },
          }),
        )
      }
      onDone={() => photo.reset()}
    >
      {(errors) => (
        <>
          <PhotoUploadField uploads={photo} label={t("photo")} multiple={false} testId="parcel-photo" />
          {errors.photoDocumentId ? <Callout tone="danger">{errors.photoDocumentId}</Callout> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("unit")} required error={errors.unitId}>
              <NativeSelect
                name="unitId"
                required
                placeholder={t("chooseUnit")}
                options={units.map((unit) => ({ value: unit.id, label: unit.unitNo }))}
                data-testid="parcel-unit"
              />
            </Field>
            <Field label={t("carrier")} error={errors.carrier}>
              <Input name="carrier" data-testid="parcel-carrier" />
            </Field>
            <Field label={t("trackingNo")} error={errors.trackingNo}>
              <Input name="trackingNo" className="font-mono" />
            </Field>
          </div>
          <Field label={t("notes")} error={errors.notes}>
            <Textarea name="notes" rows={2} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/**
 * Hands a waiting parcel over: with the 6-digit PIN the resident shows from their app, or — when they
 * cannot — as a staff-confirmed hand-over (recorded as such). Return to the sender needs a reason.
 */
export function ParcelHandOver({ parcel }: { parcel: Pick<Schemas["ParcelDto"], "id" | "unitNo" | "trackingNo"> }) {
  const t = useTranslations("owner.community.parcels");
  const [pin, setPin] = useState("");
  const [staff, setStaff] = useState(false);
  const [reason, setReason] = useState("");
  const path = { parcelId: parcel.id };
  return (
    <div className="flex flex-wrap justify-end gap-1">
      <ConfirmAction
        label={t("pickUp")}
        icon={IconPackageCheck}
        size="sm"
        testId="parcel-pick-up"
        title={t("pickUpTitle", { unit: parcel.unitNo })}
        description={t("pickUpBody")}
        confirmLabel={t("pickUp")}
        ready={staff || /^\d{6}$/.test(pin)}
        successMessage={t("pickedUp")}
        onConfirm={() =>
          unwrap(
            browserApi().POST("/v1/owner/parcels/{parcelId}/actions/pick-up", {
              params: { path },
              body: staff ? { staffConfirmed: true } : { pin },
            }),
          )
        }
      >
        <Field label={t("pin")} hint={t("pinHint")}>
          <Input
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            className="font-mono text-lg tracking-widest"
            value={pin}
            disabled={staff}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
            data-testid="parcel-pin"
          />
        </Field>
        <Checkbox label={t("staffConfirmed")} checked={staff} onCheckedChange={(on) => setStaff(on === true)} />
      </ConfirmAction>
      <ConfirmAction
        label={t("return")}
        icon={IconBack}
        size="sm"
        variant="ghost"
        testId="parcel-return"
        title={t("returnTitle", { unit: parcel.unitNo })}
        description={t("returnBody")}
        confirmLabel={t("return")}
        ready={reason.trim().length > 0}
        successMessage={t("returned")}
        onConfirm={() =>
          unwrap(
            browserApi().POST("/v1/owner/parcels/{parcelId}/actions/return", {
              params: { path },
              body: { reason: reason.trim() },
            }),
          )
        }
      >
        <Field label={t("reason")} required>
          <Textarea
            rows={2}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            data-testid="parcel-return-reason"
          />
        </Field>
      </ConfirmAction>
    </div>
  );
}
