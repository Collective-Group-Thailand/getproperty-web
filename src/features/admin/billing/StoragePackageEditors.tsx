"use client";

import { useLocale, useTranslations } from "next-intl";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokInstant, bangkokToday } from "@/features/shared/console/time";
import { useApiAction, ProblemNotice } from "@/features/shared/console/useApiAction";
import { formatBytes } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Switch } from "@/ui/components/Switch";
import { toast } from "@/ui/components/Toast";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconRefresh } from "@/ui/icons/glyphs/refresh";
import { IconSettings } from "@/ui/icons/glyphs/settings";

const PERIODS: Schemas["StoragePackagePeriod"][] = ["month", "year"];
const VISIBILITY: Schemas["StoragePackageVisibility"][] = ["public", "hidden"];

/**
 * A new storage package definition (G1, D-285): a price-plan add-on with a draft version from a date not before
 * today. The price may stay empty (O-022) — owners then see "not on sale yet"; it goes on sale when its version is
 * published on Price plans. The API validates everything again.
 */
export function NewStoragePackage({ types }: { types: { key: string; label: string }[] }) {
  const t = useTranslations("admin.billing.storage.packages");
  return (
    <FormDialog
      label={t("new")}
      icon={IconAdd}
      size="sm"
      size_="lg"
      testId="new-storage-package"
      title={t("newTitle")}
      description={t("newHint")}
      submitLabel={t("create")}
      successMessage={t("created")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/admin/storage/packages", {
            body: {
              key: text(data, "key") ?? "",
              nameTh: text(data, "nameTh") ?? "",
              nameEn: text(data, "nameEn") ?? "",
              sizeGb: (text(data, "sizeGb") ?? "").replace(/,/g, ""),
              period: (text(data, "period") as Schemas["StoragePackagePeriod"]) ?? "month",
              visibility: (text(data, "visibility") as Schemas["StoragePackageVisibility"]) ?? "public",
              tenantType: (text(data, "tenantType") as Schemas["TenantType"] | undefined) ?? null,
              unitPrice: text(data, "unitPrice")?.replace(/,/g, "") ?? null,
              vatRate: text(data, "vatRate") ?? "0.07",
              effectiveFrom: text(data, "effectiveFrom") ?? bangkokToday(),
            },
          }),
        )
      }
    >
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("key")} hint={t("keyHint")} required error={errors.key} className="sm:col-span-2">
            <Input name="key" required className="font-mono" data-testid="storage-package-key" />
          </Field>
          <Field label={t("nameTh")} required error={errors.nameTh}>
            <Input name="nameTh" required data-testid="storage-package-name-th" />
          </Field>
          <Field label={t("nameEn")} required error={errors.nameEn}>
            <Input name="nameEn" required data-testid="storage-package-name-en" />
          </Field>
          <Field label={t("sizeGb")} required error={errors.sizeGb}>
            <Input
              name="sizeGb"
              inputMode="decimal"
              required
              className="tabular-nums"
              data-testid="storage-package-size"
            />
          </Field>
          <Field label={t("period")} required error={errors.period}>
            <NativeSelect
              name="period"
              options={PERIODS.map((value) => ({ value, label: t(`periodOption.${value}`) }))}
              data-testid="storage-package-period"
            />
          </Field>
          <Field label={t("tenantType")} error={errors.tenantType}>
            <NativeSelect
              name="tenantType"
              placeholder={t("allTypes")}
              options={types.map(({ key, label }) => ({ value: key, label }))}
            />
          </Field>
          <Field label={t("visibility")} required error={errors.visibility}>
            <NativeSelect
              name="visibility"
              options={VISIBILITY.map((value) => ({ value, label: t(`visibilityOption.${value}`) }))}
            />
          </Field>
          <Field label={t("unitPrice")} hint={t("unitPriceHint")} error={errors.unitPrice}>
            <Input name="unitPrice" inputMode="decimal" className="tabular-nums" data-testid="storage-package-price" />
          </Field>
          <Field label={t("vatRate")} error={errors.vatRate}>
            <Input name="vatRate" inputMode="decimal" defaultValue="0.07" className="tabular-nums" />
          </Field>
          <Field label={t("effectiveFrom")} required error={errors.effectiveFrom}>
            <Input name="effectiveFrom" type="date" min={bangkokToday()} defaultValue={bangkokToday()} required />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

