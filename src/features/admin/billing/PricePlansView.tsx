import { getTranslations } from "next-intl/server";

import { TEMPLATE_VERSION_STATUS } from "@/domain/status/templateVersion";
import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { StatusBadgeOf } from "@/features/shared/status/StatusBadgeOf";
import { formatDate, formatNumber, formatPercent, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import { Badge } from "@/ui/components/Badge";
import { Card, CardHeader } from "@/ui/components/Card";

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
  return (
    <div className="flex flex-col gap-4" data-testid="price-plans">
      {plans.data.map((plan) => (
        <Card
          key={plan.id}
          as="section"
          aria-labelledby={`plan-${plan.key}`}
          data-testid="price-plan"
          data-key={plan.key}
        >
          <CardHeader
            title={
              <span id={`plan-${plan.key}`} className="flex flex-wrap items-center gap-2">
                {plan.nameTh}
                <span className="text-muted font-mono text-sm">{plan.key}</span>
                <Badge size="sm" tone={plan.isActive ? "success" : "neutral"}>
                  {plan.isActive ? t("sold") : t("notSold")}
                </Badge>
              </span>
            }
            description={`${t(`kind.${plan.kind}`)}${plan.tenantType ? ` · ${types(plan.tenantType)}` : ""}`}
            action={manage ? <NewPlanVersion planId={plan.id} name={plan.nameTh} today={today} /> : undefined}
          />
          <SimpleTable
            caption={plan.nameTh}
            minWidth="52rem"
            columns={[
              { key: "version", header: t("col.version") },
              { key: "effective", header: t("col.effective") },
              { key: "price", header: t("col.price"), align: "end" },
              { key: "minimum", header: t("col.minimum") },
              { key: "setup", header: t("col.setup"), align: "end" },
              { key: "state", header: t("col.state") },
              { key: "actions", header: <span className="sr-only">{t("col.actions")}</span> },
            ]}
            rows={plan.versions.map((version) => ({
              key: version.id,
              testId: "plan-version",
              data: { state: version.state },
              cells: {
                version: `v${version.version}`,
                effective: `${formatDate(version.effectiveFrom, locale)}${version.effectiveTo ? ` – ${formatDate(version.effectiveTo, locale)}` : ""}`,
                price: version.unitPrice
                  ? t("perUnit", {
                      price: formatTHB(version.unitPrice, locale),
                      unit: t(`unit.${version.billingUnit}`),
                    })
                  : version.priceRange
                    ? t("range", {
                        from: formatTHB(version.priceRange.from, locale),
                        to: formatTHB(version.priceRange.to, locale),
                      })
                    : version.tiers.length
                      ? t("tiered", { count: version.tiers.length })
                      : "—",
                minimum:
                  [
                    version.minUnits ? t("minUnitsValue", { count: formatNumber(version.minUnits, locale) }) : null,
                    version.minMonthly ? t("minMonthlyValue", { amount: formatTHB(version.minMonthly, locale) }) : null,
                    version.termMonths ? t("termValue", { months: version.termMonths }) : null,
                    version.annualDiscountPct !== "0.00"
                      ? t("annualDiscount", { pct: formatPercent(version.annualDiscountPct, locale) })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—",
                setup: formatTHB(version.setupFee, locale),
                state: <StatusBadgeOf map={TEMPLATE_VERSION_STATUS} value={version.state} size="sm" />,
                actions:
                  manage && version.nextActions.includes("publish") ? (
                    <PublishPlanVersion versionId={version.id} label={`${plan.nameTh} v${version.version}`} />
                  ) : null,
              },
            }))}
          />
        </Card>
      ))}
    </div>
  );
}
