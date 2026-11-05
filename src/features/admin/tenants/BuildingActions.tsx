"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { FormDialog, invalidField, text } from "@/features/shared/console/FormDialog";
import { LEGAL_FORMS, PROPERTY_KINDS } from "@/domain/juristic/vocabulary";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconSwap } from "@/ui/icons/glyphs/swap";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REASONS: Schemas["OperatorChangeReason"][] = [
  "juristic_formed",
  "pm_contract_start",
  "pm_contract_end",
  "handover",
  "other",
];

export interface OperatorOption {
  id: string;
  name: string;
  juristic: boolean;
}

/**
 * A juristic person takes over a stub building (D-280): the condo (or a housing estate's soi) its landlords created
 * before the office joined. The property's kind and the building's legal form are named here (default condominium /
 * Condominium Act); the landlords keep their units and leases. The stub's id comes from support (no stub list yet —
 * contract request).
 */
export function ClaimStubButton({
  tenant,
  operators,
  secondary = false,
}: {
  tenant: { id: string; name: string };
  operators: OperatorOption[];
  /** Outlined (inside an empty state). */
  secondary?: boolean;
}) {
  const t = useTranslations("admin.tenants.buildings");
  const kinds = useTranslations("admin.tenants.buildings.kindName");
  const forms = useTranslations("admin.tenants.buildings.legalFormName");
  return (
    <FormDialog
      label={t("claim")}
      icon={IconBuilding}
      variant={secondary ? "secondary" : "primary"}
      testId="claim-stub"
      title={t("claimTitle", { name: tenant.name })}
      description={t("claimHint")}
      submitLabel={t("claimSubmit")}
      successMessage={t("claimed")}
      onSubmit={(data, _ack, idempotencyKey) => {
        const buildingId = text(data, "buildingId") ?? "";
        if (!UUID.test(buildingId)) invalidField("buildingId", t("buildingIdInvalid"));
        const operatorTenantId = text(data, "operatorTenantId");
        return unwrap(
          browserApi().POST("/v1/admin/buildings/{buildingId}/actions/claim-stub", {
            params: { path: { buildingId }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              ownerTenantId: tenant.id,
              ...(operatorTenantId ? { operatorTenantId } : {}),
              propertyKind: (text(data, "propertyKind") ?? "condo") as Schemas["PropertyKind"],
              legalForm: (text(data, "legalForm") ?? "condo_act") as Schemas["BuildingLegalForm"],
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("buildingId")} hint={t("buildingIdHint")} required error={errors.buildingId}>
            <Input
              name="buildingId"
              required
              autoComplete="off"
              className="font-mono"
              data-testid="claim-building-id"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("propertyKind")} error={errors.propertyKind}>
              <NativeSelect
                name="propertyKind"
                defaultValue="condo"
                options={PROPERTY_KINDS.filter((kind) => kind !== "apartment").map((kind) => ({
                  value: kind,
                  label: kinds(kind),
                }))}
                data-testid="claim-kind"
              />
            </Field>
            <Field label={t("legalForm")} error={errors.legalForm}>
              <NativeSelect
                name="legalForm"
                defaultValue="condo_act"
                options={LEGAL_FORMS.map((form) => ({ value: form, label: forms(form) }))}
                data-testid="claim-legal-form"
              />
            </Field>
          </div>
          <Field label={t("operator")} hint={t("operatorHint")} error={errors.operatorTenantId}>
            <NativeSelect
              name="operatorTenantId"
              options={[
                { value: "", label: t("operatorSelf") },
                ...operators
                  .filter((operator) => operator.id !== tenant.id)
                  .map((operator) => ({ value: operator.id, label: operator.name })),
              ]}
            />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** Moves a building to another operator (D-152); a juristic operator needs the building's legal form if it has none. */
export function ChangeOperatorButton({
  building,
  operators,
}: {
  building: Schemas["AdminBuildingDto"];
  operators: OperatorOption[];
}) {
  const t = useTranslations("admin.tenants.buildings");
  const forms = useTranslations("admin.tenants.buildings.legalFormName");
  const [operatorId, setOperatorId] = useState("");
  const juristic = operators.find((operator) => operator.id === operatorId)?.juristic ?? false;
  return (
    <FormDialog
      label={t("changeOperator")}
      icon={IconSwap}
      size="sm"
      variant="ghost"
      testId={`change-operator-${building.id}`}
      title={t("changeTitle", { name: building.name })}
      description={t("changeHint")}
      submitLabel={t("changeSubmit")}
      successMessage={t("changed")}
      onSubmit={(data, _ack, idempotencyKey) => {
        if (!operatorId) invalidField("operatorTenantId", t("operatorRequired"));
        const legalForm = text(data, "legalForm") as Schemas["BuildingLegalForm"] | undefined;
        const sourceRef = text(data, "sourceRef");
        return unwrap(
          browserApi().POST("/v1/admin/buildings/{buildingId}/actions/change-operator", {
            params: { path: { buildingId: building.id }, header: { "Idempotency-Key": idempotencyKey } },
            body: {
              operatorTenantId: operatorId,
              reason: (text(data, "reason") ?? "other") as Schemas["OperatorChangeReason"],
              ...(legalForm ? { legalForm } : {}),
              ...(sourceRef ? { sourceRef } : {}),
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("operator")} required error={errors.operatorTenantId}>
            <NativeSelect
              value={operatorId}
              onChange={(event) => setOperatorId(event.target.value)}
              placeholder={t("operatorPick")}
              options={operators.map((operator) => ({ value: operator.id, label: operator.name }))}
              data-testid="change-operator-tenant"
            />
          </Field>
          <Field label={t("reason")} error={errors.reason}>
            <NativeSelect
              name="reason"
              options={REASONS.map((reason) => ({ value: reason, label: t(`reasonName.${reason}`) }))}
            />
          </Field>
          {juristic ? (
            <Field label={t("legalForm")} hint={t("legalFormHint")} error={errors.legalForm}>
              <NativeSelect
                name="legalForm"
                placeholder={t("legalFormKeep")}
                options={LEGAL_FORMS.map((form) => ({ value: form, label: forms(form) }))}
                data-testid="change-operator-legal-form"
              />
            </Field>
          ) : null}
          <Field label={t("sourceRef")} hint={t("sourceRefHint")} error={errors.sourceRef}>
            <Input name="sourceRef" maxLength={80} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
