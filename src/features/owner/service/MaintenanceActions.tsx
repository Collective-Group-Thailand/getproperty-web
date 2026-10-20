"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, integer, text } from "@/features/shared/console/FormDialog";
import { bangkokToday } from "@/features/shared/console/time";
import { browserApi } from "@/lib/api/browser";
import { unwrap, unwrapWithETag } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconEdit } from "@/ui/icons/glyphs/edit";

import type { FieldMember } from "../shared/members";
import { AssigneeFields } from "./AssigneeFields";

export interface AssetChoice {
  id: string;
  label: string;
  /** The unit the item belongs to; `null` for the building's own equipment. */
  unitId: string | null;
}

type Category = Pick<Schemas["ServiceCategoryDto"], "id" | "nameTh">;

function PlanFields({
  plan,
  categories,
  members,
  errors,
}: {
  plan?: Schemas["MaintenancePlanDto"];
  categories: Category[];
  members: FieldMember[];
  errors: Record<string, string>;
}) {
  const t = useTranslations("owner.service.maintenance");
  return (
    <>
      <Field label={t("planTitle")} required error={errors.title}>
        <Input name="title" required defaultValue={plan?.title} data-testid="plan-title" />
      </Field>
      <Field label={t("planDescription")} error={errors.description}>
        <Textarea name="description" rows={2} defaultValue={plan?.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("interval")} hint={t("intervalHint")} required error={errors.intervalDays}>
          <Input
            name="intervalDays"
            type="number"
            min={1}
            required
            defaultValue={plan?.intervalDays ?? 90}
            data-testid="plan-interval"
          />
        </Field>
        <Field label={t("lead")} hint={t("leadHint")} error={errors.leadDays}>
          <Input name="leadDays" type="number" min={0} defaultValue={plan?.leadDays ?? 7} />
        </Field>
        <Field label={t("nextDue")} required error={errors.nextDueOn}>
          <DateField name="nextDueOn" defaultValue={plan?.nextDueOn ?? bangkokToday(30)} min={bangkokToday()} />
        </Field>
      </div>
      <Field label={t("category")} error={errors.categoryId}>
        <NativeSelect
          name="categoryId"
          defaultValue={plan?.categoryId ?? ""}
          placeholder={t("noCategory")}
          options={categories.map((category) => ({ value: category.id, label: category.nameTh }))}
        />
      </Field>
      <AssigneeFields
        members={members}
        initial={
          plan?.assigneeUserId
            ? { kind: "user", id: plan.assigneeUserId }
            : plan?.assigneePartyId
              ? { kind: "party", id: plan.assigneePartyId }
              : undefined
        }
        errors={errors}
      />
      <Checkbox name="isActive" value="true" defaultChecked={plan?.isActive ?? true} label={t("active")} />
    </>
  );
}

function planBody(data: FormData) {
  return {
    title: text(data, "title"),
    description: text(data, "description") ?? null,
    intervalDays: integer(data, "intervalDays"),
    leadDays: integer(data, "leadDays"),
    nextDueOn: text(data, "nextDueOn"),
    categoryId: text(data, "categoryId") ?? null,
    assigneeUserId: text(data, "assigneeUserId") ?? null,
    assigneePartyId: text(data, "assigneePartyId") ?? null,
    isActive: data.get("isActive") === "true",
  };
}

/**
 * A preventive maintenance plan on an asset item (D-210): the API opens one preventive work order at a time,
 * `leadDays` before each due date, and moves the next due date by the interval. The asset item is the building's
 * own equipment (pumps, lifts, water tanks, door locks…) or, once a unit is chosen, an item of that unit (air
 * conditioner, water heater, its meters and lock) — all from `GET /v1/owner/buildings/{id}/asset-items`.
 */
export function NewPlan({
  assets,
  units,
  categories,
  members,
}: {
  assets: AssetChoice[];
  units: { id: string; unitNo: string }[];
  categories: Category[];
  members: FieldMember[];
}) {
  const t = useTranslations("owner.service.maintenance");
  const [unitId, setUnitId] = useState("");
  const options = assets.filter((asset) => asset.unitId === (unitId || null));
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      variant="primary"
      testId="plan-add"
      title={t("addTitle")}
      description={t("addBody")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/maintenance-plans", {
            body: {
              ...planBody(data),
              assetItemId: text(data, "assetItemId") ?? "",
              title: text(data, "title") ?? "",
              intervalDays: integer(data, "intervalDays") ?? 0,
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("unit")} hint={t("unitHint")}>
              <NativeSelect
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
                placeholder={t("buildingWide")}
                options={units.map((unit) => ({ value: unit.id, label: unit.unitNo }))}
                data-testid="plan-unit"
              />
            </Field>
            <Field label={t("asset")} required error={errors.assetItemId}>
              <NativeSelect
                name="assetItemId"
                required
                placeholder={t("chooseAsset")}
                options={options.map((asset) => ({ value: asset.id, label: asset.label }))}
                data-testid="plan-asset"
              />
            </Field>
          </div>
          <PlanFields categories={categories} members={members} errors={errors} />
        </>
      )}
    </FormDialog>
  );
}

/** Changes a plan; the plan is read with its ETag first and sent back as `If-Match` (a concurrent change answers 412). */
export function EditPlan({
  plan,
  categories,
  members,
}: {
  plan: Schemas["MaintenancePlanDto"];
  categories: Category[];
  members: FieldMember[];
}) {
  const t = useTranslations("owner.service.maintenance");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      variant="ghost"
      size="sm"
      testId="plan-edit"
      title={t("editTitle", { title: plan.title })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      size_="lg"
      onSubmit={async (data) => {
        const { etag } = await unwrapWithETag(
          browserApi().GET("/v1/owner/maintenance-plans/{maintenancePlanId}", {
            params: { path: { maintenancePlanId: plan.id } },
          }),
        );
        return unwrap(
          browserApi().PATCH("/v1/owner/maintenance-plans/{maintenancePlanId}", {
            params: { path: { maintenancePlanId: plan.id }, header: { "If-Match": etag ?? "*" } },
            body: planBody(data),
          }),
        );
      }}
    >
      {(errors) => <PlanFields plan={plan} categories={categories} members={members} errors={errors} />}
    </FormDialog>
  );
}
