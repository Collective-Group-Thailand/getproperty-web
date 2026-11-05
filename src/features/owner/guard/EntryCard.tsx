"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import { KioskButton as Button, KioskNote, KioskInput as Input, KioskChip } from "@/ui/components/Kiosk";
import { IconXCircle } from "@/ui/icons/glyphs/x-circle";
import { IconWarning } from "@/ui/icons/glyphs/warning";
import { IconCheckCircle } from "@/ui/icons/glyphs/check-circle";
import { FieldError } from "@/ui/components/FieldError";
import { KindTiles } from "@/ui/components/KindTiles";
import { PickerField } from "@/ui/components/PickerField";
import { PlateBoxes } from "@/ui/components/PlateBoxes";
import { Icon } from "@/ui/icons";
import { IconBellRing } from "@/ui/icons/glyphs/bell-ring";
import { IconCamera } from "@/ui/icons/glyphs/camera";
import { IconCar } from "@/ui/icons/glyphs/car";
import { IconCctv } from "@/ui/icons/glyphs/cctv";
import { IconChat } from "@/ui/icons/glyphs/chat";
import { IconHammer } from "@/ui/icons/glyphs/hammer";
import { IconHome } from "@/ui/icons/glyphs/home";
import { IconInfo } from "@/ui/icons/glyphs/info";
import { IconMore } from "@/ui/icons/glyphs/more";
import { IconQr } from "@/ui/icons/glyphs/qr";
import { IconResident } from "@/ui/icons/glyphs/resident";
import { IconSearch } from "@/ui/icons/glyphs/search";
import { IconTruck } from "@/ui/icons/glyphs/truck";

import type { GuardHardware, GuardMe, GuardUnit, VisitKind } from "./lib/api";
import {
  EMPTY_PLATE,
  isPlateEmpty,
  normalisePlate,
  plateProblems,
  type PlateDraft,
  type PlateField,
} from "./lib/plate";
import { preparePhoto, type VisitPhoto } from "./lib/photo";
import type { Network, RecordInput } from "./lib/useDesk";
import { useNow } from "./lib/useNow";

export interface EntryForm {
  plate: PlateDraft;
  kind: VisitKind | null;
  unit: GuardUnit | null;
  visitorName: string;
  idLast4: string;
  photo: VisitPhoto | null;
}

export const EMPTY_FORM: EntryForm = {
  plate: EMPTY_PLATE,
  kind: null,
  unit: null,
  visitorName: "",
  idLast4: "",
  photo: null,
};

export const KIND_ICONS = {
  guest: IconResident,
  delivery: IconTruck,
  contractor: IconHammer,
  resident_vehicle: IconCar,
  other: IconMore,
} as const;

const KINDS: VisitKind[] = ["guest", "delivery", "contractor", "resident_vehicle", "other"];

export type EntryErrors = Partial<Record<"category" | "number" | "province" | "kind" | "unit" | "idLast4", string>>;

/** Field problems before anything is sent (the API checks again). */
export function entryProblems(form: EntryForm): Partial<Record<keyof EntryErrors, string>> {
  const problems: Partial<Record<keyof EntryErrors, string>> = { ...plateProblems(form.plate) };
  if (!form.kind) problems.kind = "kindRequired";
  else if (form.kind !== "other" && !form.unit) problems.unit = "destinationRequired";
  if (form.idLast4 && !/^\d{4}$/.test(form.idLast4)) problems.idLast4 = "idLast4Invalid";
  return problems;
}

export function toRecordInput(form: EntryForm): RecordInput {
  const plate = normalisePlate(form.plate);
  return {
    kind: form.kind!,
    ...(form.unit ? { unitId: form.unit.unitId, unitNo: form.unit.unitNo } : {}),
    ...(isPlateEmpty(plate) ? {} : { plate }),
    ...(form.visitorName.trim() ? { visitorName: form.visitorName.trim() } : {}),
    ...(form.idLast4 ? { idLast4: form.idLast4 } : {}),
    ...(form.photo ? { photo: { contentBase64: form.photo.contentBase64, mimeType: form.photo.mimeType } } : {}),
  };
}

const RESULT_ICON = { success: IconCheckCircle, info: IconInfo, warning: IconWarning, danger: IconXCircle } as const;

export interface EntryResult {
  tone: "success" | "info" | "warning" | "danger";
  text: string;
}

/**
 * "บันทึกผู้มาติดต่อ" (J-DESIGN §3 gate-tablet, left column): plate boxes + photo tile, kind tiles, destination chip,
 * optional name and ID last 4, the privacy line from the API, then one filled action — notify the house (or, offline,
 * record the visitor as let in) — and the outlined QR scan. Speed beats completeness: only the kind and, except for
 * "other", the house are required.
 */
