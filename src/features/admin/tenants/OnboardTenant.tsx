"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { toE164 } from "@/ui/components/PhoneInput";
import { IconAdd } from "@/ui/icons/glyphs/add";

const TYPES: Schemas["TenantType"][] = ["apartment", "condo_juristic", "pm_company", "landlord"];
const FORMS: Schemas["TenantLegalForm"][] = ["company", "person", "juristic_person"];

/**
 * Onboard a tenant (D-161, `POST /v1/admin/tenants`): the SaaS customer's type, names, legal form,
 * tax id, VAT flag, plan, and the phone of its first Owner, who receives the SMS invitation (D-145).
 * The invitation code is shown once so it can be handed over if the SMS does not arrive.
 */
export function OnboardTenant({ plans }: { plans: { key: string; name: string; tenantType: string | null }[] }) {
  const t = useTranslations("admin.tenants.onboard");
  const types = useTranslations("glossary.tenantType");
  const [created, setCreated] = useState<Schemas["TenantCreatedDto"] | null>(null);
  const [type, setType] = useState<Schemas["TenantType"]>("apartment");
  return (
    <div className="flex flex-col items-end gap-2">
      <FormDialog
        label={t("open")}
        icon={IconAdd}
        variant="primary"
        testId="onboard-tenant"
        title={t("title")}
        description={t("description")}
        submitLabel={t("submit")}
        size_="lg"
        successMessage={t("done")}
        onDone={(result) => setCreated(result as Schemas["TenantCreatedDto"])}
        onSubmit={(data) =>
          unwrap(
            browserApi().POST("/v1/admin/tenants", {
              params: { header: { "Idempotency-Key": crypto.randomUUID() } },
              body: {
                type: (text(data, "type") as Schemas["TenantType"]) ?? "apartment",
                slug: text(data, "slug") ?? "",
                displayName: text(data, "displayName") ?? "",
                legalName: text(data, "legalName") ?? "",
                legalForm: (text(data, "legalForm") as Schemas["TenantLegalForm"]) ?? "company",
                taxId: text(data, "taxId") ?? null,
                vatRegistered: data.get("vatRegistered") === "on",
                plan: text(data, "plan") ?? null,
                owner: { phone: toE164(text(data, "phone") ?? "") ?? text(data, "phone") ?? "", language: "th" },
              },
            }),
          )
        }
      >
        {(errors) => (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("type")} required error={errors.type}>
                <NativeSelect
                  name="type"
                  value={type}
                  onChange={(event) => setType(event.target.value as Schemas["TenantType"])}
                  options={TYPES.map((value) => ({ value, label: types(value) }))}
                />
              </Field>
              <Field label={t("plan")} hint={t("planHint")} error={errors.plan}>
                <NativeSelect
                  name="plan"
                  placeholder={t("noPlan")}
                  options={plans
                    .filter((plan) => !plan.tenantType || plan.tenantType === type)
                    .map((plan) => ({ value: plan.key, label: plan.name }))}
                />
              </Field>
              <Field label={t("displayName")} required error={errors.displayName}>
                <Input name="displayName" required autoComplete="off" />
              </Field>
              <Field label={t("slug")} hint={t("slugHint")} required error={errors.slug}>
                <Input name="slug" required pattern="[a-z0-9][a-z0-9\-]{2,62}" autoComplete="off" />
              </Field>
              <Field label={t("legalName")} required error={errors.legalName}>
                <Input name="legalName" required autoComplete="organization" />
              </Field>
              <Field label={t("legalForm")} required error={errors.legalForm}>
                <NativeSelect name="legalForm" options={FORMS.map((value) => ({ value, label: t(`form.${value}`) }))} />
              </Field>
              <Field label={t("taxId")} hint={t("taxIdHint")} error={errors.taxId}>
                <Input name="taxId" inputMode="numeric" pattern="\d{13}" autoComplete="off" />
              </Field>
              <Field label={t("phone")} hint={t("phoneHint")} required error={errors["owner.phone"]}>
                <Input name="phone" type="tel" inputMode="tel" required autoComplete="off" />
              </Field>
            </div>
            <Checkbox name="vatRegistered" label={t("vat")} />
          </>
        )}
      </FormDialog>
      {created ? (
        <Callout tone="success" title={t("createdTitle", { name: created.tenant.displayName })} className="max-w-xl">
          <p data-testid="onboard-invitation">
            {t("createdBody", { phone: created.invitation.phoneMasked ?? "—" })}{" "}
            <span className="font-mono font-semibold">{created.invitation.code}</span>
          </p>
          <a className="text-primary underline underline-offset-4" href={`/tenants/${created.tenant.id}`}>
            {t("openTenant")}
          </a>
        </Callout>
      ) : null}
    </div>
  );
}
