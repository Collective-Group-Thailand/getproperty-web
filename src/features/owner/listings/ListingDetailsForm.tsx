"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { fieldErrors } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Field } from "@/ui/components/Field";
import { Input, NumberInput, Textarea } from "@/ui/components/Input";
import { SegmentedControl } from "@/ui/components/SegmentedControl";
import { Switch } from "@/ui/components/Switch";
import { IconButton } from "@/ui/components/IconButton";
import { IconAdd } from "@/ui/icons/glyphs/add";
import { IconClose } from "@/ui/icons/glyphs/close";

type Listing = Schemas["ListingDto"];
type Furnishing = Schemas["Furnishing"];
const FURNISHING: Furnishing[] = ["unfurnished", "partly_furnished", "fully_furnished"];
const SUGGESTIONS = [
  "pool",
  "fitness",
  "parking",
  "security",
  "keycard",
  "cctv",
  "lift",
  "washer",
  "aircon",
  "waterHeater",
  "internet",
  "balcony",
  "garden",
  "kitchen",
] as const;

const blankToNull = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text === "" ? null : text;
};
const int = (value: FormDataEntryValue | null) => {
  const text = String(value ?? "").trim();
  return text === "" ? undefined : Number.parseInt(text, 10);
};

/**
 * Texts, terms and facts of a listing (F6.2, D-252) — what a renter wants to know before a viewing. Saved in one
 * request; the API keeps the unit's size, rooms and address in step with the portfolio on every save.
 */
