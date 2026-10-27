"use client";

import { useLocale, useTranslations } from "next-intl";

import { ConfirmAction } from "@/features/shared/console/ConfirmAction";
import { FormDialog, text } from "@/features/shared/console/FormDialog";
import { bangkokToday } from "@/features/shared/console/time";
import { formatPercent } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Field } from "@/ui/components/Field";
import { Input, Textarea } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconSign } from "@/ui/icons/glyphs/sign";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";

/** Propose a co-broke agreement on one of my listings (G2, D-293 (6)); the co-agency signs it in getproperty. */
export function ProposeCoBroke({
  listings,
  agencies,
}: {
  listings: { id: string; label: string }[];
  agencies: Schemas["AgencyDto"][];
}) {
  const t = useTranslations("owner.agency.coBroke");
  return (
    <FormDialog
      label={t("propose")}
      icon={IconAdd}
      variant="primary"
      testId="co-broke-propose"
      title={t("proposeTitle")}
      description={t("proposeHint")}
      submitLabel={t("propose")}
      successMessage={t("proposed")}
      onSubmit={(data, _ack, idempotencyKey) =>
        unwrap(
          browserApi().POST("/v1/owner/co-broke-agreements", {
            params: { header: { "Idempotency-Key": idempotencyKey } },
            body: {
              listingId: text(data, "listingId") ?? "",
              coAgencyTenantId: text(data, "coAgencyTenantId") ?? "",
              splitPercent: (text(data, "splitPercent") ?? "").replace(/,/g, ""),
              validFrom: text(data, "validFrom") ?? bangkokToday(),
              validTo: text(data, "validTo") ?? null,
              note: text(data, "note") ?? null,
            },
          }),
        )
      }
    >
      {(errors) => (
        <>
          <Field label={t("fields.listing")} required error={errors.listingId}>
            <NativeSelect name="listingId" options={listings.map((l) => ({ value: l.id, label: l.label }))} />
          </Field>
          <Field label={t("fields.coAgency")} required error={errors.coAgencyTenantId}>
            <NativeSelect
              name="coAgencyTenantId"
              options={agencies.map((a) => ({ value: a.id, label: a.displayName }))}
              data-testid="co-broke-agency"
            />
          </Field>
          <Field label={t("fields.split")} hint={t("fields.splitHint")} required error={errors.splitPercent}>
            <Input
              name="splitPercent"
              inputMode="decimal"
              required
              className="tabular-nums"
              data-testid="co-broke-split"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.validFrom")} error={errors.validFrom}>
              <Input name="validFrom" type="date" min={bangkokToday()} defaultValue={bangkokToday()} />
            </Field>
            <Field label={t("fields.validTo")} error={errors.validTo}>
              <Input name="validTo" type="date" min={bangkokToday()} />
            </Field>
          </div>
          <Field label={t("fields.note")} error={errors.note}>
            <Textarea name="note" rows={2} />
          </Field>
        </>
      )}
    </FormDialog>
  );
}

/** Sign (co-agency, Idempotency-Key), cancel a proposal (listing agency) or end a signed agreement (either). */
export function CoBrokeAction({
  agreement,
  action,
  partner,
}: {
  agreement: Schemas["CoBrokeDto"];
  action: "sign" | "cancel" | "end";
  partner: string;
}) {
  const t = useTranslations("owner.agency.coBroke");
  const path = { agreementId: agreement.id };
  const locale = useLocale() as Locale;
  const percent = formatPercent(agreement.splitPercent, locale);
  return (
    <ConfirmAction
      label={t(action)}
      icon={action === "sign" ? IconSign : IconXCircle}
      size="sm"
      variant={action === "sign" ? "primary" : "secondary"}
      tone={action === "sign" ? "primary" : "destructive"}
      testId={`co-broke-${action}`}
      title={action === "sign" ? t("signTitle", { name: partner }) : t(`${action}Title`)}
      description={action === "sign" ? t("signBody", { percent, slug: agreement.listingSlug }) : t(`${action}Body`)}
      confirmLabel={t(action)}
      successMessage={action === "sign" ? t("signed") : action === "cancel" ? t("cancelled") : t("endDone")}
      onConfirm={(idempotencyKey) =>
        unwrap(
          action === "sign"
            ? browserApi().POST("/v1/owner/co-broke-agreements/{agreementId}/actions/sign", {
                params: { path, header: { "Idempotency-Key": idempotencyKey } },
              })
            : action === "cancel"
              ? browserApi().POST("/v1/owner/co-broke-agreements/{agreementId}/actions/cancel", { params: { path } })
              : browserApi().POST("/v1/owner/co-broke-agreements/{agreementId}/actions/end", { params: { path } }),
        )
      }
    />
  );
}
