"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ActionMenu } from "@/features/shared/console/ActionMenu";
import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap, unwrapWithETag } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { StatusText } from "@/ui/components/StatusText";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconDelete } from "@/ui/icons/glyphs/delete";
import { IconEdit } from "@/ui/icons/glyphs/edit";
import { IconRemove } from "@/ui/icons/glyphs/remove";
import { IconWarning } from "@/ui/icons/glyphs/warning";

import { PLAN_KINDS } from "./constants";
import { buildBudgetTier, buildTiers, type BudgetSplit, type TierRow } from "./tiers";

const BASES: Schemas["RateBasis"][] = [
  "per_unit",
  "fixed",
  "per_sqm",
  "per_ownership_ratio",
  "per_sqwa",
  "budget_split",
];
const FREQUENCIES: Schemas["BillingFrequency"][] = ["monthly", "quarterly", "semiannual", "annual"];
const SPLITS: BudgetSplit[] = ["ownership_ratio", "area_sqm", "land_area_sqwa", "per_unit"];
/** Kinds that may be billed less often than monthly (D-303: common fees and funds only). */
const ADVANCE_KINDS = new Set<Schemas["RatePlanKind"]>(["common_fee", "fund"]);

/** An adopted resolution a common-fee / fund version may name (D-304), with its building. */
export interface ResolutionOption {
  id: string;
  buildingId: string;
  label: string;
}

/** How often a plan bills (D-303): monthly for every kind, quarterly / semiannual / annual for common fees and funds. */
function FrequencyField({
  kind,
  defaultValue,
  error,
}: {
  kind: Schemas["RatePlanKind"];
  defaultValue: Schemas["BillingFrequency"];
  error?: string;
}) {
  const t = useTranslations("owner.rates");
  const advance = ADVANCE_KINDS.has(kind);
  return (
    <Field label={t("frequency")} hint={advance ? t("frequencyHint") : t("frequencyMonthlyOnly")} error={error}>
      <NativeSelect
        name="frequency"
        defaultValue={advance ? defaultValue : "monthly"}
        disabled={!advance}
        options={(advance ? FREQUENCIES : (["monthly"] as const)).map((value) => ({
          value,
          label: t(`frequencyName.${value}`),
        }))}
        data-testid="rate-plan-frequency"
      />
    </Field>
  );
}

