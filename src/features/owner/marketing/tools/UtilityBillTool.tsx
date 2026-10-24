"use client";

import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import { formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

import { meterCharge, sum, type MeterInput } from "./estimate";

const EMPTY_METER: MeterInput = { previous: "", current: "", rate: "", minimum: "" };

/**
 * Utility bill per room (D-271): rent, an electricity and a water meter (units × rate, with an optional minimum) and
 * other charges, added up into a bill preview. Nothing leaves the browser; the numbers are the visitor's own.
 */
export function UtilityBillTool() {
  const t = useTranslations("owner.marketing.tools.utility");
  const locale = useLocale() as Locale;
  const [rent, setRent] = useState("");
  const [electric, setElectric] = useState<MeterInput>(EMPTY_METER);
  const [water, setWater] = useState<MeterInput>(EMPTY_METER);
  const [other, setOther] = useState("");

  const e = filled(electric) ? meterCharge(electric) : null;
  const w = filled(water) ? meterCharge(water) : null;
  const eCharged = e && "charged" in e ? e.charged : "";
  const wCharged = w && "charged" in w ? w.charged : "";
  const parts = [rent, eCharged, wCharged, other].filter((value) => value.trim() !== "");
  const total = parts.length > 0 ? sum(parts) : null;
  const money = (value: string) => formatTHB(value, locale);

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <form className="flex flex-col gap-8 lg:col-span-7" onSubmit={(event) => event.preventDefault()}>
        <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
          <legend className="mb-3 text-xl font-semibold">{t("room")}</legend>
          <Field label={t("rent")} hint={t("rentHint")}>
            <Input inputMode="decimal" value={rent} onChange={(ev) => setRent(ev.target.value)} />
          </Field>
        </fieldset>
        <MeterFields title={t("electric")} unit={t("kwh")} value={electric} onChange={setElectric} result={e} />
        <MeterFields title={t("water")} unit={t("cubic")} value={water} onChange={setWater} result={w} />
        <fieldset className="m-0 flex flex-col gap-4 border-0 p-0">
          <legend className="mb-3 text-xl font-semibold">{t("otherTitle")}</legend>
          <Field label={t("other")} hint={t("otherHint")}>
            <Input inputMode="decimal" value={other} onChange={(ev) => setOther(ev.target.value)} />
          </Field>
        </fieldset>
      </form>

      <aside aria-live="polite" className="lg:col-span-5">
        <div className="bg-surface border-border rounded-photo shadow-raised sticky top-24 flex flex-col gap-4 border p-6">
          <p className="text-muted text-sm font-semibold">{t("preview")}</p>
          <dl className="m-0 flex flex-col gap-3">
            <Row label={t("rent")} value={rent && sum([rent]) ? money(sum([rent])!) : "—"} />
            <Row
              label={t("electric")}
              value={eCharged ? money(eCharged) : "—"}
              note={e && "units" in e ? t("usage", { units: e.units, unit: t("kwh") }) : undefined}
            />
            <Row
              label={t("water")}
              value={wCharged ? money(wCharged) : "—"}
              note={w && "units" in w ? t("usage", { units: w.units, unit: t("cubic") }) : undefined}
            />
            <Row label={t("otherTitle")} value={other && sum([other]) ? money(sum([other])!) : "—"} />
          </dl>
          <div className="border-fg flex items-baseline justify-between border-t-2 pt-4">
            <span className="font-semibold">{t("total")}</span>
            <span className="text-3xl font-semibold tabular-nums">{total ? money(total) : "—"}</span>
          </div>
          <p className="text-muted text-xs">{t("estimate")}</p>
        </div>
      </aside>
    </div>
  );
}

function filled(meter: MeterInput) {
  return meter.previous !== "" && meter.current !== "" && meter.rate !== "";
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="flex flex-col">
        <span>{label}</span>
        {note ? <span className="text-muted text-xs">{note}</span> : null}
      </dt>
      <dd className="m-0 tabular-nums">{value}</dd>
    </div>
  );
}

function MeterFields({
  title,
  unit,
  value,
  onChange,
  result,
}: {
  title: string;
  unit: string;
  value: MeterInput;
  onChange: (next: MeterInput) => void;
  result: ReturnType<typeof meterCharge> | null;
}) {
  const t = useTranslations("owner.marketing.tools.utility");
  const id = useId();
  const set = (key: keyof MeterInput) => (event: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [key]: event.target.value });
  const error = result && "error" in result ? t(`errors.${result.error}`) : undefined;
  return (
    <fieldset className="m-0 flex flex-col gap-4 border-0 p-0" aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="mb-3 text-xl font-semibold">{title}</legend>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("previous")}>
          <Input inputMode="decimal" value={value.previous} onChange={set("previous")} />
        </Field>
        <Field label={t("current")}>
          <Input inputMode="decimal" value={value.current} onChange={set("current")} />
        </Field>
        <Field label={t("rate", { unit })}>
          <Input inputMode="decimal" value={value.rate} onChange={set("rate")} />
        </Field>
        <Field label={t("minimum")} hint={t("minimumHint")}>
          <Input inputMode="decimal" value={value.minimum} onChange={set("minimum")} />
        </Field>
      </div>
      {error ? (
        <Callout tone="danger">
          <span id={`${id}-err`}>{error}</span>
        </Callout>
      ) : null}
    </fieldset>
  );
}
