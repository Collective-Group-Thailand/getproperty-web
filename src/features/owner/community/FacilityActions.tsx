"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, integer, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconFlag } from "@/ui/icons/glyphs/flag";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

const KINDS: Schemas["FacilityKind"][] = ["meeting_room", "fitness", "pool", "bbq", "parking_visitor", "other"];

function FacilityFields({ facility, errors }: { facility?: Schemas["FacilityDto"]; errors: Record<string, string> }) {
  const t = useTranslations("owner.community.facilities");
  const policy = facility?.bookingPolicy;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("name")} required error={errors.name}>
          <Input name="name" required defaultValue={facility?.name} data-testid="facility-name" />
        </Field>
        <Field label={t("kind")} error={errors.kind}>
          <NativeSelect
            name="kind"
            defaultValue={facility?.kind ?? "meeting_room"}
            options={KINDS.map((value) => ({ value, label: t(`kinds.${value}`) }))}
          />
        </Field>
        <Field label={t("capacity")} error={errors.capacity}>
          <Input name="capacity" type="number" min={1} defaultValue={facility?.capacity ?? undefined} />
        </Field>
      </div>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-medium">{t("policy")}</legend>
        <Field label={t("slotMinutes")} error={errors["bookingPolicy.slotMinutes"]}>
          <Input
            name="slotMinutes"
            type="number"
            min={15}
            max={240}
            defaultValue={policy?.slotMinutes ?? 60}
            data-testid="facility-slot"
          />
        </Field>
        <Field label={t("openFrom")} error={errors["bookingPolicy.openFrom"]}>
          <Input name="openFrom" type="time" defaultValue={policy?.openFrom ?? "08:00"} />
        </Field>
        <Field label={t("openTo")} error={errors["bookingPolicy.openTo"]}>
          <Input name="openTo" type="time" defaultValue={policy?.openTo ?? "22:00"} />
        </Field>
        <Field label={t("maxDuration")} error={errors["bookingPolicy.maxDurationMinutes"]}>
          <Input name="maxDurationMinutes" type="number" min={15} defaultValue={policy?.maxDurationMinutes ?? 120} />
        </Field>
        <Field label={t("maxAdvance")} error={errors["bookingPolicy.maxAdvanceDays"]}>
          <Input name="maxAdvanceDays" type="number" min={0} defaultValue={policy?.maxAdvanceDays ?? 14} />
        </Field>
        <Field label={t("perWeek")} error={errors["bookingPolicy.maxPerUnitPerWeek"]}>
          <Input name="maxPerUnitPerWeek" type="number" min={1} defaultValue={policy?.maxPerUnitPerWeek ?? 2} />
        </Field>
      </fieldset>
      <Checkbox
        name="requiresApproval"
        value="true"
        defaultChecked={policy?.requiresApproval ?? false}
        label={t("requiresApproval")}
      />
      <Checkbox name="isActive" value="true" defaultChecked={facility?.isActive ?? true} label={t("active")} />
    </>
  );
}

function policyOf(data: FormData): Schemas["BookingPolicyDto"] {
  return {
    slotMinutes: integer(data, "slotMinutes"),
    openFrom: text(data, "openFrom"),
    openTo: text(data, "openTo"),
    maxDurationMinutes: integer(data, "maxDurationMinutes"),
    maxAdvanceDays: integer(data, "maxAdvanceDays"),
    maxPerUnitPerWeek: integer(data, "maxPerUnitPerWeek"),
    requiresApproval: data.get("requiresApproval") === "true",
  };
}

/** A facility of the building with its booking policy (D-212 defaults: 60-min slots, 08:00–22:00, ≤ 120 min…). */
export function NewFacility({ buildingId }: { buildingId: string }) {
  const t = useTranslations("owner.community.facilities");
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      variant="primary"
      testId="facility-add"
      title={t("addTitle")}
      description={t("addBody")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/facilities", {
            body: {
              buildingId,
              name: text(data, "name"),
              kind: text(data, "kind") as Schemas["FacilityKind"],
              capacity: integer(data, "capacity") ?? null,
              isActive: data.get("isActive") === "true",
              bookingPolicy: policyOf(data),
            },
          }),
        )
      }
    >
      {(errors) => <FacilityFields errors={errors} />}
    </FormDialog>
  );
}

