"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatDate, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";
import { NativeSelect } from "@/ui/components/NativeSelect";
import { IconPrinter } from "@/ui/icons/glyphs/printer";

import { sum, toHundredths } from "./estimate";
import { bahtTextEn, bahtTextTh } from "./words";

const LINE_KEYS = ["rent", "electric", "water", "other"] as const;
type LineKey = (typeof LINE_KEYS)[number];
const METHODS = ["transfer", "promptpay", "cash", "cheque"] as const;

/**
 * Rent receipt maker (D-271): fill in, check the preview, print or save as PDF from the browser's print dialog.
 * Nothing is uploaded or stored — closing the page forgets it.
 */
export function RentReceiptTool() {
  const t = useTranslations("owner.marketing.tools.receipt");
  const locale = useLocale() as Locale;
  const [form, setForm] = useState(() => ({
    number: "",
    // Today in Bangkok, as the date input expects.
    date: new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10),
    landlord: "",
    tenant: "",
    property: "",
    period: "",
    method: "transfer" as (typeof METHODS)[number],
  }));
  const [lines, setLines] = useState<Record<LineKey, string>>({ rent: "", electric: "", water: "", other: "" });
  const [otherLabel, setOtherLabel] = useState("");
  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: event.target.value });

  const valid = LINE_KEYS.every((key) => lines[key] === "" || toHundredths(lines[key]) !== null);
  const shown = LINE_KEYS.filter((key) => lines[key] !== "" && toHundredths(lines[key]) !== null);
  const total = valid && shown.length > 0 ? sum(shown.map((key) => lines[key])) : null;
  const label = (key: LineKey) => (key === "other" && otherLabel ? otherLabel : t(`lines.${key}`));

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <form className="flex flex-col gap-6 lg:col-span-5 print:hidden" onSubmit={(event) => event.preventDefault()}>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t("number")}>
            <Input value={form.number} onChange={set("number")} />
          </Field>
          <Field label={t("date")}>
            <Input type="date" value={form.date} onChange={set("date")} />
          </Field>
        </div>
        <Field label={t("landlord")} hint={t("landlordHint")}>
          <Input value={form.landlord} onChange={set("landlord")} />
        </Field>
        <Field label={t("tenant")}>
          <Input value={form.tenant} onChange={set("tenant")} />
        </Field>
        <Field label={t("property")} hint={t("propertyHint")}>
          <Input value={form.property} onChange={set("property")} />
        </Field>
        <Field label={t("period")} hint={t("periodHint")}>
          <Input value={form.period} onChange={set("period")} />
        </Field>
        <fieldset className="m-0 grid grid-cols-2 gap-4 border-0 p-0">
          <legend className="mb-2 font-semibold">{t("amounts")}</legend>
          {LINE_KEYS.map((key) => (
            <Field key={key} label={t(`lines.${key}`)}>
              <Input
                inputMode="decimal"
                value={lines[key]}
                onChange={(event) => setLines({ ...lines, [key]: event.target.value })}
              />
            </Field>
          ))}
          <Field label={t("otherLabel")} className="col-span-2">
            <Input value={otherLabel} onChange={(event) => setOtherLabel(event.target.value)} />
          </Field>
        </fieldset>
        <Field label={t("method")}>
          <NativeSelect
            value={form.method}
            onChange={set("method")}
            options={METHODS.map((m) => ({ value: m, label: t(`methods.${m}`) }))}
          />
        </Field>
        {!valid ? <Callout tone="danger">{t("invalid")}</Callout> : null}
        <Button type="button" size="lg" iconStart={IconPrinter} onClick={() => window.print()}>
          {t("print")}
        </Button>
        <p className="text-muted text-xs">{t("privacy")}</p>
      </form>

      <section aria-label={t("preview")} className="lg:col-span-7 print:col-span-12">
        <div
          id="receipt"
          className="bg-surface border-border rounded-card shadow-raised flex flex-col gap-6 border p-8 print:rounded-none print:border-0 print:shadow-none"
        >
          <header className="border-fg flex items-start justify-between gap-6 border-b-2 pb-4">
            <div>
              <p className="text-2xl font-semibold">{t("heading")}</p>
              <p className="text-muted text-sm">{t("headingAlt")}</p>
            </div>
            <dl className="m-0 text-end text-sm">
              <div>
                <dt className="text-muted inline">{t("number")} </dt>
                <dd className="m-0 inline font-mono">{form.number || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted inline">{t("date")} </dt>
                <dd className="m-0 inline">
                  {form.date ? formatDate(`${form.date}T12:00:00+07:00`, locale, { style: "long" }) : "—"}
                </dd>
              </div>
            </dl>
          </header>
          <dl className="m-0 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">{t("receivedFrom")}</dt>
              <dd className="m-0 font-semibold">{form.tenant || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">{t("receivedBy")}</dt>
              <dd className="m-0 font-semibold">{form.landlord || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted">{t("property")}</dt>
              <dd className="m-0">{form.property || "—"}</dd>
            </div>
          </dl>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-border border-b">
                <th scope="col" className="py-2 text-start font-semibold">
                  {t("item")}
                </th>
                <th scope="col" className="py-2 text-end font-semibold">
                  {t("amount")}
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={2} className="text-muted py-3">
                    {t("empty")}
                  </td>
                </tr>
              ) : (
                shown.map((key) => (
                  <tr key={key} className="border-border border-b">
                    <td className="py-3">
                      {label(key)}
                      {key === "rent" && form.period ? <span className="text-muted"> · {form.period}</span> : null}
                    </td>
                    <td className="py-3 text-end tabular-nums">{formatTHB(sum([lines[key]])!, locale)}</td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="pt-4 text-start text-base">
                  {t("total")}
                </th>
                <td className="pt-4 text-end text-xl font-semibold tabular-nums">
                  {total ? formatTHB(total, locale) : "—"}
                </td>
              </tr>
            </tfoot>
          </table>
          {total ? (
            <p className="bg-bg-subtle rounded-control px-4 py-2 text-sm">
              {t("inWords", { words: locale === "th" ? bahtTextTh(total) : bahtTextEn(total) })}
            </p>
          ) : null}
          <p className="text-sm">
            <span className="text-muted">{t("paidBy")} </span>
            {t(`methods.${form.method}`)}
          </p>
          <div className="mt-6 flex justify-end">
            <div className="flex w-56 flex-col items-center gap-1 text-sm">
              <span className="border-fg w-full border-b pt-10" />
              <span>{t("signature")}</span>
              <span className="text-muted">{form.landlord ? `(${form.landlord})` : ""}</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
