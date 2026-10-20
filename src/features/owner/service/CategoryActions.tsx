"use client";

import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, integer, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";

function body(data: FormData): Schemas["ServiceCategoryPutDto"] {
  return {
    nameTh: text(data, "nameTh"),
    nameEn: text(data, "nameEn"),
    slaHours: integer(data, "slaHours") ?? 0,
    sortOrder: integer(data, "sortOrder"),
    isActive: data.get("isActive") === "true",
  };
}

function CategoryFields({
  category,
  errors,
  withKey,
}: {
  category?: Schemas["ServiceCategoryDto"];
  errors: Record<string, string>;
  withKey?: boolean;
}) {
  const t = useTranslations("owner.service.categories");
  return (
    <>
      {withKey ? (
        <Field label={t("key")} hint={t("keyHint")} required error={errors.key}>
          <Input name="key" required pattern="[a-z][a-z0-9_]{1,31}" className="font-mono" data-testid="category-key" />
        </Field>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("nameTh")} required={withKey} error={errors.nameTh}>
          <Input name="nameTh" defaultValue={category?.nameTh} required={withKey} />
        </Field>
        <Field label={t("nameEn")} required={withKey} error={errors.nameEn}>
          <Input name="nameEn" defaultValue={category?.nameEn} required={withKey} />
        </Field>
        <Field label={t("slaHours")} hint={t("slaHint")} required error={errors.slaHours}>
          <Input
            name="slaHours"
            type="number"
            min={1}
            max={720}
            required
            defaultValue={category?.slaHours}
            data-testid="category-sla"
          />
        </Field>
        <Field label={t("sortOrder")} error={errors.sortOrder}>
          <Input name="sortOrder" type="number" min={0} defaultValue={category?.sortOrder} />
        </Field>
      </div>
      <Checkbox name="isActive" value="true" defaultChecked={category?.isActive ?? true} label={t("active")} />
    </>
  );
}

/**
 * A category's SLA hours and names for this tenant (`PUT /v1/owner/service-categories/{key}`, D-210): a
 * platform default becomes the tenant's override; new requests keep the hours in force when reported.
 */
export function EditCategory({ category }: { category: Schemas["ServiceCategoryDto"] }) {
  const t = useTranslations("owner.service.categories");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      variant="ghost"
      size="sm"
      testId={`category-edit-${category.key}`}
      title={t("editTitle", { name: category.nameTh })}
      description={t("editBody")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) =>
        unwrap(
          browserApi().PUT("/v1/owner/service-categories/{key}", {
            params: { path: { key: category.key } },
            body: body(data),
          }),
        )
      }
    >
      {(errors) => <CategoryFields category={category} errors={errors} />}
    </FormDialog>
  );
}

/** A category of the tenant's own (a key the platform does not have). */
export function NewCategory() {
  const t = useTranslations("owner.service.categories");
  return (
    <FormDialog
      label={t("add")}
      icon={IconAdd}
      testId="category-add"
      title={t("addTitle")}
      description={t("addBody")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) =>
        unwrap(
          browserApi().PUT("/v1/owner/service-categories/{key}", {
            params: { path: { key: text(data, "key") ?? "" } },
            body: body(data),
          }),
        )
      }
    >
      {(errors) => <CategoryFields errors={errors} withKey />}
    </FormDialog>
  );
}

/** Removes the tenant's override (the platform default applies again) or the tenant's own category. */
export function ResetCategory({ category }: { category: Schemas["ServiceCategoryDto"] }) {
  const t = useTranslations("owner.service.categories");
  return (
    <ConfirmAction
      label={t("reset")}
      icon={IconRefresh}
      variant="ghost"
      size="sm"
      testId={`category-reset-${category.key}`}
      title={t("resetTitle", { name: category.nameTh })}
      description={t("resetBody")}
      confirmLabel={t("reset")}
      successMessage={t("resetDone")}
      onConfirm={() =>
        unwrap(browserApi().DELETE("/v1/owner/service-categories/{key}", { params: { path: { key: category.key } } }))
      }
    />
  );
}