export function EditFacility({ facility }: { facility: Schemas["FacilityDto"] }) {
  const t = useTranslations("owner.community.facilities");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      variant="ghost"
      size="sm"
      testId="facility-edit"
      title={t("editTitle", { name: facility.name })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().PATCH("/v1/owner/facilities/{facilityId}", {
            params: { path: { facilityId: facility.id } },
            body: {
              name: text(data, "name"),
              kind: text(data, "kind") as Schemas["FacilityKind"],
              capacity: integer(data, "capacity") ?? null,
              isActive: data.get("isActive") === "true",
              bookingPolicy: policyOf(data),
            },
          }),
        )
      }
    >
      {(errors) => <FacilityFields facility={facility} errors={errors} />}
    </FormDialog>
  );
}

/** A booking's decisions (approve, reject with reason, cancel with reason, no-show after it started). */
export function BookingActions({
  booking,
  started,
}: {
  booking: Pick<Schemas["BookingDto"], "id" | "status" | "unitNo" | "facilityName">;
  started: boolean;
}) {
  const t = useTranslations("owner.community.bookings");
  const [reason, setReason] = useState("");
  const path = { bookingId: booking.id };
  const subject = { unit: booking.unitNo, facility: booking.facilityName };
  const reasonField = (testId: string) => (
    <Field label={t("reason")} hint={t("reasonHint")} required>
      <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} data-testid={testId} />
    </Field>
  );
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {booking.status === "requested" ? (
        <>
          <ConfirmAction
            label={t("approve")}
            icon={IconCheck}
            size="sm"
            testId="booking-approve"
            title={t("approveTitle", subject)}
            description={t("approveBody")}
            confirmLabel={t("approve")}
            successMessage={t("approved")}
            onConfirm={() =>
              unwrap(browserApi().POST("/v1/owner/facility-bookings/{bookingId}/actions/approve", { params: { path } }))
            }
          />
          <ConfirmAction
            label={t("reject")}
            icon={IconXCircle}
            size="sm"
            variant="ghost"
            tone="destructive"
            testId="booking-reject"
            title={t("rejectTitle", subject)}
            description={t("rejectBody")}
            confirmLabel={t("reject")}
            ready={reason.trim().length > 0}
            successMessage={t("rejected")}
            onConfirm={() =>
              unwrap(
                browserApi().POST("/v1/owner/facility-bookings/{bookingId}/actions/reject", {
                  params: { path },
                  body: { reason: reason.trim() },
                }),
              )
            }
          >
            {reasonField("booking-reject-reason")}
          </ConfirmAction>
        </>
      ) : null}
      {booking.status === "confirmed" && started ? (
        <ConfirmAction
          label={t("noShow")}
          icon={IconFlag}
          size="sm"
          variant="ghost"
          testId="booking-no-show"
          title={t("noShowTitle", subject)}
          description={t("noShowBody")}
          confirmLabel={t("noShow")}
          successMessage={t("markedNoShow")}
          onConfirm={() =>
            unwrap(browserApi().POST("/v1/owner/facility-bookings/{bookingId}/actions/no-show", { params: { path } }))
          }
        />
      ) : null}
      {booking.status === "confirmed" && !started ? (
        <ConfirmAction
          label={t("cancel")}
          icon={IconXCircle}
          size="sm"
          variant="ghost"
          tone="destructive"
          testId="booking-cancel"
          title={t("cancelTitle", subject)}
          description={t("cancelBody")}
          confirmLabel={t("cancel")}
          ready={reason.trim().length > 0}
          successMessage={t("cancelled")}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/owner/facility-bookings/{bookingId}/actions/cancel", {
                params: { path },
                body: { reason: reason.trim() },
              }),
            )
          }
        >
          {reasonField("booking-cancel-reason")}
        </ConfirmAction>
      ) : null}
    </div>
  );
}
