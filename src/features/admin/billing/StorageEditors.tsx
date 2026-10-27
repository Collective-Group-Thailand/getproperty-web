"use client";

import { useTranslations } from "next-intl";

import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokInstant } from "@/features/shared/console/time";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { IconEdit } from "@/ui/icons/glyphs/edit";

const DECIMAL = /^\d{1,6}(\.\d{1,4})?$/;

/** One new platform version of a `storage.*` setting (effective-dated, audited; the API validates the shape). */
function save(key: string, value: Schemas["SettingUpdateDto"]["value"], data: FormData) {
  return unwrap(
    browserApi().PUT("/v1/admin/settings/{key}", {
      params: { path: { key } },
      body: { value, effectiveFrom: bangkokInstant(text(data, "effectiveFrom")), reason: text(data, "reason") ?? "" },
    }),
  );
}

/** "When" and "why" — every storage change is a dated, audited setting version (ADR-0004). */
function WhenAndWhy({ errors }: { errors: Record<string, string> }) {
  const t = useTranslations("console.setting");
  return (
    <>
      <Field label={t("effectiveFrom")} hint={t("effectiveFromHint")} error={errors.effectiveFrom}>
        <Input name="effectiveFrom" type="datetime-local" />
      </Field>
      <Field label={t("reason")} required error={errors.reason}>
        <Textarea name="reason" rows={2} required data-testid="storage-reason" />
      </Field>
    </>
  );
}

/**
 * Free allowance and overage price per tenant type in one form (D-279): an empty free allowance switches metering off
 * for that type; an empty price means overage is not sold (only optional uploads are then held).
 */
export function StorageAllowanceEditor({
  types,
  freeGb,
  price,
}: {
  types: { key: string; label: string }[];
  freeGb: Record<string, string | null>;
  price: Record<string, string | null>;
}) {
  const t = useTranslations("admin.billing.storage");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      size="sm"
      testId="edit-storage-allowance"
      title={t("allowance.title")}
      description={t("allowance.dialog")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={async (data) => {
        const read = (prefix: string) =>
          Object.fromEntries(
            types.map(({ key }) => {
              const value = (text(data, `${prefix}.${key}`) ?? "").replace(/,/g, "");
              if (value !== "" && !DECIMAL.test(value)) throw new Error(t("invalidNumber"));
              return [key, value === "" ? null : value];
            }),
          );
        const nextFree = read("free");
        const nextPrice = read("price");
        if (JSON.stringify(nextFree) !== JSON.stringify(freeGb)) await save("storage.free_gb", nextFree, data);
        if (JSON.stringify(nextPrice) !== JSON.stringify(price))
          await save("storage.price_per_gb_month", nextPrice, data);
      }}
    >
      {(errors) => (
        <>
          <div className="grid grid-cols-[1fr_6rem_7rem] items-end gap-x-3 gap-y-3">
            <span className="text-muted text-sm">{t("allowance.type")}</span>
            <span className="text-muted text-sm">{t("allowance.freeGb")}</span>
            <span className="text-muted text-sm">{t("allowance.price")}</span>
            {types.map(({ key, label }) => (
              <div key={key} className="contents">
                <span className="self-center font-medium">{label}</span>
                <Input
                  name={`free.${key}`}
                  inputMode="decimal"
                  defaultValue={freeGb[key] ?? ""}
                  placeholder={t("noLimit")}
                  aria-label={`${label} · ${t("allowance.freeGb")}`}
                  data-testid={`storage-free-${key}`}
                  className="tabular-nums"
                />
                <Input
                  name={`price.${key}`}
                  inputMode="decimal"
                  defaultValue={price[key] ?? ""}
                  placeholder={t("notSold")}
                  aria-label={`${label} · ${t("allowance.price")}`}
                  data-testid={`storage-price-${key}`}
                  className="tabular-nums"
                />
              </div>
            ))}
          </div>
          <p className="text-muted text-sm">{t("allowance.hint")}</p>
          <WhenAndWhy errors={errors} />
        </>
      )}
    </FormDialog>
  );
}

/** Notice thresholds (D-276): percentages of the allowance at which the owner is told, e.g. "80, 100". */
export function StorageNoticeEditor({ thresholds }: { thresholds: number[] }) {
  const t = useTranslations("admin.billing.storage");
  return (
    <FormDialog
      label={t("edit")}
      icon={IconEdit}
      size="sm"
      testId="edit-storage-notices"
      title={t("notices.title")}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={(data) => {
        const values = (text(data, "thresholds") ?? "")
          .split(/[,\s]+/)
          .filter(Boolean)
          .map(Number);
        if (values.length === 0 || values.some((v) => !Number.isInteger(v) || v <= 0 || v > 1000))
          return Promise.reject(new Error(t("notices.invalid")));
        return save(
          "storage.notice_at_percent",
          [...new Set(values)].sort((a, b) => a - b),
          data,
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("notices.label")} hint={t("notices.hint")} required error={errors.value}>
            <Input name="thresholds" defaultValue={thresholds.join(", ")} data-testid="storage-thresholds" />
          </Field>
          <WhenAndWhy errors={errors} />
        </>
      )}
    </FormDialog>
  );
}