export function EntryCard({
  me,
  form,
  setForm,
  network,
  hardware,
  result,
  submitting,
  onOpenPlate,
  onOpenDestination,
  onSubmit,
  onScan,
}: {
  me: GuardMe;
  form: EntryForm;
  setForm: (update: (form: EntryForm) => EntryForm) => void;
  network: Network;
  hardware: readonly GuardHardware[];
  result: EntryResult | null;
  submitting: boolean;
  onOpenPlate: (field: PlateField) => void;
  onOpenDestination: () => void;
  onSubmit: () => void;
  onScan: () => void;
}) {
  const t = useTranslations("owner.guard");
  const locale = useLocale();
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<EntryErrors>({});
  const [photoError, setPhotoError] = useState<string | null>(null);
  const offline = network === "offline";
  const lpr = hardware.find((device) => device.kind === "lpr");
  const now = useNow(60_000);
  const lprOnline = lpr?.lastSeenAt ? now - Date.parse(lpr.lastSeenAt) < 5 * 60_000 : false;
  const notice = locale === "en" ? me.privacyNotice.en : me.privacyNotice.th;

  const submit = () => {
    const problems = entryProblems(form);
    const translated: EntryErrors = {};
    for (const [field, code] of Object.entries(problems) as [keyof EntryErrors, string][]) {
      translated[field] =
        field === "category" || field === "number" || field === "province"
          ? t(`entry.plateErrors.${code}`)
          : t(`entry.${code}`);
    }
    setErrors(translated);
    if (Object.keys(translated).length > 0) {
      const first = (["category", "number", "province", "kind", "unit", "idLast4"] as const).find(
        (field) => translated[field],
      );
      const target =
        first === "kind"
          ? document.querySelector<HTMLElement>('[data-testid^="kind-"][tabindex="0"]')
          : first === "unit"
            ? document.querySelector<HTMLElement>('[data-testid="destination"]')
            : first === "idLast4"
              ? document.getElementById(`${id}-id4`)
              : document.querySelector<HTMLElement>(`[data-testid="plate-${first}"]`);
      target?.focus();
      return;
    }
    onSubmit();
  };

  const clearError = (field: keyof EntryErrors) =>
    setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current));

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-card border-border bg-surface shadow-card flex flex-col border lg:h-full lg:min-h-0"
      data-testid="entry-card"
    >
      <header className="border-border flex items-center justify-between gap-4 border-b px-6 py-4">
        <h2 id={`${id}-title`} className="text-xl font-semibold">
          {t("entry.title")}
        </h2>
        {lpr ? (
          <span className="text-muted flex items-center gap-2 text-sm">
            <Icon icon={IconCctv} size={20} />
            {lprOnline ? t("entry.lpr.ready") : t("entry.lpr.offline")}
          </span>
        ) : null}
      </header>

      <div className="relative flex flex-col gap-5 px-6 py-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {result ? (
          <KioskNote tone={result.tone} icon={RESULT_ICON[result.tone]}>
            <span data-testid="entry-result">{result.text}</span>
          </KioskNote>
        ) : null}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-base font-semibold">
            {t("entry.plate")} <span className="text-muted font-normal">{t("entry.plateOptional")}</span>
          </legend>
          <div className="flex items-end gap-3">
            <PlateBoxes
              idPrefix={`${id}-plate`}
              className="min-w-0 flex-1"
              category={form.plate.category}
              number={form.plate.number}
              province={form.plate.province}
              active={null}
              onSelect={(part) => {
                clearError(part);
                onOpenPlate(part);
              }}
              labels={{
                category: t("entry.category"),
                number: t("entry.number"),
                province: t("entry.province"),
                provinceEmpty: t("entry.provinceEmpty"),
              }}
              placeholders={{ category: "1กข", number: "1234" }}
              errors={{ category: errors.category, number: errors.number, province: errors.province }}
            />
            <div className="flex shrink-0 flex-col gap-1.5 self-start">
              <span className="text-muted text-sm">{t("entry.photo")}</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label={form.photo ? t("entry.photoRetake") : t("entry.photoTake")}
                data-testid="photo-tile"
                className="rounded-control border-border-strong bg-surface active:bg-bg-subtle relative flex size-20 touch-manipulation items-center justify-center overflow-hidden border-2 border-dashed"
              >
                {form.photo ? (
                  // A local object URL of the photo just taken: next/image has nothing to optimise here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.photo.previewUrl} alt={t("entry.photoAlt")} className="size-full object-cover" />
                ) : (
                  <Icon icon={IconCamera} size={30} className="text-muted" />
                )}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const photo = await preparePhoto(file).catch(() => "too-large" as const);
                  if (photo === "too-large") return setPhotoError(t("entry.photoTooLarge"));
                  setPhotoError(null);
                  setForm((current) => ({ ...current, photo }));
                }}
              />
            </div>
          </div>
          {photoError ? <FieldError alert>{photoError}</FieldError> : null}
          {form.photo ? (
            <div>
              <Button variant="ghost" size="md" onClick={() => setForm((current) => ({ ...current, photo: null }))}>
                {t("entry.photoRemove")}
              </Button>
            </div>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-2">
          <span id={`${id}-kind`} className="text-base font-semibold">
            {t("entry.kind")}
          </span>
          <KindTiles
            label={t("entry.kind")}
            describedBy={errors.kind ? `${id}-kind-error` : undefined}
            value={form.kind}
            onValueChange={(value) => {
              clearError("kind");
              clearError("unit");
              setForm((current) => ({ ...current, kind: value as VisitKind }));
            }}
            options={KINDS.map((kind) => ({ value: kind, label: t(`kind.${kind}`), icon: KIND_ICONS[kind] }))}
          />
          {errors.kind ? <FieldError id={`${id}-kind-error`}>{errors.kind}</FieldError> : null}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <span id={`${id}-unit`} className="text-base font-semibold">
              {t("entry.destination")}
              {form.kind === "other" ? (
                <span className="text-muted ms-2 font-normal">{t("entry.optional")}</span>
              ) : null}
            </span>
          </div>
          <PickerField
            onClick={() => {
              clearError("unit");
              onOpenDestination();
            }}
            invalid={Boolean(errors.unit)}
            filled={Boolean(form.unit)}
            aria-labelledby={`${id}-unit ${id}-unit-value`}
            aria-describedby={errors.unit ? `${id}-unit-error` : undefined}
            data-testid="destination"
          >
            <Icon
              icon={form.unit ? IconHome : IconSearch}
              size={26}
              className={form.unit ? "text-primary" : "text-subtle"}
            />
            <span id={`${id}-unit-value`} className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3">
              {form.unit ? (
                <>
                  <span className="font-mono text-xl font-semibold">{form.unit.unitNo}</span>
                  <span className="text-muted">{form.unit.buildingName}</span>
                </>
              ) : (
                <span className="text-muted text-lg">{t("entry.destinationSearch")}</span>
              )}
            </span>
            {form.unit ? (
              form.unit.lineLinked ? (
                <KioskChip tone="success" icon={IconChat}>
                  {t("entry.lineLinked")}
                </KioskChip>
              ) : (
                <KioskChip tone="neutral">{t("entry.lineNotLinked")}</KioskChip>
              )
            ) : null}
            {form.unit ? <span className="text-primary font-semibold">{t("entry.destinationChange")}</span> : null}
          </PickerField>
          {errors.unit ? <FieldError id={`${id}-unit-error`}>{errors.unit}</FieldError> : null}
          {form.unit?.policy.householdNote ? (
            <p className="text-muted text-sm">{t("units.note", { note: form.unit.policy.householdNote })}</p>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_14rem]">
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-name`} className="text-base font-semibold">
              {t("entry.visitorName")} <span className="text-muted font-normal">{t("entry.optional")}</span>
            </label>
            <Input
              id={`${id}-name`}
              value={form.visitorName}
              maxLength={120}
              autoComplete="off"
              onChange={(event) => setForm((current) => ({ ...current, visitorName: event.target.value }))}
              className="h-14 text-lg"
              data-testid="visitor-name"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`${id}-id4`} className="text-base font-semibold">
              {t("entry.idLast4")}
            </label>
            <Input
              id={`${id}-id4`}
              value={form.idLast4}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              aria-invalid={errors.idLast4 ? true : undefined}
              aria-describedby={`${id}-privacy${errors.idLast4 ? ` ${id}-id4-error` : ""}`}
              onChange={(event) => {
                clearError("idLast4");
                setForm((current) => ({ ...current, idLast4: event.target.value.replace(/\D/g, "").slice(0, 4) }));
              }}
              className="h-14 font-mono text-xl tracking-[0.3em]"
              data-testid="id-last4"
            />
            {errors.idLast4 ? <FieldError id={`${id}-id4-error`}>{errors.idLast4}</FieldError> : null}
          </div>
        </div>

        <p
          id={`${id}-privacy`}
          className="rounded-control bg-bg-subtle text-muted flex items-start gap-3 px-4 py-3 text-sm"
          data-testid="privacy-notice"
        >
          <Icon icon={IconInfo} size={20} className="mt-0.5 shrink-0" />
          <span>
            {notice} {t("entry.privacy", { days: me.privacyNotice.retentionDays })}
          </span>
        </p>
      </div>

      <footer className="border-border flex shrink-0 flex-col gap-3 border-t px-6 py-4">
        {offline ? <p className="text-muted text-sm">{t("entry.recordOfflineHint")}</p> : null}
        <div className="flex flex-wrap gap-3">
          <Button
            size="xl"
            className="h-16 min-w-[16rem] flex-[2] text-xl"
            iconStart={IconBellRing}
            loading={submitting}
            onClick={submit}
            data-testid="notify"
          >
            {offline ? t("entry.recordOffline") : t("entry.notify")}
          </Button>
          <Button
            variant="secondary"
            size="xl"
            className="h-16 flex-1 text-xl"
            iconStart={IconQr}
            onClick={onScan}
            data-testid="scan"
          >
            {t("entry.scan")}
          </Button>
        </div>
      </footer>
    </section>
  );
}
