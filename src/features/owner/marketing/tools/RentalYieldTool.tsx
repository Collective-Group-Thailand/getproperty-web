"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { formatDecimal, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
import { Callout } from "@/ui/components/Callout";
import { Field } from "@/ui/components/Field";
import { Input } from "@/ui/components/Input";

import { rentalYield, type YieldInput } from "./estimate";
import { PhoneResultBar } from "./PhoneResultBar";

/** The example the page opens with (marked as an example), so the result is never a row of dashes. */
const EXAMPLE: YieldInput = { price: "3000000", monthlyRent: "15000", yearlyCosts: "24000", vacantMonths: "1" };
const EMPTY: YieldInput = { price: "", monthlyRent: "", yearlyCosts: "", vacantMonths: "1" };

/** Hundredths of a decimal string, for the proportion bar only (the figures themselves come from `rentalYield`). */
const share = (part: string, whole: string) => {
  const p = Number(part);
  const w = Number(whole);
  return w > 0 && p > 0 ? Math.min(100, Math.round((p / w) * 100)) : 0;
};

/**
 * Rental yield (D-271, Stitch revision): inputs and results in ONE card split by a hairline. It opens filled with
 * example figures (labelled, with a "clear" action) so the result side is never empty; the key figure in brand blue,
 * the rest as a right-aligned definition list, a thin bar for net income against a full year's rent.
 */
export function RentalYieldTool() {
  const t = useTranslations("owner.marketing.tools.yield");
  const shared = useTranslations("owner.marketing.tools");
  const locale = useLocale() as Locale;
  const [input, setInput] = useState<YieldInput>(EXAMPLE);
  const [example, setExample] = useState(true);
  const set = (key: keyof YieldInput) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setExample(false);
    setInput({ ...input, [key]: event.target.value });
  };
  const ready = input.price !== "" && input.monthlyRent !== "";
  const result = ready ? rentalYield(input) : null;
  const ok = result && "netYield" in result ? result : null;
  const netShare = ok ? share(ok.netIncome, ok.yearlyRent) : 0;

  return (
    <div className="bg-surface border-border rounded-panel shadow-card grid overflow-hidden border lg:grid-cols-12">
      <form
        className="flex flex-col gap-5 p-6 md:p-8 lg:col-span-7"
        onSubmit={(event) => event.preventDefault()}
        aria-describedby="yield-example"
      >
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1" id="yield-example">
          {example ? (
            <>
              <p className="text-muted m-0 flex items-center gap-2 text-sm">
                <Badge tone="info" size="sm">
                  {t("exampleBadge")}
                </Badge>
                {t("example")}
              </p>
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => {
                  setExample(false);
                  setInput(EMPTY);
                }}
              >
                {t("clearExample")}
              </Button>
            </>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
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
        </div>
        {result && "error" in result ? <Callout tone="danger">{t("invalid")}</Callout> : null}
      </form>

      <section
        aria-live="polite"
        aria-labelledby="yield-net-label"
        className="bg-bg border-border flex scroll-mt-24 flex-col gap-6 border-t p-6 md:p-8 lg:col-span-5 lg:border-s lg:border-t-0"
        id="yield-result"
      >
        <div>
          <p id="yield-net-label" className="text-muted m-0 text-sm font-semibold">
            {t("net")}
          </p>
          <p className="text-primary m-0 text-4xl font-semibold tabular-nums" data-testid="yield-net">
            {ok ? t("percent", { value: formatDecimal(ok.netYield, locale, 2) }) : "—"}
          </p>
        </div>
        <dl className="m-0 flex flex-col gap-3 text-sm">
          <Row label={t("gross")} value={ok ? t("percent", { value: formatDecimal(ok.grossYield, locale, 2) }) : "—"} />
          <Row
            label={t("payback")}
            value={ok?.paybackYears ? t("years", { value: formatDecimal(ok.paybackYears, locale, 1) }) : "—"}
          />
          <Row label={t("yearlyRent")} value={ok ? formatTHB(ok.yearlyRent, locale, { decimals: 0 }) : "—"} />
          <div className="border-border border-t pt-3">
            <Row strong label={t("netIncome")} value={ok ? formatTHB(ok.netIncome, locale, { decimals: 0 }) : "—"} />
          </div>
        </dl>
        {ok ? (
          <figure className="m-0 flex flex-col gap-2">
            <div
              role="img"
              aria-label={`${t("split")}: ${netShare}%`}
              className="bg-border rounded-thumb flex h-2 overflow-hidden"
            >
              <span className="bg-primary h-full" style={{ width: `${netShare}%` }} />
            </div>
            <figcaption className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="bg-primary rounded-thumb size-2" />
                {t("netIncome")}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="bg-border-strong rounded-thumb size-2" />
                {t("costsShare")}
              </span>
            </figcaption>
          </figure>
        ) : null}
        <p className="text-muted m-0 text-xs">{t("estimate")}</p>
      </section>
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={strong ? "font-semibold" : "text-muted"}>{label}</dt>
      <dd className={`m-0 tabular-nums ${strong ? "text-lg font-semibold" : "font-medium"}`}>{value}</dd>
    </div>
  );
}
