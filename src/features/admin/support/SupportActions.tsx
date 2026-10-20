"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconKey } from "@/ui/icons/glyphs/key";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

/**
 * Ask a tenant's Owner for time-boxed, read-only access (D-090, `POST /v1/admin/tenants/{id}/support-grants`):
 * the reason and the ticket are shown to the Owner, who approves in the owner console.
 */
export function RequestSupportGrant({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const t = useTranslations("admin.support");
  return (
    <FormDialog
      label={t("request")}
      icon={IconAdd}
      variant="primary"
      testId="request-grant"
      title={t("requestTitle", { name: tenantName })}
      description={t("requestHint")}
      submitLabel={t("request")}
      successMessage={t("requested")}
      onSubmit={(data) =>
        unwrap(
          browserApi().POST("/v1/admin/tenants/{tenantId}/support-grants", {
            params: { path: { tenantId } },
            body: { reason: text(data, "reason") ?? "", ticketRef: text(data, "ticketRef") ?? null },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("reason")} required error={errors.reason}>
            <Textarea name="reason" rows={3} required data-testid="grant-reason" />
          </Field>
          <Field label={t("ticket")} error={errors.ticketRef}>
            <Input name="ticketRef" autoComplete="off" />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/**
 * A grant's next steps the API offers: approve for an incident without the Owner (platform admin
 * only, `support.grant_max_hours` caps the hours) or revoke at once — both restate the tenant.
 */
export function GrantActions({ grant, tenantName }: { grant: Schemas["SupportGrantDto"]; tenantName: string }) {
  const t = useTranslations("admin.support");
  const [hours, setHours] = useState("4");
  const path = { params: { path: { supportGrantId: grant.id } } };
  return (
    <div className="flex flex-wrap gap-1">
      {grant.nextActions.includes("approve-incident") ? (
        <ConfirmAction
          label={t("approveIncident")}
          icon={IconKey}
          size="sm"
          testId="approve-incident"
          title={t("approveTitle", { name: tenantName })}
          description={t("approveBody", { name: tenantName, reason: grant.reason })}
          confirmLabel={t("approveIncident")}
          phrase={grant.ticketRef ?? undefined}
          ready={/^\d{1,3}$/.test(hours)}
          onConfirm={() =>
            unwrap(
              browserApi().POST("/v1/admin/support-grants/{supportGrantId}/actions/approve-incident", {
                ...path,
                body: { hours: Number(hours) },
              }),
            )
          }
          successMessage={t("approved")}
        >
          <Field label={t("hours")} hint={t("hoursHint")} required>
            <Input type="number" min={1} max={168} value={hours} onChange={(event) => setHours(event.target.value)} />
          </Field>
        </ConfirmAction>
      ) : null}
      {grant.nextActions.includes("revoke") ? (
        <ConfirmAction
          label={t("revoke")}
          icon={IconXCircle}
          size="sm"
          variant="secondary"
          tone="destructive"
          testId="revoke-grant"
          title={t("revokeTitle", { name: tenantName })}
          description={t("revokeBody", { name: tenantName })}
          confirmLabel={t("revoke")}
          onConfirm={() => unwrap(browserApi().POST("/v1/admin/support-grants/{supportGrantId}/actions/revoke", path))}
          successMessage={t("revoked")}
        />
      ) : null}
    </div>
  );
}
