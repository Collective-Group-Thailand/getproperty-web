import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { SectionError } from "@/features/shared/console/SectionError";
import { SimpleTable } from "@/ui/components/SimpleTable";
import { formatNumber, formatPeriodKey, formatTHB } from "@/i18n/format";
import { unwrap } from "@/lib/api/client";
import type { Schemas } from "@/lib/api/types";
import { Badge } from "@/ui/components/Badge";
import { Button } from "@/ui/components/Button";
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
      <EmptyState
        variant="card"
        icon={IconCpu}
        title={t("empty")}
        description={t("emptyHint")}
        action={
          <Button asChild variant="secondary">
            <Link href="/ai-usage">{t("openPlatform")}</Link>
          </Button>
        }
      />
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-sm">{t("hint")}</p>
      <SimpleTable
        caption={t("title")}
        testId="ai-usage"
        stackOnPhones
        minWidth="48rem"
        columns={[
          { key: "month", header: t("col.month"), phone: "meta" },
          { key: "feature", header: t("col.feature"), phone: "title" },
          { key: "calls", header: t("col.calls"), align: "end", phone: "hidden" },
          { key: "units", header: t("col.units"), align: "end", phone: "meta" },
          { key: "allowance", header: t("col.allowance"), align: "end", phone: "hidden" },
          { key: "overage", header: t("col.overage"), align: "end", phone: "status" },
          { key: "cost", header: t("col.cost"), align: "end", phone: "figure" },
        ]}
        rows={months.map((row) => ({
          key: `${row.month}-${row.feature}`,
          testId: "ai-usage-row",
          data: { feature: row.feature },
          cells: {
            month: formatPeriodKey(row.month.slice(0, 7), locale),
            feature: t(`feature.${row.feature}`),
            calls: formatNumber(row.calls, locale),
            units: formatNumber(row.units, locale),
            allowance: row.allowance === null ? "—" : formatNumber(row.allowance, locale),
            overage:
              row.overage > 0 ? (
                <Badge tone="warning" size="sm">
                  {t("overageValue", { count: formatNumber(row.overage, locale) })}
                </Badge>
              ) : (
                <span className="text-muted">{formatNumber(0, locale)}</span>
              ),
            cost: <span className="whitespace-nowrap">{formatTHB(row.costThb, locale)}</span>,
          },
        }))}
      />
    </div>
  );
}
