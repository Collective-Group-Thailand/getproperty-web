"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { FileDropzone } from "@/ui/components/FileDropzone";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { toast } from "@/ui/components/Toast";
import { IconEdit } from "@/ui/icons/glyphs/edit";

import { uploadOwnerFile } from "../shared/upload";

const FORMS: Schemas["TenantLegalForm"][] = ["person", "company", "juristic_person"];

/**
 * `PATCH /v1/owner/tenant` with `If-Match` — the company data printed on invoices and receipts (D-050):
 * names, legal form, tax id, VAT registration and the address. The API refuses a stale version
 * (`412 concurrency.stale`) when someone else saved first.
 */
export function EditCompany({ tenant, etag }: { tenant: Schemas["TenantProfileDto"]; etag: string | null }) {
  const t = useTranslations("owner.settings.company");
  const address = tenant.address;
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      testId="edit-company"
      title={t("editTitle")}
      description={t("editHint")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      size_="lg"
      onSubmit={(data) =>
        unwrap(
          browserApi().PATCH("/v1/owner/tenant", {
            params: { header: { "If-Match": etag ?? "*" } },
            body: {
              displayName: text(data, "displayName"),
              legalName: text(data, "legalName"),
              legalForm: text(data, "legalForm") as Schemas["TenantLegalForm"] | undefined,
              taxId: text(data, "taxId") ?? null,
              vatRegistered: data.get("vatRegistered") === "on",
              defaultLanguage: text(data, "defaultLanguage"),
              address: text(data, "line1")
                ? {
                    line1: text(data, "line1") ?? "",
                    line2: text(data, "line2") ?? null,
                    subdistrict: text(data, "subdistrict"),
                    district: text(data, "district"),
                    province: text(data, "province") ?? "",
                    postcode: text(data, "postcode") ?? "",
                    country: address?.country ?? "TH",
                  }
                : undefined,
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("displayName")} required error={errors.displayName}>
              <Input name="displayName" required defaultValue={tenant.displayName} data-testid="company-display-name" />
            </Field>
            <Field label={t("legalName")} hint={t("legalNameHint")} required error={errors.legalName}>
              <Input name="legalName" required defaultValue={tenant.legalName} />
            </Field>
            <Field label={t("legalForm")} error={errors.legalForm}>
              <NativeSelect
                name="legalForm"
                defaultValue={tenant.legalForm}
                options={FORMS.map((form) => ({ value: form, label: t(`form.${form}`) }))}
              />
            </Field>
            <Field label={t("taxId")} hint={t("taxIdHint")} error={errors.taxId}>
              <Input
                name="taxId"
                inputMode="numeric"
                pattern="\d{13}"
                defaultValue={tenant.taxId ?? ""}
                data-testid="company-tax-id"
              />
            </Field>
          </div>
          <Checkbox
            name="vatRegistered"
            label={t("vat")}
            description={t("vatHint")}
            defaultChecked={tenant.vatRegistered}
            data-testid="company-vat"
          />
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-medium">{t("address")}</legend>
            <Field label={t("line1")} className="sm:col-span-2" error={errors["address.line1"]}>
              <Input name="line1" defaultValue={address?.line1 ?? ""} />
            </Field>
            <Field label={t("line2")} className="sm:col-span-2">
              <Input name="line2" defaultValue={address?.line2 ?? ""} />
            </Field>
            <Field label={t("subdistrict")}>
              <Input name="subdistrict" defaultValue={address?.subdistrict ?? ""} />
            </Field>
            <Field label={t("district")}>
              <Input name="district" defaultValue={address?.district ?? ""} />
            </Field>
            <Field label={t("province")} error={errors["address.province"]}>
              <Input name="province" defaultValue={address?.province ?? ""} />
            </Field>
            <Field label={t("postcode")} error={errors["address.postcode"]}>
              <Input name="postcode" inputMode="numeric" pattern="\d{5}" defaultValue={address?.postcode ?? ""} />
            </Field>
          </fieldset>
          <Field label={t("language")}>
            <NativeSelect
              name="defaultLanguage"
              defaultValue={tenant.defaultLanguage}
              options={[
                { value: "th", label: t("languageName.th") },
                { value: "en", label: t("languageName.en") },
              ]}
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/**
 * The logo on documents: uploaded as a `logo` file of the tenant (presign → PUT → complete), then set
 * with `PATCH /v1/owner/tenant { logoDocumentId }`.
 */
export function LogoUpload({ etag }: { etag: string | null }) {
  const t = useTranslations("owner.settings.company");
  const router = useRouter();
  const action = useApiAction({ refresh: false });
  const [name, setName] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-2" data-testid="logo-upload">
      <FileDropzone
        accept="image/png,image/jpeg,image/svg+xml"
        label={t("logoDrop")}
        chooseText={t("logoChoose")}
        maxBytes={2 * 1024 * 1024}
        tooLargeText={t("logoTooLarge")}
        data-testid="logo-input"
        hint={t("logoHint")}
        disabled={action.busy}
        onFiles={(files) => {
          const file = files[0];
          if (!file) return;
          setName(file.name);
          void action.run(
            async () => {
              const uploaded = await uploadOwnerFile(file, { kind: "logo", scopeType: "tenant", title: file.name });
              return unwrap(
                browserApi().PATCH("/v1/owner/tenant", {
                  params: { header: { "If-Match": etag ?? "*" } },
                  body: { logoDocumentId: uploaded.id },
                }),
              );
            },
            () => {
              toast.success(t("logoSaved"));
              router.refresh();
            },
          );
        }}
      />
      {action.busy && name ? <p className="text-muted text-sm">{t("uploading", { name })}</p> : null}
      <ProblemNotice error={action.error} />
    </div>
  );
}
