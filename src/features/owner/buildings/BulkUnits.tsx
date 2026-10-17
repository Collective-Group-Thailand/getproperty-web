"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { browserApi } from "@/lib/api/browser";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Checkbox } from "@/ui/components/Checkbox";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { Stepper } from "@/ui/components/Stepper";
import { IconBack } from "@/ui/icons/glyphs/back";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { IconForward } from "@/ui/icons/glyphs/forward";

import { fieldErrors } from "@/features/shared/console/FormDialog";
import { ProblemNotice, useApiAction } from "@/features/shared/console/useApiAction";

type Step = "floors" | "numbers" | "confirm" | "done";
const STEPS: Step[] = ["floors", "numbers", "confirm", "done"];
const TYPES: Schemas["UnitType"][] = ["room", "condo_unit", "house", "shop", "parking"];
const MONEY = /^\d{1,9}(\.\d{1,2})?$/;

/**
 * The unit numbers a pattern gives (`A-{floor}{nn}` → A-301, A-302…) — text formatting of the pattern
 * the API documents, shown as a preview only; the API creates the units and refuses duplicates.
 */
export function previewNumbers(
  pattern: string,
  buildingCode: string,
  level: number,
  start: number,
  count: number,
): string[] {
  return Array.from({ length: count }, (_, index) =>
    pattern
      .replaceAll("{building}", buildingCode)
      .replaceAll("{ff}", String(level).padStart(2, "0"))
      .replaceAll("{floor}", String(level))
      .replace(/\{(n+)\}/g, (_match, ns: string) => String(start + index).padStart(ns.length, "0")),
  );
}

/**
 * Bulk create (F2 2.1): floors → number pattern, count and defaults (unit type profile, rent, area) →
 * a preview of the numbers → `POST /v1/owner/buildings/{id}/units/bulk`. The API refuses a number that
 * exists and creates nothing in that case.
 */
