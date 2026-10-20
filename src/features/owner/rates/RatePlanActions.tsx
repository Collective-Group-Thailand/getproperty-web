"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap, unwrapWithETag } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconRemove } from "@/ui/icons/glyphs/remove";

import { PLAN_KINDS } from "./constants";
import { buildTiers, type TierRow } from "./tiers";

const BASES: Schemas["RateBasis"][] = ["per_unit", "fixed", "per_sqm", "per_ownership_ratio"];

/** `POST /v1/owner/rate-plans` — a named plan of a kind, for one building or every building. */
export function CreateRatePlan({ buildings }: { buildings: { id: string; name: string }[] }) {
  const t = useTranslations("owner.rates");
  return (
    <FormDialog
      label={t("create")}
      icon={IconAdd}
      variant="primary"
      testId="create-rate-plan"
      title={t("createTitle")}
      description={t("createHint")}
      submitLabel={t("create")}
      successMessage={t("created")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/owner/rate-plans", {
            body: {
              name: text(data, "name") ?? "",
              kind: (text(data, "kind") ?? "power") as Schemas["RatePlanKind"],
              buildingId: text(data, "buildingId") ?? null,
              isDefault: data.get("isDefault") === "on",
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("name")} required error={errors.name}>
            <Input name="name" required data-testid="rate-plan-name" />
          </Field>
          <Field label={t("kind")} required error={errors.kind}>
            <NativeSelect
              name="kind"
              options={PLAN_KINDS.map((kind) => ({ value: kind, label: t(`kindName.${kind}`) }))}
              data-testid="rate-plan-kind"
            />
          </Field>
          <Field label={t("building")} hint={t("buildingHint")} error={errors.buildingId}>
            <NativeSelect
              name="buildingId"
              options={[
                { value: "", label: t("allBuildings") },
                ...buildings.map((building) => ({ value: building.id, label: building.name })),
              ]}
            />
          </Field>
          <Checkbox name="isDefault" label={t("isDefault")} description={t("isDefaultHint")} />
        </>
      )}
    </FormDialog>
  );
}

/**
 * `POST /v1/owner/rate-plans/{id}/versions` — prices from a date (today or later): a flat price, tiers or
 * a fixed amount, the minimum charge (water). A power/water price above the utility's effective
 * average rate at the representative consumption comes back as the D-021a warning: it is shown with the
 * legal reference and the figures the API compared, and saved only once the owner acknowledges it.
 */
