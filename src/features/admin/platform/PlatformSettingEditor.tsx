"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { SettingEditor, type SettingValueType } from "@/features/shared/console/SettingEditor";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { IconButton } from "@/ui/components/IconButton";
import { Input } from "@/ui/components/Input";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconClose } from "@/ui/icons/glyphs/close";

import { readShape, settingShape } from "./settingShape";

/**
 * `PUT /v1/admin/settings/{key}` (platform value) or `…/tenants/{id}/settings/{key}` (one tenant's value), with typed
 * controls (redesign G8): a map becomes one labelled number per entry with its unit ("ว่างไว้ = ยังไม่คิดเงิน" where a
 * value may be empty), a list becomes rows you add and remove — never a JSON text box for those shapes.
 */
export function PlatformSettingEditor({
  settingKey,
  description,
  valueType,
  value,
  tenantId,
  name,
  unit,
  labels,
}: {
  settingKey: string;
  description: string;
  valueType: SettingValueType;
  value: unknown;
  tenantId?: string;
  /** The setting's name in words (the dialog's title). */
  name?: string;
  unit?: string;
  /** Words for the keys of a map value (customer types, document kinds). */
  labels?: Record<string, string>;
}) {
  const t = useTranslations("admin.platform.settings");
  const shape = settingShape(value, valueType);
  const typed = shape.kind === "map" || shape.kind === "list";
  return (
    <SettingEditor
      settingKey={settingKey}
      description={description}
      valueType={valueType}
      value={value}
      title={name ? t("editTitle", { name }) : undefined}
      parse={typed ? (data) => readShape(shape, data) : undefined}
      fields={
        shape.kind === "map"
          ? (errors) => (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-2 text-sm font-medium">{t("valueLegend")}</legend>
                {errors.value ? <Callout tone="danger">{errors.value}</Callout> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  {shape.entries.map((entry) => {
                    const current = (value as Record<string, unknown>)[entry.key];
                    const label = labels?.[entry.key] ?? entry.key;
                    return entry.type === "bool" ? (
                      <Checkbox
                        key={entry.key}
                        name={`value.${entry.key}`}
                        label={label}
                        defaultChecked={current === true}
                      />
                    ) : (
                      <Field key={entry.key} label={label} hint={entry.nullable ? t("emptyMeansOff") : undefined}>
                        <span className="flex items-center gap-2">
                          <Input
                            name={`value.${entry.key}`}
                            inputMode={entry.type === "text" ? "text" : "decimal"}
                            defaultValue={current === null || current === undefined ? "" : String(current)}
                            className="tabular-nums"
                            data-testid={`setting-value-${entry.key}`}
                          />
                          {unit ? <span className="text-muted shrink-0 text-sm">{unit}</span> : null}
                        </span>
                      </Field>
                    );
                  })}
                </div>
              </fieldset>
            )
          : shape.kind === "list"
            ? (errors) => <ListFields initial={(value as unknown[]).map(String)} unit={unit} error={errors.value} />
            : undefined
      }
      onSave={(input) =>
        tenantId
          ? unwrap(
              browserApi().PUT("/v1/admin/tenants/{tenantId}/settings/{key}", {
                params: { path: { tenantId, key: settingKey } },
                body: input as Schemas["SettingUpdateDto"],
              }),
            )
          : unwrap(
              browserApi().PUT("/v1/admin/settings/{key}", {
                params: { path: { key: settingKey } },
                body: input as Schemas["SettingUpdateDto"],
              }),
            )
      }
    />
  );
}

/** A list value as rows: each a field with its unit and a remove button, and "add" at the end. */
function ListFields({ initial, unit, error }: { initial: string[]; unit?: string; error?: string }) {
  const t = useTranslations("admin.platform.settings");
  const [rows, setRows] = useState(() => initial.map((item, index) => ({ id: index, item })));
  const [next, setNext] = useState(initial.length);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{t("valueLegend")}</legend>
      {error ? <Callout tone="danger">{error}</Callout> : null}
      {rows.map((row, index) => (
        <span key={row.id} className="flex items-center gap-2">
          <Input
            name="value.item"
            inputMode="decimal"
            defaultValue={row.item}
            aria-label={t("listItem", { index: index + 1 })}
            className="w-32 tabular-nums"
          />
          {unit ? <span className="text-muted text-sm">{unit}</span> : null}
          <IconButton
            icon={IconClose}
            label={t("removeItem", { index: index + 1 })}
            onClick={() => setRows((current) => current.filter((one) => one.id !== row.id))}
          />
        </span>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        iconStart={IconAdd}
        className="w-fit"
        onClick={() => {
          setRows((current) => [...current, { id: next, item: "" }]);
          setNext(next + 1);
        }}
      >
        {t("addItem")}
      </Button>
    </fieldset>
  );
}