export function BulkUnits({
  building,
  floors,
  profiles,
  boardHref,
}: {
  building: Pick<Schemas["BuildingDto"], "id" | "name" | "code">;
  floors: Schemas["FloorDto"][];
  profiles: Schemas["UnitProfileDto"][];
  boardHref: string;
}) {
  const t = useTranslations("owner.buildings.bulk");
  const types = useTranslations("owner.units.type");
  const locale = useLocale() as Locale;
  const [step, setStep] = useState<Step>(floors.length ? "floors" : "floors");
  const [chosen, setChosen] = useState<string[]>([]);
  const [pattern, setPattern] = useState("{building}-{floor}{nn}");
  const [count, setCount] = useState("10");
  const [start, setStart] = useState("1");
  const [type, setType] = useState<Schemas["UnitType"]>("room");
  const [profileId, setProfileId] = useState("");
  const [rent, setRent] = useState("");
  const [area, setArea] = useState("");
  const [created, setCreated] = useState<Schemas["UnitDto"][]>([]);
  const action = useApiAction();
  const errors = fieldErrors(action.error);

  const countNumber = Number(count);
  const startNumber = Number(start);
  const numbersValid =
    Number.isInteger(countNumber) &&
    countNumber >= 1 &&
    countNumber <= 200 &&
    Number.isInteger(startNumber) &&
    startNumber >= 0 &&
    /\{n+\}/.test(pattern) &&
    (rent === "" || MONEY.test(rent)) &&
    (area === "" || MONEY.test(area));
  const selectedFloors = floors.filter((floor) => chosen.includes(floor.id));
  const profile = profiles.find((candidate) => candidate.id === profileId);
  const index = STEPS.indexOf(step);

  return (
    <div className="flex flex-col gap-5" data-testid="bulk-units" data-step={step}>
      <Stepper
        steps={STEPS.map((id) => ({ id, label: t(`step.${id}`) }))}
        current={index}
        label={t("steps")}
        progressText={t("progress", { step: index + 1, total: STEPS.length })}
      />

      {step === "floors" ? (
        <section className="flex flex-col gap-3" aria-labelledby="bulk-floors">
          <h2 id="bulk-floors" className="text-lg font-semibold">
            {t("floorsTitle")}
          </h2>
          {floors.length === 0 ? (
            <Callout tone="warning">{t("noFloors")}</Callout>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {floors.map((floor) => (
                <Checkbox
                  key={floor.id}
                  label={floor.name}
                  description={t("floorUnits", { count: floor.unitCount })}
                  checked={chosen.includes(floor.id)}
                  onCheckedChange={(checked) =>
                    setChosen((current) =>
                      checked === true ? [...current, floor.id] : current.filter((candidate) => candidate !== floor.id),
                    )
                  }
                />
              ))}
            </div>
          )}
          <div className="flex justify-end">
            <Button
              iconEnd={IconForward}
              disabled={chosen.length === 0}
              onClick={() => setStep("numbers")}
              data-testid="bulk-next"
            >
              {t("next")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "numbers" ? (
        <section className="flex flex-col gap-4" aria-labelledby="bulk-numbers">
          <h2 id="bulk-numbers" className="text-lg font-semibold">
            {t("numbersTitle")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label={t("pattern")}
              hint={t("patternHint")}
              required
              className="sm:col-span-3"
              error={errors.pattern}
            >
              <Input
                value={pattern}
                onChange={(event) => setPattern(event.target.value)}
                className="font-mono"
                data-testid="bulk-pattern"
              />
            </Field>
            <Field label={t("count")} required error={errors.countPerFloor}>
              <Input
                type="number"
                min={1}
                max={200}
                value={count}
                onChange={(event) => setCount(event.target.value)}
                data-testid="bulk-count"
              />
            </Field>
            <Field label={t("start")} error={errors.start}>
              <Input type="number" min={0} value={start} onChange={(event) => setStart(event.target.value)} />
            </Field>
            <Field label={t("type")}>
              <NativeSelect
                value={type}
                onChange={(event) => setType(event.target.value as Schemas["UnitType"])}
                options={TYPES.map((value) => ({ value, label: types(value) }))}
              />
            </Field>
            <Field label={t("profile")} hint={t("profileHint")}>
              <NativeSelect
                value={profileId}
                placeholder={t("noProfile")}
                onChange={(event) => setProfileId(event.target.value)}
                options={profiles.map((candidate) => ({
                  value: candidate.id,
                  label: `${candidate.name} · ${formatTHB(candidate.defaultRent, locale)}`,
                }))}
              />
            </Field>
            <Field label={t("rent")} hint={profile ? t("rentFromProfile") : undefined} error={errors.baseRent}>
              <Input inputMode="decimal" value={rent} onChange={(event) => setRent(event.target.value)} />
            </Field>
            <Field label={t("area")} error={errors.areaSqm}>
              <Input inputMode="decimal" value={area} onChange={(event) => setArea(event.target.value)} />
            </Field>
          </div>
          <div className="flex justify-between">
            <Button variant="secondary" iconStart={IconBack} onClick={() => setStep("floors")}>
              {t("back")}
            </Button>
            <Button
              iconEnd={IconForward}
              disabled={!numbersValid}
              onClick={() => setStep("confirm")}
              data-testid="bulk-next"
            >
              {t("next")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "confirm" ? (
        <section className="flex flex-col gap-4" aria-labelledby="bulk-confirm">
          <h2 id="bulk-confirm" className="text-lg font-semibold">
            {t("confirmTitle", { count: countNumber * selectedFloors.length, building: building.name })}
          </h2>
          <p className="text-muted text-sm">{t("previewNote")}</p>
          <ul className="flex flex-col gap-2" data-testid="bulk-preview">
            {selectedFloors.map((floor) => {
              const numbers = previewNumbers(pattern, building.code, floor.level, startNumber, countNumber);
              return (
                <li key={floor.id} className="rounded-control border-border border p-3">
                  <p className="font-medium">{floor.name}</p>
                  <p className="text-muted font-mono text-sm">
                    {numbers.length > 6
                      ? `${numbers.slice(0, 3).join(", ")} … ${numbers.slice(-2).join(", ")}`
                      : numbers.join(", ")}
                  </p>
                </li>
              );
            })}
          </ul>
          <ProblemNotice error={action.error} />
          <div className="flex justify-between">
            <Button variant="secondary" iconStart={IconBack} onClick={() => setStep("numbers")}>
              {t("back")}
            </Button>
            <Button
              loading={action.busy}
              onClick={() =>
                void action.run(
                  () =>
                    unwrap(
                      browserApi().POST("/v1/owner/buildings/{buildingId}/units/bulk", {
                        params: { path: { buildingId: building.id } },
                        body: {
                          floorIds: chosen,
                          countPerFloor: countNumber,
                          start: startNumber,
                          pattern,
                          type,
                          unitProfileId: profileId || null,
                          baseRent: rent || null,
                          areaSqm: area || null,
                        },
                      }),
                    ),
                  (answer) => {
                    setCreated(answer as Schemas["UnitDto"][]);
                    setStep("done");
                  },
                )
              }
              data-testid="bulk-create"
            >
              {t("create", { count: countNumber * selectedFloors.length })}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "done" ? (
        <Callout tone="success" title={t("doneTitle")} icon={IconCheckCircle}>
          <p data-testid="bulk-done">{t("doneBody", { count: created.length })}</p>
          <Button asChild size="sm" className="mt-2">
            <a href={boardHref}>{t("openBoard")}</a>
          </Button>
        </Callout>
      ) : null}
    </div>
  );
}