export function NewRateVersion({ plan, capHint }: { plan: Schemas["RatePlanDto"]; capHint: string | null }) {
  const t = useTranslations("owner.rates");
  const utility = plan.kind === "power" || plan.kind === "water";
  const [mode, setMode] = useState<"flat" | "tiered" | "fixed">(utility ? "flat" : "fixed");
  const [rows, setRows] = useState<TierRow[]>([
    { upTo: "", pricePerUnit: "" },
    { upTo: "", pricePerUnit: "" },
  ]);
  return (
    <FormDialog
      label={t("newVersion")}
      icon={IconEdit}
      size="sm"
      testId={`new-version-${plan.id}`}
      title={t("newVersionTitle", { name: plan.name })}
      description={t("newVersionHint")}
      submitLabel={t("save")}
      successMessage={t("versionSaved")}
      size_="lg"
      onSubmit={(data, acknowledgementIds) => {
        const built = buildTiers(
          mode === "flat"
            ? { mode, price: text(data, "price") ?? "" }
            : mode === "fixed"
              ? { mode, amount: text(data, "amount") ?? "" }
              : { mode, rows },
          plan.kind,
        );
        if ("error" in built) return Promise.reject(new Error(t(`tierError.${built.error}`)));
        return unwrap(
          browserApi().POST("/v1/owner/rate-plans/{ratePlanId}/versions", {
            params: { path: { ratePlanId: plan.id } },
            body: {
              basis: (text(data, "basis") ?? (mode === "fixed" ? "fixed" : "per_unit")) as Schemas["RateBasis"],
              tiers: built.tiers as Record<string, unknown>,
              effectiveFrom: text(data, "effectiveFrom"),
              minimumCharge: text(data, "minimumCharge") ?? null,
              note: text(data, "note"),
              acknowledgementIds: acknowledgementIds.length ? acknowledgementIds : undefined,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          {capHint ? (
            <p className="text-muted text-sm" data-testid="cap-hint">
              {capHint}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("priceMode")} required>
              <NativeSelect
                value={mode}
                onChange={(event) => setMode(event.target.value as typeof mode)}
                options={(utility ? (["flat", "tiered"] as const) : (["fixed", "flat", "tiered"] as const)).map(
                  (value) => ({
                    value,
                    label: t(`mode.${value}`),
                  }),
                )}
                data-testid="price-mode"
              />
            </Field>
            <Field label={t("basis")} error={errors.basis}>
              <NativeSelect
                name="basis"
                defaultValue={mode === "fixed" ? "fixed" : "per_unit"}
                options={BASES.map((basis) => ({ value: basis, label: t(`basisName.${basis}`) }))}
              />
            </Field>
          </div>
          {mode === "flat" ? (
            <Field
              label={t("pricePerUnit", {
                unit: t(`unit.${plan.kind === "water" ? "m3" : plan.kind === "power" ? "kwh" : "unit"}`),
              })}
              required
              error={errors["tiers.pricePerUnit"]}
            >
              <Input name="price" inputMode="decimal" required data-testid="version-price" />
            </Field>
          ) : null}
          {mode === "fixed" ? (
            <Field label={t("amount")} required error={errors["tiers.amount"]}>
              <Input name="amount" inputMode="decimal" required data-testid="version-amount" />
            </Field>
          ) : null}
          {mode === "tiered" ? (
            <fieldset className="flex flex-col gap-2" data-testid="tier-editor">
              <legend className="text-sm font-medium">{t("tiers")}</legend>
              <p className="text-muted text-sm">{t("tiersHint")}</p>
              {rows.map((row, index) => (
                <div key={index} className="flex items-end gap-2">
                  <Field label={t("upTo")} className="flex-1">
                    <Input
                      inputMode="decimal"
                      value={row.upTo}
                      placeholder={index === rows.length - 1 ? t("openEnded") : undefined}
                      onChange={(event) =>
                        setRows(rows.map((r, i) => (i === index ? { ...r, upTo: event.target.value } : r)))
                      }
                      data-testid={`tier-upto-${index}`}
                    />
                  </Field>
                  <Field label={t("tierPrice")} className="flex-1">
                    <Input
                      inputMode="decimal"
                      value={row.pricePerUnit}
                      onChange={(event) =>
                        setRows(rows.map((r, i) => (i === index ? { ...r, pricePerUnit: event.target.value } : r)))
                      }
                      data-testid={`tier-price-${index}`}
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    size="sm"
                    iconStart={IconRemove}
                    disabled={rows.length < 2}
                    onClick={() => setRows(rows.filter((_, i) => i !== index))}
                  >
                    <span className="sr-only">{t("removeTier", { index: index + 1 })}</span>
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                iconStart={IconAdd}
                onClick={() => setRows([...rows, { upTo: "", pricePerUnit: "" }])}
              >
                {t("addTier")}
              </Button>
            </fieldset>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("effectiveFrom")} hint={t("effectiveFromHint")} error={errors.effectiveFrom}>
              <Input name="effectiveFrom" type="date" data-testid="version-from" />
            </Field>
            {plan.kind === "water" ? (
              <Field label={t("minimumCharge")} hint={t("minimumChargeHint")} error={errors.minimumCharge}>
                <Input name="minimumCharge" inputMode="decimal" />
              </Field>
            ) : null}
          </div>
          <Field label={t("note")} error={errors.note}>
            <Textarea name="note" rows={2} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** `PATCH /v1/owner/rate-plans/{id}` with the plan's current `ETag` (read just before) — rename or make default. */
export function EditRatePlan({ plan }: { plan: Schemas["RatePlanDto"] }) {
  const t = useTranslations("owner.rates");
  return (
    <FormDialog
      label={t("rename")}
      icon={IconEdit}
      size="sm"
      variant="ghost"
      testId={`edit-plan-${plan.id}`}
      title={t("renameTitle", { name: plan.name })}
      submitLabel={t("save")}
      successMessage={t("saved")}
      onSubmit={async (data) => {
        const current = await unwrapWithETag(
          browserApi().GET("/v1/owner/rate-plans/{ratePlanId}", { params: { path: { ratePlanId: plan.id } } }),
        );
        return unwrap(
          browserApi().PATCH("/v1/owner/rate-plans/{ratePlanId}", {
            params: { path: { ratePlanId: plan.id }, header: { "If-Match": current.etag ?? "*" } },
            body: { name: text(data, "name"), isDefault: data.get("isDefault") === "on" },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("name")} required error={errors.name}>
            <Input name="name" required defaultValue={plan.name} />
          </Field>
          <Checkbox name="isDefault" label={t("isDefault")} defaultChecked={plan.isDefault} />
        </>
      )}
    </FormDialog>
  );
}

/** `DELETE /v1/owner/rate-plans/{id}` — only a plan no lease or invoice uses; the API refuses otherwise. */
export function DeleteRatePlan({ plan }: { plan: Schemas["RatePlanDto"] }) {
  const t = useTranslations("owner.rates");
  return (
    <ConfirmAction
      label={t("delete")}
      icon={IconDelete}
      size="sm"
      variant="ghost"
      tone="destructive"
      testId={`delete-plan-${plan.id}`}
      title={t("deleteTitle", { name: plan.name })}
      description={t("deleteBody")}
      confirmLabel={t("delete")}
      phrase={plan.name}
      successMessage={t("deleted")}
      onConfirm={() =>
        unwrap(browserApi().DELETE("/v1/owner/rate-plans/{ratePlanId}", { params: { path: { ratePlanId: plan.id } } }))
      }
    />
  );
}
