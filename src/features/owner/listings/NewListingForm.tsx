"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { fieldErrors } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Card } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";

import { ownerPath } from "../shared/links";

export interface UnitChoice {
  id: string;
  label: string;
  defaultRent: string | null;
}

/**
 * The first step of a listing (F6.2, D-252): which unit, a headline and the rent. Everything else — photos, terms,
 * viewing times — is filled in on the listing's page, which opens right after the draft is created.
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

  return (
    <Card>
      <form className="flex flex-col gap-5" onSubmit={submit} noValidate data-testid="listing-create">
        <Field label={t("unit")} hint={t("unitHint")} error={errors.unitId} required>
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
        </Field>
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
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button asChild variant="secondary">
            <a href={ownerPath(locale, "/listings")}>{t("cancel")}</a>
          </Button>
          <Button type="submit" loading={action.busy} disabled={!unitId} data-testid="listing-create-submit">
            {t("submit")}
          </Button>
        </div>
      </form>
    </Card>
  );
}
