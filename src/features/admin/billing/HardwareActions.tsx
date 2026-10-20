"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, integer, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";

/** `POST /v1/admin/haas-assets` — a platform-owned device placed at a tenant on a term (D-081, D-205). */
export function RegisterHaasAsset({
  tenantId,
  devices,
  tenants,
}: {
  tenantId?: string;
  devices: { id: string; label: string }[];
  tenants?: { id: string; name: string }[];
}) {
  const t = useTranslations("admin.billing.hardware");
  return (
    <FormDialog
      label={t("register")}
      icon={IconAdd}
      variant="primary"
      testId="register-haas"
      title={t("registerTitle")}
      description={t("registerHint")}
      submitLabel={t("register")}
      successMessage={t("registered")}
      disabled={devices.length === 0}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/admin/haas-assets", {
            params: { header: { "Idempotency-Key": crypto.randomUUID() } },
            body: {
              tenantId: tenantId ?? text(data, "tenantId") ?? "",
              deviceId: text(data, "deviceId") ?? "",
              termMonths: integer(data, "termMonths") ?? 36,
              acquisitionCost: text(data, "acquisitionCost") ?? "",
              monthlyValue: text(data, "monthlyValue") ?? "",
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          {tenantId ? null : (
            <Field label={t("tenant")} required error={errors.tenantId}>
              <NativeSelect
                name="tenantId"
                required
                options={(tenants ?? []).map((x) => ({ value: x.id, label: x.name }))}
              />
            </Field>
          )}
          <Field label={t("device")} required error={errors.deviceId}>
            <NativeSelect name="deviceId" required options={devices.map((d) => ({ value: d.id, label: d.label }))} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("termMonths")} required error={errors.termMonths}>
              <Input name="termMonths" type="number" min={1} max={120} defaultValue={36} required />
            </Field>
            <Field label={t("acquisitionCost")} required error={errors.acquisitionCost}>
              <Input name="acquisitionCost" inputMode="decimal" pattern="\d+(\.\d{1,2})?" required />
            </Field>
            <Field label={t("monthlyValue")} required error={errors.monthlyValue}>
              <Input name="monthlyValue" inputMode="decimal" pattern="\d+(\.\d{1,2})?" required />
            </Field>
          </div>
        </>
      )}
    </FormDialog>
  );
}

/**
 * The register's moves the API offers (`nextActions`, D-081): install (date), in service, replace
 * (the new device), de-install, write off — confirmed with the serial restated; history is append-only.
 */
export function HaasAssetActions({
  asset,
  replacements,
}: {
  asset: Schemas["HaasAssetDto"];
  replacements: { id: string; label: string }[];
}) {
  const t = useTranslations("admin.billing.hardware");
  const [date, setDate] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [replacement, setReplacement] = useState(replacements[0]?.id ?? "");
  return (
    <div className="flex flex-wrap gap-1">
      {asset.nextActions.map((action) => (
        <ConfirmAction
          key={action}
          label={t(`action.${action}`)}
          size="sm"
          variant={action === "write-off" || action === "deinstall" ? "secondary" : "primary"}
          tone={action === "write-off" ? "destructive" : "primary"}
          testId={`haas-${action}`}
          title={t(`actionTitle.${action}`, { serial: asset.serial })}
          description={t("actionBody", { serial: asset.serial })}
          confirmLabel={t(`action.${action}`)}
          phrase={action === "write-off" ? asset.serial : undefined}
          ready={action !== "replace" || replacement !== ""}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/admin/haas-assets/{assetId}/actions/{action}", {
                params: { path: { assetId: asset.id, action: action as Schemas["HaasAction"] } },
                body: {
                  date: date ?? null,
                  note: note.trim() || null,
                  replacementDeviceId: action === "replace" ? replacement : null,
                },
              }),
            )
          }
          successMessage={t("moved")}
        >
          {action === "install" ? (
            <Field label={t("installedOn")}>
              <DateField name="date" onChange={setDate} />
            </Field>
          ) : null}
          {action === "replace" ? (
            <Field label={t("replacement")} required>
              <NativeSelect
                value={replacement}
                onChange={(event) => setReplacement(event.target.value)}
                options={replacements.map((d) => ({ value: d.id, label: d.label }))}
                placeholder={t("chooseDevice")}
              />
            </Field>
          ) : null}
          <Field label={t("note")}>
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        </ConfirmAction>
      ))}
    </div>
  );
}
