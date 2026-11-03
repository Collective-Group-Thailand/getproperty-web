"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatDecimal, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

import { rentalYield, type YieldInput } from "./estimate";
import { PhoneResultBar } from "./PhoneResultBar";

/** Rental yield (D-271): gross and net yield and payback years from the visitor's own figures. */
export function RentalYieldTool() {
  const t = useTranslations("owner.marketing.tools.yield");
  const shared = useTranslations("owner.marketing.tools");
  const locale = useLocale() as Locale;
  const [input, setInput] = useState<YieldInput>({ price: "", monthlyRent: "", yearlyCosts: "", vacantMonths: "1" });
  const set = (key: keyof YieldInput) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setInput({ ...input, [key]: event.target.value });
  const ready = input.price !== "" && input.monthlyRent !== "";
  const result = ready ? rentalYield(input) : null;
  const ok = result && "netYield" in result ? result : null;

  return (
    <div className="grid gap-10 lg:grid-cols-12">
      <form className="grid gap-4 sm:grid-cols-2 lg:col-span-7" onSubmit={(event) => event.preventDefault()}>
        <Field label={t("price")} hint={t("priceHint")}>
          <Input inputMode="decimal" value={input.price} onChange={set("price")} />
        </Field>
        <Field label={t("rent")}>
          <Input inputMode="decimal" value={input.monthlyRent} onChange={set("monthlyRent")} />
        </Field>
        <Field label={t("costs")} hint={t("costsHint")}>
          <Input inputMode="decimal" value={input.yearlyCosts} onChange={set("yearlyCosts")} />
        </Field>
        <Field label={t("vacant")} hint={t("vacantHint")}>
          <Input inputMode="numeric" value={input.vacantMonths} onChange={set("vacantMonths")} />
        </Field>
        {result && "error" in result ? (
          <Callout tone="danger" className="sm:col-span-2">
            {t("invalid")}
          </Callout>
        ) : null}
      </form>

      <aside aria-live="polite" className="scroll-mt-24 lg:col-span-5" id="yield-result">
        <div className="bg-surface border-border rounded-panel shadow-card flex flex-col gap-6 border p-6 md:p-8 lg:sticky lg:top-24">
          <div>
            <p className="text-muted m-0 text-sm font-semibold">{t("net")}</p>
            <p className="text-primary m-0 text-4xl font-semibold tabular-nums" data-testid="yield-net">
              {ok ? t("percent", { value: formatDecimal(ok.netYield, locale, 2) }) : "—"}
            </p>
          </div>
          <dl className="border-border m-0 grid grid-cols-2 gap-x-4 gap-y-5 border-t pt-5 text-sm">
            <div>
              <dt className="text-muted">{t("gross")}</dt>
              <dd className="m-0 text-lg font-semibold tabular-nums">
                {ok ? t("percent", { value: formatDecimal(ok.grossYield, locale, 2) }) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("payback")}</dt>
              <dd className="m-0 text-lg font-semibold tabular-nums">
                {ok?.paybackYears ? t("years", { value: formatDecimal(ok.paybackYears, locale, 1) }) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("yearlyRent")}</dt>
              <dd className="m-0 text-lg font-semibold tabular-nums">
                {ok ? formatTHB(ok.yearlyRent, locale, { decimals: 0 }) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted">{t("netIncome")}</dt>
              <dd className="m-0 text-lg font-semibold tabular-nums">
                {ok ? formatTHB(ok.netIncome, locale, { decimals: 0 }) : "—"}
              </dd>
            </div>
          </dl>
          <p className="text-muted m-0 text-xs">{t("estimate")}</p>
        </div>
      </aside>
      <PhoneResultBar
        summary={
          <span className="flex flex-col">
            <span className="text-muted text-xs">{t("net")}</span>
            <span className="text-lg font-semibold tabular-nums">
              {ok ? t("percent", { value: formatDecimal(ok.netYield, locale, 2) }) : "—"}
            </span>
          </span>
        }
      >
        <Button asChild variant="secondary">
          <a href="#yield-result">{shared("viewResult")}</a>
        </Button>
      </PhoneResultBar>
    </div>
  );
}