/** `POST /v1/owner/rate-plans` — a named plan of a kind, for one building or every building. */
export function CreateRatePlan({ buildings }: { buildings: { id: string; name: string }[] }) {
  const t = useTranslations("owner.rates");
  const [kind, setKind] = useState<Schemas["RatePlanKind"]>("power");
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
              frequency: (text(data, "frequency") ?? "monthly") as Schemas["BillingFrequency"],
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
              value={kind}
              onChange={(event) => setKind(event.target.value as Schemas["RatePlanKind"])}
              options={PLAN_KINDS.map((value) => ({ value, label: t(`kindName.${value}`) }))}
              data-testid="rate-plan-kind"
            />
          </Field>
          <FrequencyField key={kind} kind={kind} defaultValue="monthly" error={errors.frequency} />
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
 * `POST /v1/owner/rate-plans/{id}/versions` — prices from a date (today or later): a flat price, tiers, a fixed amount
 * or a budget (a year's or a month's amount shared over the units — `budget_split`, J1.1b), the minimum charge
 * (water). A power/water price above the utility's effective average rate at the representative consumption comes
 * back as the D-021a warning: it is shown with the legal reference and the figures the API compared, and saved only
 * once the owner acknowledges it. A juristic building's common fee / fund version names the adopted resolution that
 * set it (D-304; `rate_plan.resolution_required`).
 */
export function NewRateVersion({
  plan,
  capHint,
  resolutions,
}: {
  plan: Schemas["RatePlanDto"];
  capHint: string | null;
  /** Adopted resolutions of the plan's building — given for a juristic tenant's common-fee / fund plans only. */
  resolutions?: ResolutionOption[];
}) {
  const t = useTranslations("owner.rates");
  const utility = plan.kind === "power" || plan.kind === "water";
  const [mode, setMode] = useState<"flat" | "tiered" | "fixed" | "budget">(utility ? "flat" : "fixed");
  const [basis, setBasis] = useState<Schemas["RateBasis"]>(utility ? "per_unit" : "fixed");
  const [rows, setRows] = useState<TierRow[]>([
    { upTo: "", pricePerUnit: "" },
    { upTo: "", pricePerUnit: "" },
  ]);
  const needsResolution = resolutions !== undefined && ADVANCE_KINDS.has(plan.kind);
  const choices = (resolutions ?? []).filter((option) => !plan.buildingId || option.buildingId === plan.buildingId);
  const modes = utility ? (["flat", "tiered"] as const) : (["fixed", "flat", "tiered", "budget"] as const);
  const chooseBasis = (next: Schemas["RateBasis"]) => {
    setBasis(next);
    // The basis decides the price shape it reads: a budget split is a budget, a price per ตร.วา a flat price.
    if (next === "budget_split") setMode("budget");
    else if (next === "per_sqwa" || next === "per_sqm") setMode("flat");
    else if (mode === "budget") setMode(next === "fixed" ? "fixed" : "flat");
  };
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
        const resolutionId = text(data, "resolutionId");
        if (needsResolution && !resolutionId) invalidField("resolutionId", t("resolutionRequired"));
        const built =
          mode === "budget"
            ? buildBudgetTier({
                amount: text(data, "amount") ?? "",
                period: text(data, "period") === "month" ? "month" : "year",
                splitBy:
                  basis === "budget_split" ? ((text(data, "splitBy") ?? "ownership_ratio") as BudgetSplit) : undefined,
              })
            : buildTiers(
                mode === "flat"
                  ? { mode, price: text(data, "price") ?? "" }
                  : mode === "fixed"
                    ? { mode, amount: text(data, "amount") ?? "" }
                    : { mode, rows },
                plan.kind,
              );
        if ("error" in built)
          invalidField(built.error === "amount" ? "tiers.amount" : "tiers", t(`tierError.${built.error}`));
        return unwrap(
          browserApi().POST("/v1/owner/rate-plans/{ratePlanId}/versions", {
            params: { path: { ratePlanId: plan.id } },
            body: {
              basis,
              tiers: built.tiers as Record<string, unknown>,
              effectiveFrom: text(data, "effectiveFrom"),
              minimumCharge: text(data, "minimumCharge") ?? null,
              note: text(data, "note"),
              ...(resolutionId ? { resolutionId } : {}),
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
            <Field label={t("basis")} error={errors.basis}>
              <NativeSelect
                value={basis}
                onChange={(event) => chooseBasis(event.target.value as Schemas["RateBasis"])}
                options={BASES.map((value) => ({ value, label: t(`basisName.${value}`) }))}
                data-testid="version-basis"
              />
            </Field>
            <Field label={t("priceMode")} required>
              <NativeSelect
                value={mode}
                onChange={(event) => setMode(event.target.value as typeof mode)}
                disabled={basis === "budget_split"}
                options={modes.map((value) => ({ value, label: t(`mode.${value}`) }))}
                data-testid="price-mode"
              />
            </Field>
          </div>
          {mode === "flat" ? (
            <Field
              label={t("pricePerUnit", {
                unit: t(
                  `unit.${plan.kind === "water" ? "m3" : plan.kind === "power" ? "kwh" : basis === "per_sqwa" ? "sqwa" : basis === "per_sqm" ? "sqm" : "unit"}`,
                ),
              })}
              required
              error={errors["tiers.pricePerUnit"] ?? errors.tiers}
            >
              <Input name="price" inputMode="decimal" required data-testid="version-price" />
            </Field>
          ) : null}
          {mode === "fixed" ? (
            <Field label={t("amount")} required error={errors["tiers.amount"]}>
              <Input name="amount" inputMode="decimal" required data-testid="version-amount" />
            </Field>
          ) : null}
          {mode === "budget" ? (
            <div className="grid gap-4 sm:grid-cols-2" data-testid="budget-tier">
              <Field label={t("budgetAmount")} hint={t("budgetAmountHint")} required error={errors["tiers.amount"]}>
                <Input name="amount" inputMode="decimal" required data-testid="version-amount" />
              </Field>
              <Field label={t("budgetPeriod")} error={errors["tiers.period"]}>
                <NativeSelect
                  name="period"
                  defaultValue="year"
                  options={(["year", "month"] as const).map((value) => ({
                    value,
                    label: t(`budgetPeriodName.${value}`),
                  }))}
                  data-testid="version-period"
                />
              </Field>
              {basis === "budget_split" ? (
                <Field label={t("splitBy")} hint={t("splitByHint")} error={errors["tiers.splitBy"]}>
                  <NativeSelect
                    name="splitBy"
                    options={SPLITS.map((value) => ({ value, label: t(`splitByName.${value}`) }))}
                    data-testid="version-split"
                  />
                </Field>
              ) : null}
            </div>
          ) : null}
          {mode === "tiered" ? (
            <fieldset className="flex flex-col gap-2" data-testid="tier-editor">
              <legend className="text-sm font-medium">{t("tiers")}</legend>
              <p className="text-muted text-sm">{t("tiersHint")}</p>
              {errors.tiers ? (
                <StatusText tone="danger" icon={IconWarning} testId="tier-error">
                  {errors.tiers}
                </StatusText>
              ) : null}
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
          {needsResolution ? (
            <Field
              label={t("resolution")}
              hint={choices.length ? t("resolutionHint") : t("resolutionNone")}
              required
              error={errors.resolutionId}
            >
              <NativeSelect
                name="resolutionId"
                required
                placeholder={t("resolutionPick")}
                options={choices.map((option) => ({ value: option.id, label: option.label }))}
                data-testid="version-resolution"
              />
            </Field>
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
            body: {
              name: text(data, "name"),
              isDefault: data.get("isDefault") === "on",
              ...(ADVANCE_KINDS.has(plan.kind)
                ? { frequency: (text(data, "frequency") ?? plan.frequency) as Schemas["BillingFrequency"] }
                : {}),
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("name")} required error={errors.name}>
            <Input name="name" required defaultValue={plan.name} />
          </Field>
          <FrequencyField kind={plan.kind} defaultValue={plan.frequency} error={errors.frequency} />
          <Checkbox name="isDefault" label={t("isDefault")} defaultChecked={plan.isDefault} />
          {ADVANCE_KINDS.has(plan.kind) ? <p className="text-muted m-0 text-sm">{t("frequencyNext")}</p> : null}
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

/** A rate card's "⋯" (G3 revision): rename and delete (destructive, last) — the card keeps "new price" in view. */
export function RatePlanMenu({ plan }: { plan: Schemas["RatePlanDto"] }) {
  const t = useTranslations("owner.rates");
  return (
    <ActionMenu label={t("planMenu", { name: plan.name })} testId={`plan-menu-${plan.id}`}>
      <EditRatePlan plan={plan} />
      <DeleteRatePlan plan={plan} />
    </ActionMenu>
  );
}
