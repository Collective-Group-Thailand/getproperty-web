"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { DateField } from "@/features/shared/console/DateField";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import { problemError } from "@/lib/api/errors";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { LazyDialog } from "@/ui/components/overlays";
import { toast } from "@/ui/components/Toast";
import { IconBill } from "@/ui/icons/glyphs/bill";
import { IconCopy } from "@/ui/icons/glyphs/copy";
import { IconMail } from "@/ui/icons/glyphs/mail";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

import { MONEY } from "../../payments/manualPayment";

/** A landlord's stub building (status external) and its units there, from the portfolio. */
export interface StubBuilding {
  id: string;
  name: string;
  units: { id: string; unitNo: string }[];
}

/**
 * A landlord invites the juristic office of a condo it does not run (D-270): the stub building, which of its own units
 * the office may bill, the office's name. The code and link come back once — copied or shown to the office; the office
 * then sees only those units and bills the common fee to the landlord. Leases and rent stay invisible to it.
 */
export function InviteOfficeButton({ buildings }: { buildings: StubBuilding[] }) {
  const t = useTranslations("owner.collections.office");
  const locale = useLocale() as Locale;
  const [buildingId, setBuildingId] = useState(buildings[0]?.id ?? "");
  const [unitIds, setUnitIds] = useState<string[]>(buildings[0]?.units.map((unit) => unit.id) ?? []);
  const [created, setCreated] = useState<Schemas["WorkspaceInvitationDto"] | null>(null);
  const building = buildings.find((candidate) => candidate.id === buildingId);
  return (
    <>
      <FormDialog
        label={t("invite")}
        icon={IconMail}
        variant="primary"
        testId="office-invite"
        title={t("inviteTitle")}
        description={t("inviteBody")}
        submitLabel={t("inviteSubmit")}
        disabled={buildings.length === 0}
        onSubmit={(data, _ack, key) => {
          const officeName = text(data, "officeName");
          const errors = [
            ...(officeName ? [] : [{ path: "officeName", code: "required", message: t("officeRequired") }]),
            ...(unitIds.length ? [] : [{ path: "unitIds", code: "required", message: t("unitsRequired") }]),
          ];
          if (errors.length) throw problemError(422, { code: "validation.failed", errors });
          const phone = text(data, "officePhone");
          return unwrap(
            browserApi().POST("/v1/owner/juristic-workspace-invitations", {
              params: { header: { "Idempotency-Key": key } },
              body: { buildingId, unitIds, officeName: officeName!, ...(phone ? { officePhone: phone } : {}) },
            }),
          );
        }}
        onDone={(result) => setCreated(result as Schemas["WorkspaceInvitationDto"])}
      >
        {(errors) => (
          <>
            <Field label={t("building")} hint={t("buildingHint")} required>
              <NativeSelect
                value={buildingId}
                onChange={(event) => {
                  setBuildingId(event.target.value);
                  setUnitIds(buildings.find((b) => b.id === event.target.value)?.units.map((unit) => unit.id) ?? []);
                }}
                options={buildings.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
                data-testid="office-building"
              />
            </Field>
            <fieldset className="m-0 flex flex-col gap-1 border-0 p-0">
              <legend className="mb-1 text-sm font-medium">{t("units")}</legend>
              {building?.units.map((unit) => (
                <Checkbox
                  key={unit.id}
                  label={<span className="font-mono">{unit.unitNo}</span>}
                  checked={unitIds.includes(unit.id)}
                  onCheckedChange={(on) =>
                    setUnitIds((current) =>
                      on === true ? [...current, unit.id] : current.filter((id) => id !== unit.id),
                    )
                  }
                />
              ))}
              {errors.unitIds ? (
                <p className="text-muted m-0 text-sm" role="alert">
                  {errors.unitIds}
                </p>
              ) : null}
            </fieldset>
            <Field label={t("officeName")} hint={t("officeNameHint")} required error={errors.officeName}>
              <Input name="officeName" maxLength={200} data-testid="office-name" />
            </Field>
            <Field label={t("officePhone")} hint={t("officePhoneHint")} error={errors.officePhone}>
              <Input name="officePhone" type="tel" inputMode="tel" maxLength={20} />
            </Field>
            <p className="text-muted m-0 text-sm">{t("privacy")}</p>
          </>
        )}
      </FormDialog>
      <LazyDialog
        open={created !== null}
        onOpenChange={(open) => !open && setCreated(null)}
        title={t("codeTitle")}
        closeLabel={t("close")}
      >
        {created?.code ? (
          <div className="flex flex-col gap-4" data-testid="office-code">
            <p className="m-0">{t("codeBody", { office: created.officeName })}</p>
            <div className="border-border bg-bg-subtle rounded-control flex items-center justify-between gap-3 border px-4 py-3">
              <span className="font-mono text-xl font-semibold tracking-widest" data-testid="office-code-value">
                {created.code}
              </span>
              <Button
                size="sm"
                variant="secondary"
                iconStart={IconCopy}
                onClick={() =>
                  void navigator.clipboard?.writeText(created.url ?? created.code ?? "").then(
                    () => toast.success(t("copied")),
                    () => undefined,
                  )
                }
              >
                {t("copyLink")}
              </Button>
            </div>
            {created.url ? <p className="text-muted m-0 text-sm break-all">{created.url}</p> : null}
            <Callout tone="info" size="sm">
              {t("codeOnce", { date: formatDate(created.expiresAt, locale) })}
            </Callout>
            <div className="flex justify-end">
              <Button onClick={() => setCreated(null)}>{t("done")}</Button>
            </div>
          </div>
        ) : null}
      </LazyDialog>
    </>
  );
}

/** Withdraws an invitation, or ends an accepted link (the office loses the units at once; issued bills stay). */
export function RevokeOfficeButton({ invitation }: { invitation: Schemas["WorkspaceInvitationDto"] }) {
  const t = useTranslations("owner.collections.office");
  const [reason, setReason] = useState("");
  return (
    <ConfirmAction
      label={invitation.state === "active" ? t("unlink") : t("withdraw")}
      icon={IconXCircle}
      variant="ghost"
      size="sm"
      tone="destructive"
      testId="office-revoke"
      title={t("revokeTitle", { office: invitation.officeName })}
      description={invitation.state === "active" ? t("unlinkBody") : t("withdrawBody")}
      confirmLabel={invitation.state === "active" ? t("unlink") : t("withdraw")}
      ready={reason.trim().length >= 3}
      successMessage={t("revoked")}
      onConfirm={(key) =>
        unwrap(
          browserApi().POST("/v1/owner/juristic-workspace-invitations/{linkId}/actions/revoke", {
            params: { path: { linkId: invitation.id }, header: { "Idempotency-Key": key } },
            body: { reason: reason.trim() },
          }),
        )
      }
      onDone={() => setReason("")}
    >
      <Field label={t("reason")} required>
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={500} />
      </Field>
    </ConfirmAction>
  );
}

/**
 * The office bills a linked unit's landlord (D-270): one common-fee invoice issued at once with the office's number
 * series and due-date settings; the landlord pays it in LINE like any bill. The amount is typed (the office's own fee).
 */
export function BillLandlordButton({ unit }: { unit: Schemas["WorkspaceUnitDto"] }) {
  const t = useTranslations("owner.collections.workspace");
  const locale = useLocale() as Locale;
  return (
    <FormDialog
      label={t("bill")}
      icon={IconBill}
      size="sm"
      testId="workspace-bill"
      title={t("billTitle", { unit: unit.unitNo })}
      description={t("billBody", { landlord: unit.landlordName })}
      submitLabel={t("billSubmit")}
      onSubmit={(data, _ack, key) => {
        const amount = (text(data, "amount") ?? "").trim();
        const periodStart = text(data, "periodStart");
        const periodEnd = text(data, "periodEnd");
        const errors = [
          ...(MONEY.test(amount) && !/^0+(\.0+)?$/.test(amount)
            ? []
            : [{ path: "amount", code: "invalid", message: t("amountInvalid") }]),
          ...(periodStart ? [] : [{ path: "periodStart", code: "required", message: t("periodRequired") }]),
          ...(periodEnd && periodStart && periodEnd >= periodStart
            ? []
            : [{ path: "periodEnd", code: "invalid", message: t("periodOrder") }]),
        ];
        if (errors.length) throw problemError(422, { code: "validation.failed", errors });
        const description = text(data, "description");
        return unwrap(
          browserApi().POST("/v1/owner/juristic/workspace/units/{unitId}/invoices", {
            params: { path: { unitId: unit.unitId }, header: { "Idempotency-Key": key } },
            body: { amount, periodStart: periodStart!, periodEnd: periodEnd!, ...(description ? { description } : {}) },
          }),
        );
      }}
      onDone={(result) =>
        toast.success(
          t("billed", {
            number: (result as Schemas["InvoiceDto"]).number ?? "",
            amount: formatTHB((result as Schemas["InvoiceDto"]).total, locale),
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("amount")} hint={t("amountHint")} required error={errors.amount}>
            <Input name="amount" inputMode="decimal" data-testid="workspace-bill-amount" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("periodStart")} required error={errors.periodStart}>
              <DateField name="periodStart" defaultValue={null} />
            </Field>
            <Field label={t("periodEnd")} required error={errors.periodEnd}>
              <DateField name="periodEnd" defaultValue={null} />
            </Field>
          </div>
          <Field label={t("description")} hint={t("descriptionHint")}>
            <Input name="description" maxLength={200} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}
