"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { fieldErrors } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { FormColumns, FormSection, FormSummary, MobileActionBar } from "@/ui/components/FormLayout";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { RadioCards } from "@/ui/components/RadioCards";

import { ownerPath } from "../shared/links";

/** Up to this many units are shown as cards to pick from; more use the searchable select. */
const UNITS_AS_CARDS = 6;

export interface UnitChoice {
  id: string;
  label: string;
  defaultRent: string | null;
}

/**
 * The first step of a listing (F6.2, D-252) as two numbered sections — which unit of the portfolio, then a headline
 * and the rent — beside a summary with the one action. Everything else — photos, terms, viewing times — is filled in
 * on the listing's page, which opens right after the draft is created.
 */
export function NewListingForm({ units, initialUnitId }: { units: UnitChoice[]; initialUnitId: string | null }) {
  const t = useTranslations("owner.listings.create");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const action = useApiAction<Schemas["ListingDto"]>({ refresh: false });
  const errors = fieldErrors(action.error);
  const [unitId, setUnitId] = useState(initialUnitId ?? units[0]?.id ?? "");
  const unit = units.find((u) => u.id === unitId);
  const [rent, setRent] = useState(unit?.defaultRent ?? "");

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    action.run(
      () =>
        unwrap(
          browserApi().POST("/v1/owner/listings", {
            body: { unitId, titleTh: String(form.get("titleTh") ?? "").trim(), rent: rent.trim() },
          }),
        ),
      (listing) => router.push(ownerPath(locale, `/listings/${listing.id}`)),
    );
  };

  const unitField =
    units.length <= UNITS_AS_CARDS ? (
      <RadioCards
        value={unitId}
        onValueChange={(next) => {
          setUnitId(next);
          const chosen = units.find((u) => u.id === next);
          if (chosen?.defaultRent) setRent(chosen.defaultRent);
        }}
        options={units.map((u) => ({
          value: u.id,
          label: u.label,
          description: u.defaultRent
            ? t("unitRent", { rent: formatTHB(u.defaultRent, locale, { decimals: 0 }) })
            : undefined,
        }))}
        data-testid="listing-unit"
      />
    ) : (
      <NativeSelect
        value={unitId}
        onChange={(event) => {
          setUnitId(event.target.value);
          const next = units.find((u) => u.id === event.target.value);
          if (next?.defaultRent) setRent(next.defaultRent);
        }}
        options={units.map((u) => ({ value: u.id, label: u.label }))}
        data-testid="listing-unit"
      />
    );
  const submitButton = (testId: string) => (
    <Button type="submit" form="listing-create" loading={action.busy} disabled={!unitId} data-testid={testId}>
      {t("submit")}
    </Button>
  );

  return (
    <FormColumns
      summary={
        <FormSummary
          title={t("summary")}
          rows={[
            { key: "unit", label: t("unit"), value: unit?.label ?? "—" },
            {
              key: "rent",
              label: t("rent"),
              value:
                rent.trim() && Number.isFinite(Number(rent)) ? formatTHB(rent.trim(), locale, { decimals: 0 }) : "—",
            },
          ]}
          action={submitButton("listing-create-submit")}
          note={t("next")}
        />
      }
    >
      <form
        id="listing-create"
        className="flex flex-col gap-6"
        onSubmit={submit}
        noValidate
        data-testid="listing-create"
      >
        <FormSection number={1} title={t("unit")} description={t("unitHint")}>
          <Field label={t("unit")} labelHidden error={errors.unitId} required>
            {unitField}
          </Field>
        </FormSection>
        <FormSection number={2} title={t("basics")} description={t("basicsHint")}>
          <Field label={t("headline")} hint={t("headlineHint")} error={errors.titleTh} required>
            <Input name="titleTh" maxLength={120} required data-testid="listing-headline" />
          </Field>
          <Field label={t("rent")} error={errors.rent} required>
            <div className="max-w-60">
              <NumberInput
                value={rent}
                onChange={(event) => setRent(event.target.value)}
                unit={t("rentUnit")}
                data-testid="listing-rent"
              />
            </div>
          </Field>
          <ProblemNotice error={action.error} />
        </FormSection>
      </form>
      <MobileActionBar>
        <Button asChild variant="secondary">
          <a href={ownerPath(locale, "/listings")}>{t("cancel")}</a>
        </Button>
        <Button type="submit" form="listing-create" loading={action.busy} disabled={!unitId} className="flex-1">
          {t("submit")}
        </Button>
      </MobileActionBar>
    </FormColumns>
  );
}