/** Names and the active switch of a definition (D-285); size, period and price change through a price-plan version. */
export function EditStoragePackage({ definition }: { definition: Schemas["StoragePackageDefinitionDto"] }) {
  const t = useTranslations("admin.billing.storage.packages");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      size="sm"
      variant="ghost"
      testId="edit-storage-package"
      title={t("editTitle", { name: definition.nameEn })}
      description={t("editHint")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) =>
        unwrap(
          browserApi().PATCH("/v1/admin/storage/packages/{packageId}", {
            params: { path: { packageId: definition.id } },
            body: {
              nameTh: text(data, "nameTh") ?? definition.nameTh,
              nameEn: text(data, "nameEn") ?? definition.nameEn,
              isActive: data.get("isActive") === "on",
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("nameTh")} required error={errors.nameTh}>
            <Input name="nameTh" defaultValue={definition.nameTh} required />
          </Field>
          <Field label={t("nameEn")} required error={errors.nameEn}>
            <Input name="nameEn" defaultValue={definition.nameEn} required />
          </Field>
          <Switch
            name="isActive"
            label={t("active")}
            description={t("activeHint")}
            defaultChecked={definition.isActive}
          />
        </>
      )}
    </FormDialog>
  );
}

/** One tenant's free storage quota (D-285): a dated, audited tenant version of `storage.free_gb` with a reason. */
export function StorageQuotaEditor({
  tenantId,
  name,
  freeGb,
}: {
  tenantId: string;
  name: string;
  /** Current free allowance in GB, as the API reports it (null = not metered). */
  freeGb: string | null;
}) {
  const t = useTranslations("admin.billing.storage.quota");
  return (
    <FormDialog
      label={t("action")}
      icon={IconSettings}
      size="sm"
      variant="ghost"
      testId="storage-quota"
      title={t("title", { name })}
      description={t("description")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) =>
        unwrap(
          browserApi().PUT("/v1/admin/tenants/{tenantId}/storage-quota", {
            params: { path: { tenantId } },
            body: {
              freeGb: (text(data, "freeGb") ?? "").replace(/,/g, ""),
              reason: text(data, "reason") ?? "",
              effectiveFrom: bangkokInstant(text(data, "effectiveFrom")),
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("freeGb")} required error={errors.freeGb}>
            <Input
              name="freeGb"
              inputMode="decimal"
              defaultValue={freeGb ?? ""}
              required
              className="tabular-nums"
              data-testid="storage-quota-gb"
            />
          </Field>
          <Field label={t("effectiveFrom")} hint={t("effectiveFromHint")} error={errors.effectiveFrom}>
            <Input name="effectiveFrom" type="datetime-local" />
          </Field>
          <Field label={t("reason")} hint={t("reasonHint")} required error={errors.reason}>
            <Textarea name="reason" rows={2} required data-testid="storage-quota-reason" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** Runs the nightly reconciliation for one tenant now (support, D-286) and says the drift it found. */
export function ReconcileNow({ tenantId }: { tenantId: string }) {
  const t = useTranslations("admin.billing.storage.reconcile");
  const locale = useLocale() as Locale;
  const action = useApiAction<Schemas["StorageReconciliationDto"]>();
  return (
    <span className="flex flex-col gap-1">
      <Button
        variant="ghost"
        size="sm"
        iconStart={IconRefresh}
        loading={action.busy}
        onClick={() =>
          action.run(
            () =>
              unwrap(
                browserApi().POST("/v1/admin/storage/tenants/{tenantId}/actions/reconcile", {
                  params: { path: { tenantId } },
                }),
              ),
            (report) => {
              toast.success(t("done", { drift: formatBytes(Math.abs(Number(report.driftBytes)), locale) }));
            },
          )
        }
        data-testid="storage-reconcile"
      >
        {t("action")}
      </Button>
      <ProblemNotice error={action.error} />
    </span>
  );
}
