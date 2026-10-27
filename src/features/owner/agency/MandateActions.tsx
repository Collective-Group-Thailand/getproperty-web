"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokToday } from "@/features/shared/console/time";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Switch } from "@/ui/components/Switch";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconCheck } from "@/ui/icons/glyphs/check";
import { IconClose } from "@/ui/icons/glyphs/close";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

const SCOPES: Schemas["MandateScope"][] = ["list", "list_and_lease", "manage"];

/**
 * Invite an agency to one of my units (G2, D-293): the unit from the portfolio, the agency found by name
 * (`GET /v1/owner/agencies?q=`), scope, exclusive, commission (text, % of one month's rent or a fixed amount — recorded
 * only, paid outside the platform) and validity. One Idempotency-Key per dialog opening.
 */
export function InviteAgency({
  units,
  defaultUnitId,
}: {
  units: { id: string; label: string }[];
  defaultUnitId?: string;
}) {
  const t = useTranslations("owner.agency");
  const [q, setQ] = useState("");
  const [agencies, setAgencies] = useState<Schemas["AgencyDto"][]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      void unwrap(browserApi().GET("/v1/owner/agencies", { params: { query: { q: term } } }))
        .then((found) => {
          setAgencies(found.data);
          setSearched(true);
        })
        .catch(() => setSearched(true));
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <FormDialog
      label={t("mandates.invite")}
      icon={IconAdd}
      variant="primary"
      size_="lg"
      testId="mandate-invite"
      defaultOpen={Boolean(defaultUnitId)}
      title={t("mandates.inviteTitle")}
      description={t("mandates.inviteHint")}
      submitLabel={t("mandates.invite")}
      successMessage={t("mandates.invited")}
      onSubmit={(data, _ack, idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/mandates", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: {
              unitId: text(data, "unitId") ?? "",
              agencyTenantId: text(data, "agencyTenantId") ?? "",
              scope: (text(data, "scope") as Schemas["MandateScope"]) ?? "list",
              exclusive: data.get("exclusive") === "on",
              commissionTerms: text(data, "commissionTerms") ?? null,
              commissionPercent: text(data, "commissionPercent")?.replace(/,/g, "") ?? null,
              commissionAmount: text(data, "commissionAmount")?.replace(/,/g, "") ?? null,
              validFrom: text(data, "validFrom") ?? bangkokToday(),
              validTo: text(data, "validTo") ?? null,
            },
          }),
        )
      }
    >
      {(errors) => (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("mandates.fields.unit")} required error={errors.unitId} className="sm:col-span-2">
            <NativeSelect
              name="unitId"
              defaultValue={defaultUnitId}
              options={units.map((unit) => ({ value: unit.id, label: unit.label }))}
              data-testid="mandate-unit"
            />
          </Field>
          <Field
            label={t("mandates.fields.agencySearch")}
            hint={t("mandates.fields.agencyHint")}
            className="sm:col-span-2"
          >
            <Input
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              data-testid="mandate-agency-search"
            />
          </Field>
          <Field
            label={t("mandates.fields.agency")}
            required
            error={errors.agencyTenantId}
            hint={searched && agencies.length === 0 ? t("mandates.fields.noAgency") : undefined}
            className="sm:col-span-2"
          >
            <NativeSelect
              name="agencyTenantId"
              required
              options={agencies.map((agency) => ({ value: agency.id, label: agency.displayName }))}
              data-testid="mandate-agency"
            />
          </Field>
          <Field label={t("mandates.fields.scope")} required error={errors.scope} className="sm:col-span-2">
            <NativeSelect
              name="scope"
              options={SCOPES.map((value) => ({ value, label: `${t(`scope.${value}`)} — ${t(`scopeHint.${value}`)}` }))}
              data-testid="mandate-scope"
            />
          </Field>
          <div className="sm:col-span-2">
            <Switch
              name="exclusive"
              label={t("mandates.fields.exclusive")}
              description={t("mandates.fields.exclusiveHint")}
            />
          </div>
          <Field label={t("mandates.fields.commissionTerms")} error={errors.commissionTerms} className="sm:col-span-2">
            <Textarea name="commissionTerms" rows={2} />
          </Field>
          <Field
            label={t("mandates.fields.commissionPercent")}
            hint={t("mandates.fields.commissionHint")}
            error={errors.commissionPercent}
          >
            <Input
              name="commissionPercent"
              inputMode="decimal"
              className="tabular-nums"
              data-testid="mandate-percent"
            />
          </Field>
          <Field label={t("mandates.fields.commissionAmount")} error={errors.commissionAmount}>
            <Input name="commissionAmount" inputMode="decimal" className="tabular-nums" />
          </Field>
          <Field label={t("mandates.fields.validFrom")} error={errors.validFrom}>
            <Input name="validFrom" type="date" min={bangkokToday()} defaultValue={bangkokToday()} />
          </Field>
          <Field label={t("mandates.fields.validTo")} error={errors.validTo}>
            <Input name="validTo" type="date" min={bangkokToday()} />
          </Field>
        </div>
      )}
    </FormDialog>
  );
}

