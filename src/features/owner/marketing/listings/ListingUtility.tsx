import { useTranslations } from "next-intl";

import { formatDecimal, formatTHB } from "@/i18n/format";
import type { Locale } from "@/i18n/routing";
import type { Schemas } from "@/lib/api/types";

type Utility = Schemas["ListingUtilityDto"];
type Rate = Schemas["ListingUtilityRateDto"];

/** `฿3.0000` → `฿3.00`; a fourth decimal only when the owner priced one (฿4.1234). */
const price = (value: string, locale: Locale) =>
  formatTHB(value, locale, { decimals: /\.\d{2}[1-9]|\.\d{3}[1-9]/.test(value) ? 4 : 2 });

function RateLines({ rate, unit, locale }: { rate: Rate; unit: "kwh" | "m3"; locale: Locale }) {
  const t = useTranslations("owner.marketing.listings.utility");
  const per = t(`per.${unit}`);
  return (
    <>
      {rate.kind === "flat" && rate.pricePerUnit ? (
        <span className="font-semibold tabular-nums">
          {price(rate.pricePerUnit, locale)} {per}
        </span>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {rate.tiers.map((tier) => (
            <li key={tier.fromUnits} className="tabular-nums">
              <span className="text-muted">
                {tier.toUnits
                  ? t("tier", {
                      from: formatDecimal(tier.fromUnits, locale, 0),
                      to: formatDecimal(tier.toUnits, locale, 0),
                    })
                  : t("tierFrom", { from: formatDecimal(tier.fromUnits, locale, 0) })}
              </span>{" "}
              <span className="font-semibold">
                {price(tier.pricePerUnit, locale)} {per}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rate.minimumCharge ? (
        <span className="text-muted text-sm">{t("minimum", { amount: formatTHB(rate.minimumCharge, locale) })}</span>
      ) : null}
    </>
  );
}

/**
 * What living here costs on top of the rent (D-265): the power and water rates this unit is billed at, the other
 * fixed monthly charges, and — when the owner lets it show and there are enough real bills — the average of the
 * unit's last utility bills. Every number is the API's; nothing is estimated here.
 */
export function ListingUtility({ utility, locale }: { utility: Utility; locale: Locale }) {
  const t = useTranslations("owner.marketing.listings.utility");
  const rows: { key: string; label: string; value: React.ReactNode }[] = [
    {
      key: "electricity",
      label: t("electricity"),
      value: utility.electricity ? (
        <RateLines rate={utility.electricity} unit="kwh" locale={locale} />
      ) : (
        <span className="text-muted">{t("notSet")}</span>
      ),
    },
    {
      key: "water",
      label: t("water"),
      value: utility.water ? (
        <RateLines rate={utility.water} unit="m3" locale={locale} />
      ) : (
        <span className="text-muted">{t("notSet")}</span>
      ),
    },
    ...utility.fixedCharges.map((charge) => ({
      key: `${charge.kind}-${charge.name}`,
      label: charge.name || t(`fixed.${charge.kind}`),
      value: (
        <span className="font-semibold tabular-nums">
          {formatTHB(charge.amount, locale)} {t("perMonth")}
        </span>
      ),
    })),
  ];

  return (
    <div className="flex flex-col gap-4" data-testid="listing-utility">
      {utility.averageBill3m ? (
        <div className="border-fg flex flex-col gap-1 border-s-2 ps-4">
          <p className="text-muted m-0 text-sm">{t("average", { count: utility.basedOnBills })}</p>
          <p className="m-0 text-2xl font-semibold tabular-nums" data-testid="listing-utility-average">
            {formatTHB(utility.averageBill3m, locale)}
            <span className="text-muted ms-1 text-base font-normal">{t("perMonth")}</span>
          </p>
          <p className="text-muted m-0 text-xs">{t("averageNote")}</p>
        </div>
      ) : null}
      <dl className="border-border m-0 border-t">
        {rows.map((row) => (
          <div key={row.key} className="border-border grid gap-1 border-b py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="text-muted text-sm">{row.label}</dt>
            <dd className="m-0 flex flex-col gap-0.5 sm:col-span-2">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
