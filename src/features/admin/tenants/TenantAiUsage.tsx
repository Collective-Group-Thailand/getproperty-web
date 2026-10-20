import { getTranslations } from "next-intl/server";

import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Card } from "@/ui/components/Card";
import { EmptyState } from "@/ui/components/EmptyState";
import { IconCpu } from "@/ui/icons/glyphs/cpu";

import { section, type AdminContext } from "../shared/server";

/**
 * AI usage of a tenant (D-161, D-206, O-009): per month and feature (meter OCR, utility-bill OCR…) the
 * calls, units, the plan's allowance, units beyond it and the cost to the platform at
 * `ai.unit_costs` — figures from the usage records, newest month first.
 */
export async function TenantAiUsage({
  context,
  tenant,
}: {
  context: AdminContext;
  tenant: Schemas["TenantProfileDto"];
}) {
  const t = await getTranslations("admin.tenants.ai");
  const { api, locale } = context;
  const usage = await section(
    unwrap(api.GET("/v1/admin/tenants/{tenantId}/ai-usage", { params: { path: { tenantId: tenant.id } } })),
  );
  if (!usage.data) return <SectionError error={usage.error} />;
  const months = [...usage.data.months].sort(
    (a, b) => b.month.localeCompare(a.month) || a.feature.localeCompare(b.feature),
  );
  if (months.length === 0)
    return (
      <Card>
        <EmptyState icon={IconCpu} title={t("empty")} description={t("emptyHint")} />
      </Card>
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-sm">{t("hint")}</p>
      <SimpleTable
        caption={t("title")}
        testId="ai-usage"
        minWidth="44rem"
        columns={[
          { key: "month", header: t("col.month") },
          { key: "feature", header: t("col.feature") },
          { key: "calls", header: t("col.calls"), align: "end" },
          { key: "units", header: t("col.units"), align: "end" },
          { key: "allowance", header: t("col.allowance"), align: "end" },
          { key: "overage", header: t("col.overage"), align: "end" },
          { key: "cost", header: t("col.cost"), align: "end" },
        ]}
        rows={months.map((row) => ({
          key: `${row.month}-${row.feature}`,
          testId: "ai-usage-row",
          data: { feature: row.feature },
          tone: row.overage > 0 ? "warning" : "default",
          cells: {
            month: formatPeriodKey(row.month.slice(0, 7), locale),
            feature: t(`feature.${row.feature}`),
            calls: formatNumber(row.calls, locale),
            units: formatNumber(row.units, locale),
            allowance: row.allowance === null ? "—" : formatNumber(row.allowance, locale),
            overage: formatNumber(row.overage, locale),
            cost: formatTHB(row.costThb, locale),
          },
        }))}
      />
    </div>
  );
}