export function ListingDetailsForm({ listing }: { listing: Listing }) {
  const t = useTranslations("owner.listings.details");
  const action = useApiAction<Listing>();
  const errors = fieldErrors(action.error);
  const [furnishing, setFurnishing] = useState<Furnishing | "">(listing.furnishing ?? "");
  const [pets, setPets] = useState(listing.petsAllowed);
  const [smoking, setSmoking] = useState(listing.smokingAllowed);
  const [showUnitNo, setShowUnitNo] = useState(listing.showUnitNo);
  const [showUtilityHistory, setShowUtilityHistory] = useState(listing.showUtilityHistory);
  const [facilities, setFacilities] = useState<string[]>(listing.facilities);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const suggestions = SUGGESTIONS.map((key) => t(`suggestions.${key}`)).filter((s) => !facilities.includes(s));

  const addFacility = (value: string) => {
    const name = value.trim();
    if (name && !facilities.includes(name) && facilities.length < 40) setFacilities([...facilities, name]);
    setDraft("");
    setSaved(false);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaved(false);
    const form = new FormData(event.currentTarget);
    const transitName = blankToNull(form.get("transitName"));
    const distance = int(form.get("transitDistance"));
    action.run(
      () =>
        unwrap(
          browserApi().PATCH("/v1/owner/listings/{listingId}", {
            params: { path: { listingId: listing.id } },
            body: {
              titleTh: String(form.get("titleTh") ?? "").trim(),
              titleEn: blankToNull(form.get("titleEn")),
              descriptionTh: String(form.get("descriptionTh") ?? "").trim(),
              descriptionEn: blankToNull(form.get("descriptionEn")),
              rent: String(form.get("rent") ?? "").trim(),
              depositMonths: int(form.get("depositMonths")),
              advanceMonths: int(form.get("advanceMonths")),
              minTermMonths: int(form.get("minTermMonths")),
              availableFrom: blankToNull(form.get("availableFrom")),
              furnishing: furnishing || null,
              petsAllowed: pets,
              smokingAllowed: smoking,
              facilities,
              showUnitNo,
              showUtilityHistory,
              transit:
                transitName && distance !== undefined
                  ? { name: transitName, line: blankToNull(form.get("transitLine")), distanceM: distance }
                  : null,
            },
          }),
        ),
      () => setSaved(true),
    );
  };

  return (
    <form className="flex flex-col gap-5" onSubmit={submit} noValidate data-testid="listing-details">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={t("titleTh")} error={errors.titleTh} required>
          <Input name="titleTh" defaultValue={listing.titleTh} maxLength={120} required />
        </Field>
        <Field label={t("titleEn")} hint={t("englishHint")} error={errors.titleEn}>
          <Input name="titleEn" defaultValue={listing.titleEn ?? ""} maxLength={120} />
        </Field>
        <Field label={t("descriptionTh")} error={errors.descriptionTh}>
          <Textarea
            name="descriptionTh"
            defaultValue={listing.descriptionTh}
            rows={6}
            maxLength={5000}
            data-testid="listing-description"
          />
        </Field>
        <Field label={t("descriptionEn")} hint={t("englishHint")} error={errors.descriptionEn}>
          <Textarea name="descriptionEn" defaultValue={listing.descriptionEn ?? ""} rows={6} maxLength={5000} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Field label={t("rent")} error={errors.rent} required>
          <NumberInput name="rent" defaultValue={listing.rent} unit={t("rentUnit")} />
        </Field>
        <Field label={t("deposit")} error={errors.depositMonths}>
          <NumberInput name="depositMonths" inputMode="numeric" defaultValue={String(listing.depositMonths)} />
        </Field>
        <Field label={t("advance")} error={errors.advanceMonths}>
          <NumberInput name="advanceMonths" inputMode="numeric" defaultValue={String(listing.advanceMonths)} />
        </Field>
        <Field label={t("minTerm")} error={errors.minTermMonths}>
          <NumberInput name="minTermMonths" inputMode="numeric" defaultValue={String(listing.minTermMonths)} />
        </Field>
        <Field label={t("availableFrom")} hint={t("availableHint")} error={errors.availableFrom}>
          <Input type="date" name="availableFrom" defaultValue={listing.availableFrom ?? ""} />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" aria-hidden="true">
          {t("furnishing")}
        </span>
        <SegmentedControl
          label={t("furnishing")}
          value={furnishing}
          onValueChange={(next) => setFurnishing(next as Furnishing)}
          options={FURNISHING.map((value) => ({ value, label: t(`furnishingValue.${value}`) }))}
          className="self-start"
        />
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3">
        <Switch label={t("pets")} checked={pets} onCheckedChange={setPets} />
        <Switch label={t("smoking")} checked={smoking} onCheckedChange={setSmoking} />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium" id={`facilities-${listing.id}`}>
          {t("facilities")}
        </span>
        <p className="text-muted text-sm">{t("facilitiesHint")}</p>
        {facilities.length ? (
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0" aria-labelledby={`facilities-${listing.id}`}>
            {facilities.map((facility) => (
              <li
                key={facility}
                className="bg-primary-subtle text-primary-subtle-fg flex items-center gap-1 rounded-full ps-3 text-sm"
              >
                {facility}
                <IconButton
                  icon={IconClose}
                  label={t("facilityRemove", { name: facility })}
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setFacilities(facilities.filter((f) => f !== facility));
                    setSaved(false);
                  }}
                />
              </li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <Button
              key={suggestion}
              type="button"
              size="sm"
              variant="secondary"
              iconStart={IconAdd}
              onClick={() => addFacility(suggestion)}
            >
              {suggestion}
            </Button>
          ))}
        </div>
        <div className="flex max-w-md gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addFacility(draft);
              }
            }}
            maxLength={60}
            aria-label={t("facilities")}
          />
          <Button type="button" variant="secondary" onClick={() => addFacility(draft)} disabled={!draft.trim()}>
            {t("facilityAdd")}
          </Button>
        </div>
      </div>

      <Switch
        label={t("showUnitNo")}
        description={t("showUnitNoHint")}
        checked={showUnitNo}
        onCheckedChange={setShowUnitNo}
      />

      <Switch
        label={t("showUtilityHistory")}
        description={t("showUtilityHistoryHint")}
        checked={showUtilityHistory}
        onCheckedChange={setShowUtilityHistory}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">{t("transit")}</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("transitName")} error={errors["transit.name"]}>
            <Input name="transitName" defaultValue={listing.transit?.name ?? ""} maxLength={100} />
          </Field>
          <Field label={t("transitLine")} error={errors["transit.line"]}>
            <Input name="transitLine" defaultValue={listing.transit?.line ?? ""} maxLength={100} />
          </Field>
          <Field label={t("transitDistance")} error={errors["transit.distanceM"]}>
            <NumberInput
              name="transitDistance"
              inputMode="numeric"
              defaultValue={listing.transit ? String(listing.transit.distanceM) : ""}
            />
          </Field>
        </div>
      </fieldset>

      <ProblemNotice error={action.error} />
      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <span className="text-muted text-sm" role="status">
            {t("saved")}
          </span>
        ) : null}
        <Button type="submit" loading={action.busy} data-testid="listing-details-save">
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
