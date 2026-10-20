"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, integer, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

/**
 * A support request from Collective (D-090): approve for a number of hours (capped by
 * `support.grant_max_hours`), deny, or revoke access already given. While a grant is live, Collective
 * staff can read — never change — this tenant's data, and every read is in the audit log.
 */
export function SupportGrantActions({ grant }: { grant: Schemas["SupportGrantDto"] }) {
  const t = useTranslations("owner.settings.support");
  const actions = new Set(grant.nextActions);
  const path = { params: { path: { supportGrantId: grant.id } } };
  return (
    <span className="flex flex-wrap gap-2">
      {actions.has("approve") ? (
        <FormDialog
          label={t("approve")}
          icon={IconCheckCircle}
          variant="primary"
          size="sm"
          testId={`approve-${grant.id}`}
          title={t("approveTitle")}
          description={t("approveBody", { reason: grant.reason })}
          submitLabel={t("approve")}
          successMessage={t("approved")}
          onSubmit={(data) =>
            unwrap(
              browserApi().POST("/v1/owner/support-grants/{supportGrantId}/actions/approve", {
                ...path,
                body: { hours: integer(data, "hours") },
              }),
            )
          }
        >
          {(errors) => (
            <Field label={t("hours")} hint={t("hoursHint")} error={errors.hours}>
              <Input name="hours" type="number" min={1} max={168} defaultValue={4} data-testid="grant-hours" />
            </Field>
          )}
        </FormDialog>
      ) : null}
      {actions.has("deny") ? (
        <ConfirmAction
          label={t("deny")}
          icon={IconXCircle}
          size="sm"
          variant="secondary"
          testId={`deny-${grant.id}`}
          title={t("denyTitle")}
          description={t("denyBody")}
          confirmLabel={t("deny")}
          successMessage={t("denied")}
          onConfirm={() => unwrap(browserApi().POST("/v1/owner/support-grants/{supportGrantId}/actions/deny", path))}
        />
      ) : null}
      {actions.has("revoke") ? (
        <ConfirmAction
          label={t("revoke")}
          icon={IconXCircle}
          size="sm"
          variant="destructive"
          tone="destructive"
          testId={`revoke-${grant.id}`}
          title={t("revokeTitle")}
          description={t("revokeBody")}
          confirmLabel={t("revoke")}
          successMessage={t("revoked")}
          onConfirm={() => unwrap(browserApi().POST("/v1/owner/support-grants/{supportGrantId}/actions/revoke", path))}
        />
      ) : null}
    </span>
  );
}

const REASONS: Schemas["GrantReason"][] = [
  "pm_contract",
  "landlord_unit",
  "owner_portal",
  "contractor",
  "developer_post_sale",
  "warranty",
  "juristic_handover",
  "support_other",
];

/** `POST /v1/owner/asset-grants` — another tenant (a PM company, a contractor) gets access to a building or unit. */
export function CreateAssetGrant({ buildings }: { buildings: { id: string; name: string }[] }) {
  const t = useTranslations("owner.settings.grants");
  return (
    <FormDialog
      label={t("create")}
      icon={IconAdd}
      variant="primary"
      testId="create-grant"
      title={t("createTitle")}
      description={t("createHint")}
      submitLabel={t("create")}
      successMessage={t("created")}
      onSubmit={(data) => {
        const until = text(data, "validTo");
        return unwrap(
          browserApi().POST("/v1/owner/asset-grants", {
            params: { header: { "Idempotency-Key": crypto.randomUUID() } },
            body: {
              granteeTenantId: text(data, "granteeTenantId") ?? "",
              buildingId: text(data, "buildingId") ?? "",
              unitId: text(data, "unitId") ?? null,
              access: (text(data, "access") ?? "read") as Schemas["GrantAccess"],
              reason: (text(data, "reason") ?? "support_other") as Schemas["GrantReason"],
              modules: (text(data, "modules") ?? "")
                .split(",")
                .map((module) => module.trim())
                .filter(Boolean),
              validTo: until ? new Date(`${until}T23:59:59+07:00`).toISOString() : null,
            },
          }),
        );
      }}
    >
      {(errors) => (
        <>
          <Field label={t("grantee")} hint={t("granteeHint")} required error={errors.granteeTenantId}>
            <Input name="granteeTenantId" required pattern="[0-9a-fA-F-]{36}" className="font-mono" />
          </Field>
          <Field label={t("building")} required error={errors.buildingId}>
            <NativeSelect
              name="buildingId"
              options={buildings.map((building) => ({ value: building.id, label: building.name }))}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("access")} error={errors.access}>
              <NativeSelect
                name="access"
                options={(["read", "write"] as const).map((value) => ({ value, label: t(`accessName.${value}`) }))}
              />
            </Field>
            <Field label={t("reason")} error={errors.reason}>
              <NativeSelect
                name="reason"
                options={REASONS.map((value) => ({ value, label: t(`reasonName.${value}`) }))}
              />
            </Field>
          </div>
          <Field label={t("modules")} hint={t("modulesHint")} error={errors.modules}>
            <Input name="modules" />
          </Field>
          <Field label={t("validTo")} hint={t("validToHint")} error={errors.validTo}>
            <Input name="validTo" type="date" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** `POST /v1/owner/asset-grants/{id}/actions/revoke` with a reason. */
export function RevokeAssetGrant({ grant }: { grant: Schemas["AssetGrantDto"] }) {
  const t = useTranslations("owner.settings.grants");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={t("revoke")}
      icon={IconXCircle}
      size="sm"
      variant="destructive"
      tone="destructive"
      testId={`revoke-grant-${grant.id}`}
      title={t("revokeTitle")}
      description={t("revokeBody")}
      confirmLabel={t("revoke")}
      ready={reason.trim().length > 0}
      successMessage={t("revoked")}
      onConfirm={() =>
        unwrap(
          browserApi().POST("/v1/owner/asset-grants/{grantId}/actions/revoke", {
            params: { path: { grantId: grant.id } },
            body: { reason: reason.trim() },
          }),
        )
      }
    >
      <Field label={t("revokeReason")} required>
        <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
    </ConfirmAction>
  );
}
