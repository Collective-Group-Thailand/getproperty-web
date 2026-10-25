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
import { Card, CardHeader } from "@/ui/components/Card";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput } from "@/ui/components/Input";
import { RadioCards } from "@/ui/components/RadioCards";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import type { IconGlyph } from "@/ui/icons";
import { IconBuilding } from "@/ui/icons/glyphs/building";
import { IconDoor } from "@/ui/icons/glyphs/door";
import { IconFloor } from "@/ui/icons/glyphs/floor";
import { IconHome } from "@/ui/icons/glyphs/home";

import { ownerPath } from "../shared/links";

type Kind = Schemas["PortfolioUnitKind"];
type Furnishing = Schemas["Furnishing"];

const KINDS: { value: Kind; icon: IconGlyph }[] = [
  { value: "condo_unit", icon: IconBuilding },
  { value: "house", icon: IconHome },
  { value: "townhouse", icon: IconFloor },
  { value: "room", icon: IconDoor },
];
const FURNISHING: Furnishing[] = ["unfurnished", "partly_furnished", "fully_furnished"];

const blank = (value: string) => value.trim() || undefined;
const count = (value: string) => (value.trim() === "" ? undefined : Number.parseInt(value, 10));

/**
 * Add a unit in one screen (B7.1, F6.1, D-251): what it is, where it is, what it is like. A condo unit needs its
 * project and number (units of one project share one building, shown to each owner as their own); a house only its
 * address. Everything else is optional and can be filled in later. The API decides and explains conflicts (another
 * owner already registered that number → `portfolio.unit_claimed`).
 */
export function AddUnitForm() {
  const t = useTranslations("owner.portfolio.form");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const action = useApiAction<Schemas["PortfolioUnitCreatedDto"]>({ refresh: false });
  const errors = fieldErrors(action.error);
  const [kind, setKind] = useState<Kind>("condo_unit");
  const [furnishing, setFurnishing] = useState<Furnishing | "">("");
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const condo = kind === "condo_unit";

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    const required = ["line1", "province", "postcode", ...(condo ? ["projectName", "unitNo"] : [])];
    const empty = Object.fromEntries(required.filter((name) => !value(name).trim()).map((name) => [name, true]));
    setMissing(empty);
    if (Object.keys(empty).length) return;

    const body: Schemas["PortfolioUnitCreateDto"] = {
      kind,
      projectName: blank(value("projectName")),
      unitNo: blank(value("unitNo")),
      address: {
        line1: value("line1").trim(),
        subdistrict: blank(value("subdistrict")),
        district: blank(value("district")),
        province: value("province").trim(),
        postcode: value("postcode").trim(),
      },
      areaSqm: blank(value("areaSqm")),
      bedrooms: count(value("bedrooms")),
      bathrooms: count(value("bathrooms")),
      floorLabel: blank(value("floorLabel")),
      furnishing: furnishing || undefined,
      defaultRent: blank(value("defaultRent")),
    };
    action.run(
      () => unwrap(browserApi().POST("/v1/owner/portfolio/units", { body })),
      (created) => {
        router.push(ownerPath(locale, `/portfolio?added=${created.unitId}`));
        router.refresh();
      },
    );
  };

  const error = (name: string, path = name) => (missing[name] ? t("required") : errors[path]);

  return (
    <form className="flex flex-col gap-6" onSubmit={submit} noValidate data-testid="portfolio-form">
      <Card as="section" aria-labelledby="unit-kind" className="flex flex-col gap-4">
        <CardHeader title={<span id="unit-kind">{t("kind.title")}</span>} description={t("kind.description")} />
        <RadioCards
          name="kind"
          value={kind}
          onValueChange={(next) => setKind(next as Kind)}
          columns={2}
          options={KINDS.map(({ value, icon }) => ({
            value,
            icon,
            label: t(`kind.${value}.label`),
            description: t(`kind.${value}.description`),
          }))}
        />
      </Card>

      <Card as="section" aria-labelledby="unit-place" className="flex flex-col gap-4">
        <CardHeader
          title={<span id="unit-place">{t("place.title")}</span>}
          description={condo ? t("place.condoDescription") : t("place.houseDescription")}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            label={condo ? t("place.project") : t("place.houseName")}
            hint={condo ? t("place.projectHint") : t("place.houseNameHint")}
            error={error("projectName")}
            required={condo}
          >
            <Input name="projectName" autoComplete="off" data-testid="portfolio-project" />
          </Field>
          {kind !== "house" && kind !== "townhouse" ? (
            <Field label={t("place.unitNo")} hint={t("place.unitNoHint")} error={error("unitNo")} required={condo}>
              <Input name="unitNo" autoComplete="off" data-testid="portfolio-unit-no" />
            </Field>
          ) : null}
          <Field label={t("place.line1")} hint={t("place.line1Hint")} error={error("line1", "address.line1")} required>
            <Input name="line1" autoComplete="address-line1" data-testid="portfolio-line1" />
          </Field>
          <Field label={t("place.subdistrict")} error={errors["address.subdistrict"]}>
            <Input name="subdistrict" autoComplete="off" />
          </Field>
          <Field label={t("place.district")} error={errors["address.district"]}>
            <Input name="district" autoComplete="address-level2" />
          </Field>
          <Field label={t("place.province")} error={error("province", "address.province")} required>
            <Input name="province" autoComplete="address-level1" data-testid="portfolio-province" />
          </Field>
          <Field label={t("place.postcode")} error={error("postcode", "address.postcode")} required>
            <Input
              name="postcode"
              inputMode="numeric"
              maxLength={5}
              autoComplete="postal-code"
              className="max-w-40 font-mono tabular-nums"
              data-testid="portfolio-postcode"
            />
          </Field>
        </div>
      </Card>

      <Card as="section" aria-labelledby="unit-details" className="flex flex-col gap-4">
        <CardHeader
          title={<span id="unit-details">{t("details.title")}</span>}
          description={t("details.description")}
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Field label={t("details.area")} error={errors.areaSqm}>
            <NumberInput name="areaSqm" unit={t("details.areaUnit")} />
          </Field>
          <Field label={t("details.bedrooms")} error={errors.bedrooms}>
            <NumberInput name="bedrooms" inputMode="numeric" />
          </Field>
          <Field label={t("details.bathrooms")} error={errors.bathrooms}>
            <NumberInput name="bathrooms" inputMode="numeric" />
          </Field>
          {condo || kind === "room" ? (
            <Field label={t("details.floor")} error={errors.floorLabel}>
              <Input name="floorLabel" autoComplete="off" />
            </Field>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium" aria-hidden="true">
            {t("details.furnishing")}
          </span>
          <SegmentedControl
            label={t("details.furnishing")}
            value={furnishing}
            onValueChange={(next) => setFurnishing(next as Furnishing)}
            options={FURNISHING.map((value) => ({ value, label: t(`details.furnishingValue.${value}`) }))}
            className="self-start"
          />
        </div>
        <Field label={t("details.rent")} hint={t("details.rentHint")} error={errors.defaultRent}>
          <div className="max-w-60">
            <NumberInput name="defaultRent" unit={t("details.rentUnit")} data-testid="portfolio-rent" />
          </div>
        </Field>
      </Card>

      <ProblemNotice error={action.error} />
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button asChild variant="secondary" size="lg">
          <a href={ownerPath(locale, "/portfolio")}>{t("cancel")}</a>
        </Button>
        <Button type="submit" size="lg" loading={action.busy} data-testid="portfolio-submit">
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
