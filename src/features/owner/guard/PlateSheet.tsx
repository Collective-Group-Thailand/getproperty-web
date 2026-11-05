"use client";

import { useTranslations } from "next-intl";
import { useMemo, useReducer, useState } from "react";

import { KioskInput as Input } from "@/ui/components/Kiosk";
import { PlateBoxes } from "@/ui/components/PlateBoxes";
import { PlateKeypad } from "@/ui/components/PlateKeypad";
import { cx as cn } from "@/ui/lib/cx";

import { KioskDialog } from "./KioskDialog";
import { CONSONANT_GROUPS, keypadReducer, normalisePlate, type PlateDraft, type PlateField } from "./lib/plate";
import { orderedProvinces, readRecentProvinces, rememberProvince, writeRecentProvinces } from "./lib/provinces";

/**
 * The plate keypad sheet (J-DESIGN §4): the plate boxes on top, then the consonant groups + digits for the category
 * and number, or the province list (recent first, then all, searchable) for the province. The guard never sees the OS
 * keyboard except to search a province by name.
 */
export function PlateSheet({
  initial,
  field,
  onClose,
  onDone,
}: {
  initial: PlateDraft;
  field: PlateField;
  onClose: () => void;
  onDone: (plate: PlateDraft) => void;
}) {
  const t = useTranslations("owner.guard");
  // Mounted only while open (Desk), so the reducer starts from the form's plate each time.
  const [state, dispatch] = useReducer(keypadReducer, { plate: initial, field });
  const [query, setQuery] = useState("");
  const [recent] = useState<string[]>(() => readRecentProvinces());

  const groups = useMemo(
    () =>
      CONSONANT_GROUPS.map((group) => ({
        key: group.key,
        label: t(`keypad.group.${group.key}`),
        letters: group.letters,
      })),
    [t],
  );
  const provinces = orderedProvinces(recent, query);

  const finish = (plate = state.plate) => {
    const clean = normalisePlate(plate);
    if (clean.province) {
      const next = rememberProvince(recent, clean.province);
      writeRecentProvinces(next);
    }
    onDone(clean);
  };

  const chooseProvince = (value: string) => {
    dispatch({ type: "province", value });
    finish({ ...state.plate, province: value });
  };

  const provinceButton = (value: string) => (
    <button
      key={value}
      type="button"
      onClick={() => chooseProvince(value)}
      data-province={value}
      className={cn(
        "rounded-control flex h-14 touch-manipulation items-center border px-4 text-left text-base",
        state.plate.province === value
          ? "border-primary bg-primary-subtle text-primary-subtle-fg font-semibold"
          : "border-border bg-surface active:bg-bg-subtle",
      )}
    >
      {value}
    </button>
  );

  return (
    <KioskDialog
      open
      onClose={onClose}
      title={t("keypad.title")}
      closeLabel={t("close")}
      variant="sheet"
      testId="plate-sheet"
    >
      <div className="flex flex-col gap-5">
        <PlateBoxes
          idPrefix="sheet-plate"
          category={state.plate.category}
          number={state.plate.number}
          province={state.plate.province}
          active={state.field}
          onSelect={(part) => dispatch({ type: "focus", field: part })}
          labels={{
            category: t("entry.category"),
            number: t("entry.number"),
            province: t("entry.province"),
            provinceEmpty: t("entry.provinceEmpty"),
          }}
        />
        {state.field === "province" ? (
          <div className="flex flex-col gap-4" data-testid="province-picker">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("keypad.provinceSearch")}
              aria-label={t("keypad.provinceSearch")}
              className="h-14 text-lg"
            />
            {provinces.recent.length > 0 ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-muted text-sm font-medium">{t("keypad.recent")}</h3>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
                  {provinces.recent.map(provinceButton)}
                </div>
              </section>
            ) : null}
            <section className="flex flex-col gap-2">
              <h3 className="text-muted text-sm font-medium">{t("keypad.all")}</h3>
              {provinces.rest.length === 0 && provinces.recent.length === 0 ? (
                <p className="text-muted">{t("keypad.noProvince")}</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
                  {provinces.rest.map(provinceButton)}
                </div>
              )}
            </section>
          </div>
        ) : (
          <PlateKeypad
            groups={groups}
            emphasis={state.field === "number" ? "digits" : "letters"}
            onKey={(value) => dispatch({ type: "key", value })}
            onBackspace={() => dispatch({ type: "backspace" })}
            onNext={() => dispatch({ type: "focus", field: state.field === "category" ? "number" : "province" })}
            onDone={() => finish()}
            labels={{
              letters: t("keypad.letters"),
              digits: t("keypad.digits"),
              backspace: t("keypad.backspace"),
              next: t("keypad.next"),
              done: t("keypad.done"),
            }}
          />
        )}
      </div>
    </KioskDialog>
  );
}
