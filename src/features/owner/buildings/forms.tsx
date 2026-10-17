"use client";

import { useTranslations } from "next-intl";

import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";

import { ConfirmAction } from "../shared/ConfirmAction";
import { FormDialog, integer, text } from "../shared/FormDialog";

const BUILDING_TYPES: Schemas["BuildingType"][] = ["apartment", "condo", "house_cluster", "mixed_use"];

/** `POST /v1/owner/properties` — a group of buildings (D-151), with its address for documents. */
export function NewPropertyButton() {
  const t = useTranslations("owner.buildings.property");
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      testId="new-property"
      title={t("newTitle")}
      submitLabel={t("create")}
      successMessage={t("created")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/properties", {
            body: {
              code: text(data, "code") ?? "",
              name: text(data, "name") ?? "",
              address: text(data, "line1")
                ? {
                    line1: text(data, "line1")!,
                    subdistrict: text(data, "subdistrict"),
                    district: text(data, "district"),
                    province: text(data, "province") ?? "",
                    postcode: text(data, "postcode") ?? "",
                    country: "TH",
                  }
                : undefined,
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("name")} required error={errors.name}>
            <Input name="name" required autoComplete="off" />
          </Field>
          <Field label={t("code")} hint={t("codeHint")} required error={errors.code}>
            <Input name="code" required pattern="[A-Za-z0-9_-]{1,20}" autoComplete="off" />
          </Field>
          <Field label={t("line1")} error={errors["address.line1"]}>
            <Input name="line1" autoComplete="address-line1" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("subdistrict")}>
              <Input name="subdistrict" />
            </Field>
            <Field label={t("district")}>
              <Input name="district" />
            </Field>
            <Field label={t("province")} error={errors["address.province"]}>
              <Input name="province" autoComplete="address-level1" />
            </Field>
            <Field label={t("postcode")} error={errors["address.postcode"]}>
              <Input name="postcode" inputMode="numeric" autoComplete="postal-code" />
            </Field>
          </div>
        </>
      )}
    </FormDialog>
  );
}

/** `POST /v1/owner/buildings` in a property. */
export function NewBuildingButton({ properties }: { properties: Pick<Schemas["PropertyDto"], "id" | "name">[] }) {
  const t = useTranslations("owner.buildings.building");
  const types = useTranslations("owner.buildings.type");
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      variant="primary"
      testId="new-building"
      title={t("newTitle")}
      submitLabel={t("create")}
      successMessage={t("created")}
      disabled={properties.length === 0}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/buildings", {
            body: {
              propertyId: text(data, "propertyId") ?? "",
              code: text(data, "code") ?? "",
              name: text(data, "name") ?? "",
              type: (text(data, "type") ?? "apartment") as Schemas["BuildingType"],
              floorsCount: integer(data, "floorsCount"),
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("property")} required error={errors.propertyId}>
            <NativeSelect
              name="propertyId"
              required
              options={properties.map((property) => ({ value: property.id, label: property.name }))}
            />
          </Field>
          <Field label={t("name")} required error={errors.name}>
            <Input name="name" required autoComplete="off" />
          </Field>
          <Field label={t("code")} hint={t("codeHint")} required error={errors.code}>
            <Input name="code" required maxLength={10} autoComplete="off" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("type")} error={errors.type}>
              <NativeSelect name="type" options={BUILDING_TYPES.map((type) => ({ value: type, label: types(type) }))} />
            </Field>
            <Field label={t("floorsCount")} error={errors.floorsCount}>
              <Input name="floorsCount" type="number" min={1} max={200} inputMode="numeric" />
            </Field>
          </div>
        </>
      )}
    </FormDialog>
  );
}

/** `POST /v1/owner/buildings/{id}/floors`. */
export function NewFloorButton({ buildingId }: { buildingId: string }) {
  const t = useTranslations("owner.buildings.floor");
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      size="sm"
      testId="new-floor"
      title={t("newTitle")}
      submitLabel={t("create")}
      successMessage={t("created")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/buildings/{buildingId}/floors", {
            params: { path: { buildingId } },
            body: { level: integer(data, "level") ?? Number.NaN, name: text(data, "name") ?? "" },
          }),
        )
      }
    >
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("level")} required error={errors.level}>
            <Input name="level" type="number" required inputMode="numeric" />
          </Field>
          <Field label={t("name")} required hint={t("nameHint")} error={errors.name}>
            <Input name="name" required />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

const PROVIDERS: Record<Schemas["Utility"], Schemas["UtilityProvider"][]> = {
  electric: ["mea", "pea"],
  water: ["mwa", "pwa"],
};

/** `POST /v1/owner/buildings/{id}/utility-accounts` — the building's own MEA/PEA/MWA/PWA accounts (loss, cap reference). */
export function NewUtilityAccountButton({ buildingId }: { buildingId: string }) {
  const t = useTranslations("owner.buildings.account");
  const glossary = useTranslations("owner.common.provider");
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      size="sm"
      testId="new-utility-account"
      title={t("newTitle")}
      description={t("newBody")}
      submitLabel={t("create")}
      successMessage={t("created")}
      onSubmit={(data) => {
        const provider = (text(data, "provider") ?? "mea") as Schemas["UtilityProvider"];
        return unwrap(
          browserApi().POST("/v1/owner/buildings/{buildingId}/utility-accounts", {
            params: { path: { buildingId } },
            body: {
              utility: PROVIDERS.electric.includes(provider) ? "electric" : "water",
              provider,
              customerNo: text(data, "customerNo") ?? "",
              label: text(data, "label") ?? "",
              meterNo: text(data, "meterNo") ?? null,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("provider")} required error={errors.provider ?? errors.utility}>
            <NativeSelect
              name="provider"
              required
              options={[...PROVIDERS.electric, ...PROVIDERS.water].map((provider) => ({
                value: provider,
                label: glossary(provider),
              }))}
            />
          </Field>
          <Field label={t("label")} required hint={t("labelHint")} error={errors.label}>
            <Input name="label" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("customerNo")} required error={errors.customerNo}>
              <Input name="customerNo" required inputMode="numeric" className="font-mono" />
            </Field>
            <Field label={t("meterNo")} error={errors.meterNo}>
              <Input name="meterNo" className="font-mono" />
            </Field>
          </div>
        </>
      )}
    </FormDialog>
  );
}

/** `DELETE /v1/owner/utility-accounts/{id}`. */
export function RemoveUtilityAccountButton({ account }: { account: Schemas["UtilityAccountDto"] }) {
  const t = useTranslations("owner.buildings.account");
  return (
    <ConfirmAction
      label={t("remove")}
      icon={IconDelete}
      variant="ghost"
      size="sm"
      tone="destructive"
      title={t("removeTitle")}
      description={t("removeBody", { label: account.label, customerNo: account.customerNo })}
      confirmLabel={t("remove")}
      onConfirm={() =>
        unwrap(
          browserApi().DELETE("/v1/owner/utility-accounts/{utilityAccountId}", {
            params: { path: { utilityAccountId: account.id } },
          }),
        )
      }
      successMessage={t("removed")}
    />
  );
}
