import { getTranslations } from "next-intl/server";

import { TEMPLATE_VERSION_STATUS } from "@/domain/status/templateVersion";
import { SectionError } from "@/features/shared/console/SectionError";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatPercent, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";

import { can, section, type AdminContext } from "../shared/server";
import { NewPlanVersion, PublishPlanVersion } from "./PricePlanActions";

/**
 * Price plans (D-156, D-204): each plan with its effective-dated versions — price per billing unit or
 * the quoted range, minimums, setup fee, term, VAT — drafts published from a future date, never edited
 * once published. Values are the API's; nothing is derived here.
 */
export async function PricePlansView({ context }: { context: AdminContext }) {
  const t = await getTranslations("admin.billing.plans");
  const types = await getTranslations("glossary.tenantType");
  const { api, locale, me } = context;
  const plans = await section(unwrap(api.GET("/v1/admin/price-plans")));
  if (!plans.data) return <SectionError error={plans.error} />;
  const manage = can(me, "admin.subscription.manage");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  const price = (version: Schemas["PricePlanVersionDto"]) =>
    version.unitPrice
      ? t("perUnit", { price: formatTHB(version.unitPrice, locale), unit: t(`unit.${version.billingUnit}`) })
      : version.priceRange
        ? t("range", { from: formatTHB(version.priceRange.from, locale), to: formatTHB(version.priceRange.to, locale) })
        : version.tiers.length
          ? t("tiered", { count: version.tiers.length })
          : "—";
  const minimum = (version: Schemas["PricePlanVersionDto"]) =>
    [
      version.minUnits ? t("minUnitsValue", { count: formatNumber(version.minUnits, locale) }) : null,
      version.minMonthly ? t("minMonthlyValue", { amount: formatTHB(version.minMonthly, locale) }) : null,
      version.termMonths ? t("termValue", { months: version.termMonths }) : null,
      version.annualDiscountPct !== "0.00"
        ? t("annualDiscount", { pct: formatPercent(version.annualDiscountPct, locale) })
        : null,
    ]
      .filter(Boolean)
      .join(" · ") || "—";
  // Below md the same table becomes stacked rows (REDESIGN-PROMPT §4.5): a plan's head line, then each version as a
  // two-column block — version and price, effective dates and state, minimums, setup fee and the publish action.
  const cell = "px-4 py-3 align-top max-md:p-0";
  return (
    <div
      className="border-border bg-surface rounded-card shadow-card focus-visible:ring-focus-ring relative border focus-visible:ring-2 focus-visible:outline-none md:overflow-x-auto"
      data-testid="price-plans"
      tabIndex={0}
      role="region"
      aria-label={t("caption")}
    >
      <table className="w-full text-base max-md:block md:min-w-[56rem]">
        <caption className="sr-only">{t("caption")}</caption>
        <thead className="max-md:sr-only">
          <tr className="border-border text-muted border-b text-sm">
            <th scope="col" className="px-4 py-2.5 text-start font-medium">
              {t("col.version")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-start font-medium">
              {t("col.effective")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-end font-medium">
              {t("col.price")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-start font-medium">
              {t("col.minimum")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-end font-medium">
              {t("col.setup")}
            </th>
            <th scope="col" className="px-4 py-2.5 text-start font-medium">
              {t("col.state")}
            </th>
            <th scope="col" className="px-4 py-2.5">
              <span className="sr-only">{t("col.actions")}</span>
            </th>
          </tr>
        </thead>
        {plans.data.map((plan) => (
          <tbody
            key={plan.id}
            className="border-border border-b last:border-b-0 max-md:block"
            data-testid="price-plan"
            data-key={plan.key}
          >
            <tr className="bg-bg-subtle/70 max-md:flex max-md:flex-wrap max-md:items-center max-md:justify-between max-md:gap-2 max-md:px-4 max-md:py-3">
              <th scope="rowgroup" colSpan={6} className="px-4 py-3 text-start font-normal max-md:block max-md:p-0">
                <span id={`plan-${plan.key}`} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-semibold">{plan.nameTh}</span>
                  <Badge size="sm" tone={plan.isActive ? "success" : "neutral"}>
                    {plan.isActive ? t("sold") : t("notSold")}
                  </Badge>
                  <span className="text-muted text-sm">
                    {t(`kind.${plan.kind}`)}
                    {plan.tenantType ? ` · ${types(plan.tenantType)}` : ""}
                  </span>
                </span>
              </th>
              <td className="px-4 py-2 text-end max-md:block max-md:p-0">
                {manage ? <NewPlanVersion planId={plan.id} name={plan.nameTh} today={today} /> : null}
              </td>
            </tr>
            {plan.versions.map((version) => (
              <tr
                key={version.id}
                className="border-border border-t max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-baseline max-md:gap-x-4 max-md:gap-y-1 max-md:px-4 max-md:py-3"
                data-testid="plan-version"
                data-state={version.state}
              >
                <td className={`${cell} text-muted ps-8 font-mono text-sm max-md:col-start-1 max-md:row-start-1`}>
                  {t("versionShort", { version: version.version })}
                </td>
                <td className={`${cell} whitespace-nowrap max-md:col-start-1 max-md:row-start-2`}>
                  {formatDate(version.effectiveFrom, locale)}
                  {version.effectiveTo ? ` – ${formatDate(version.effectiveTo, locale)}` : ""}
                </td>
                <td
                  className={`${cell} text-end font-medium whitespace-nowrap tabular-nums max-md:col-start-2 max-md:row-start-1`}
                >
                  {price(version)}
                </td>
                <td className={`${cell} text-muted text-sm max-md:col-span-2 max-md:col-start-1`}>
                  {minimum(version)}
                </td>
                <td
                  className={`${cell} text-end whitespace-nowrap tabular-nums max-md:col-start-1 max-md:text-start max-md:text-sm`}
                >
                  <span className="text-muted me-1.5 md:hidden" aria-hidden="true">
                    {t("col.setup")}
                  </span>
                  {formatTHB(version.setupFee, locale)}
                </td>
                <td className={`${cell} max-md:col-start-2 max-md:row-start-2 max-md:justify-self-end`}>
                  <StatusBadgeOf map={TEMPLATE_VERSION_STATUS} value={version.state} size="sm" />
                </td>
                <td className={`${cell} text-end max-md:col-start-2 max-md:empty:hidden`}>
                  {manage && version.nextActions.includes("publish") ? (
                    <PublishPlanVersion versionId={version.id} label={`${plan.nameTh} v${version.version}`} />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