function ReasonField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const t = useTranslations("owner.agency.mandates");
  return (
    <Field label={t("reason")}>
      <Textarea
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        data-testid="mandate-reason"
      />
    </Field>
  );
}

/** The agency answers an invitation (G2): accept restates unit, scope, exclusivity, commission and owner. */
export function AnswerMandate({ mandate, summary }: { mandate: Schemas["MandateDto"]; summary: string }) {
  const t = useTranslations("owner.agency.mandates");
  const [reason, setReason] = useState("");
  const path = { mandateId: mandate.id };
  return (
    <span className="flex flex-wrap gap-2">
      <ConfirmAction
        label={t("accept")}
        icon={IconCheck}
        size="sm"
        testId="mandate-accept"
        title={t("acceptTitle", { unitNo: mandate.unitNo })}
        description={summary}
        confirmLabel={t("accept")}
        successMessage={t("accepted")}
        onConfirm={(idempotencyKey) =>
          unwrap(
            browserApi().POST("/v1/owner/mandates/{mandateId}/actions/accept", {
              params: { path, header: { "Idempotency-Key": idempotencyKey } },
            }),
          )
        }
      />
      <ConfirmAction
        label={t("decline")}
        icon={IconClose}
        size="sm"
        variant="secondary"
        tone="destructive"
        testId="mandate-decline"
        title={t("declineTitle", { unitNo: mandate.unitNo })}
        description={t("declineBody")}
        confirmLabel={t("decline")}
        successMessage={t("declined")}
        onConfirm={() =>
          unwrap(
            browserApi().POST("/v1/owner/mandates/{mandateId}/actions/decline", {
              params: { path },
              body: { reason: reason.trim() || null },
            }),
          )
        }
      >
        <ReasonField value={reason} onChange={setReason} />
      </ConfirmAction>
    </span>
  );
}

/**
 * Revoke (owner) or end (either party) a mandate (G2, D-293): access ends at once and the agency's listing of the
 * unit closes, so the dialog asks for the unit number typed (design-system §4) and sends an Idempotency-Key.
 */
export function StopMandate({ mandate, mode }: { mandate: Schemas["MandateDto"]; mode: "revoke" | "end" }) {
  const t = useTranslations("owner.agency.mandates");
  const [reason, setReason] = useState("");
  const path = { mandateId: mandate.id };
  return (
    <ConfirmAction
      label={t(mode)}
      icon={IconXCircle}
      size="sm"
      variant="secondary"
      tone="destructive"
      testId={`mandate-${mode}`}
      title={
        mode === "revoke"
          ? t("revokeTitle", { unitNo: mandate.unitNo, agency: mandate.agencyName })
          : t("endTitle", { unitNo: mandate.unitNo })
      }
      description={mode === "revoke" ? t("revokeBody") : t("endBody")}
      phrase={mandate.unitNo}
      confirmLabel={t(mode)}
      successMessage={mode === "revoke" ? t("revoked") : t("ended")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          mode === "revoke"
            ? browserApi().POST("/v1/owner/mandates/{mandateId}/actions/revoke", {
                params: { path, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason: reason.trim() || null },
              })
            : browserApi().POST("/v1/owner/mandates/{mandateId}/actions/end", {
                params: { path, header: { "Idempotency-Key": idempotencyKey } },
                body: { reason: reason.trim() || null },
              }),
        )
      }
    >
      <ReasonField value={reason} onChange={setReason} />
    </ConfirmAction>
  );
}
